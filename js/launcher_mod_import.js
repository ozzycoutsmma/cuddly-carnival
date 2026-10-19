/* Local classic-DLC importer. No native code or server uploads. */

(()=>{

  'use strict';

  const limits=GTAUserMods.limits;
  const $=id=>document.getElementById(id),records=new Map(),PREF='gta5.mods.selection.v1',TRAFFIC_PREF='gta5.mods.traffic.v1',STORY_TRAFFIC_PREF='gta5.mods.story-traffic.v1';let busy=false,ready,installingAudi=false,enabledPackages=new Set();

  let trafficPreferences={};try{const stored=JSON.parse(localStorage.getItem(TRAFFIC_PREF)||'{}');for(const key of Object.keys(stored||{}).slice(0,256))if(/^[a-f0-9]{24}:[a-z0-9_]{1,64}$/.test(key)&&stored[key]===true)trafficPreferences[key]=true;}catch(_){}

  let storyTrafficPreferences={};try{const stored=JSON.parse(localStorage.getItem(STORY_TRAFFIC_PREF)||'{}');for(const key of Object.keys(stored||{}).slice(0,256))if(/^[a-f0-9]{24}:[a-z0-9_]{1,64}$/.test(key)&&stored[key]===true)storyTrafficPreferences[key]=true;}catch(_){}

  const trafficKeys=value=>Array.isArray(value)?[...new Set(value.filter(key=>typeof key==='string'&&/^[a-f0-9]{24}:[a-z0-9_]{1,64}$/.test(key)))].slice(0,256):[];
  function normalisePreferences(value={}){return {saveProfile:value.saveProfile==='default'||typeof value.saveProfile==='string'&&/^[a-f0-9]{32}$/.test(value.saveProfile)?value.saveProfile:'default',trafficShare:[5,10,25].includes(Number(value.trafficShare))?Number(value.trafficShare):5,package:typeof value.package==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value.package)?value.package:'none',model:typeof value.model==='string'&&/^[a-z0-9_]{1,64}$/.test(value.model)?value.model:'rs318',traffic:value.traffic===true,storyTraffic:value.storyTraffic===true,trainerSandbox:value.trainerSandbox===true,trainerStory:value.trainerStory===true,trafficModels:value.trafficModels&&typeof value.trafficModels==='object'?{sandbox:trafficKeys(value.trafficModels.sandbox),story:trafficKeys(value.trafficModels.story)}:null,enabledPackages:Array.isArray(value.enabledPackages)?[...new Set(value.enabledPackages.filter(id=>id==='rs318'||/^[a-f0-9]{24}$/.test(id)))].slice(0,limits.packages):(value.package&&value.package!=='none'&&/^(?:rs318|[a-f0-9]{24})$/.test(value.package)?[value.package]:[])};}

  const currentPreferences=()=>normalisePreferences({saveProfile:window.GTASaveProfiles?GTASaveProfiles.selected():'default',trafficShare:$('mod-traffic-share').value,package:$('mod-preset').value,model:$('mod-model').value,traffic:$('mod-traffic').checked&&!$('mod-traffic').disabled,storyTraffic:$('mod-story-traffic').checked&&!$('mod-story-traffic').disabled,trainerSandbox:$('mod-trainer-sandbox').checked,trainerStory:$('mod-trainer-story').checked,enabledPackages:[...enabledPackages],trafficModels:{sandbox:Object.keys(trafficPreferences).filter(key=>trafficPreferences[key]),story:Object.keys(storyTrafficPreferences).filter(key=>storyTrafficPreferences[key])}});

  function savePreferences(){try{localStorage.setItem(PREF,JSON.stringify(currentPreferences()));}catch(_){$('mod-result').textContent='Browser storage is unavailable; package selection applies to this page only.';}}

  async function applyPreferences(value){await ready;const prefs=normalisePreferences(value);$('mod-traffic-share').value=String(prefs.trafficShare);if(prefs.trafficModels){trafficPreferences=Object.fromEntries(prefs.trafficModels.sandbox.map(key=>[key,true]));storyTrafficPreferences=Object.fromEntries(prefs.trafficModels.story.map(key=>[key,true]));try{localStorage.setItem(TRAFFIC_PREF,JSON.stringify(trafficPreferences));localStorage.setItem(STORY_TRAFFIC_PREF,JSON.stringify(storyTrafficPreferences));}catch(_){}}enabledPackages=new Set(prefs.enabledPackages.filter(id=>id==='rs318'||records.has(id)));if(enabledPackages.has('rs318')){const audi=[...records.values()].find(record=>record.models.includes('rs318'));if(audi){enabledPackages.delete('rs318');enabledPackages.add(audi.id);}else enabledPackages=new Set();}const available=prefs.package==='none'||prefs.package==='rs318'||records.has(prefs.package);$('mod-preset').value=available?prefs.package:'none';$('mod-trainer-sandbox').checked=prefs.trainerSandbox;$('mod-trainer-story').checked=prefs.trainerStory;renderDetails();if([...$('mod-model').options].some(option=>option.value===prefs.model))$('mod-model').value=prefs.model;syncTraffic();if(!prefs.trafficModels&&typeof value?.traffic==='boolean'&&selected()){ $('mod-traffic').checked=prefs.traffic;saveTraffic();}if(!prefs.trafficModels&&typeof value?.storyTraffic==='boolean'&&selected()){$('mod-story-traffic').checked=prefs.storyTraffic;saveTraffic(true);}savePreferences();if(!available)$('mod-result').textContent='The saved mod package is not installed in this browser. Import its ZIP separately to use it.';}

  const selected=()=>records.get($('mod-preset').value);

  const canTraffic=record=>!!record&&!record.kind&&(!record.manifest?.replacement?.vehicleType||record.manifest.replacement.vehicleType==='VEHICLE_TYPE_CAR');
  const trafficKey=()=>{const record=selected();return canTraffic(record)&&record.models.includes($('mod-model').value)?record.id+':'+$('mod-model').value:null;};

  function syncTraffic(){const key=trafficKey();for(const id of ['mod-traffic','mod-story-traffic'])$(id).disabled=!key;for(const id of ['mod-traffic-row','mod-story-traffic-row','mod-traffic-note'])$(id).hidden=!key;$('mod-traffic').checked=!!key&&trafficPreferences[key]===true;$('mod-story-traffic').checked=!!key&&storyTrafficPreferences[key]===true;renderTrafficPool();}

  function saveTraffic(story=false){const key=trafficKey(),preferences=story?storyTrafficPreferences:trafficPreferences;if(key){if($(story?'mod-story-traffic':'mod-traffic').checked)preferences[key]=true;else delete preferences[key];try{localStorage.setItem(story?STORY_TRAFFIC_PREF:TRAFFIC_PREF,JSON.stringify(preferences));}catch(_){$('mod-result').textContent='Traffic choice applies to this page only; browser storage is unavailable.';}}renderTrafficPool();}

  function enabledTraffic(mode){const preferences=mode==='story'?storyTrafficPreferences:trafficPreferences,out=[];for(const record of records.values())for(const model of canTraffic(record)?record.models:[])if(enabledPackages.has(record.id)&&preferences[record.id+':'+model]===true)out.push({id:record.id,model});return out.sort((a,b)=>(a.id+':'+a.model).localeCompare(b.id+':'+b.model));}

  function renderTrafficPool(){const node=$('mod-traffic-pool');if(!node)return;node.hidden=!selected();node.textContent=['sandbox','story'].map(mode=>{const entries=enabledTraffic(mode);return (mode==='story'?'Story':'Sandbox')+': '+(entries.map(x=>x.model).join(', ')||'no mod traffic');}).join(' · ');}

  function renderDetails(){

    const record=selected(),model=$('mod-model');model.replaceChildren();

    for(const name of record?.models||['rs318']){const option=document.createElement('option');option.value=name;option.textContent=name;model.append(option);}

    $('mod-model-label').textContent=record?.kind?'Content model':'Vehicle model';
    model.hidden=['handling','resources','config','shader'].includes(record?.kind);$('mod-model-label').hidden=model.hidden;
    syncTraffic();renderTable();$('mod-package-options').hidden=!record;$('mod-selected-title').textContent='Package options: '+(record?displayName(record):'');

    for(const id of ['mod-export-original','mod-export-adapted','mod-export-report','mod-remove'])$(id).disabled=!record;
    $('mod-export-original').textContent=record?.originalZip?'Export source archive':'Export original DLC';$('mod-export-adapted').textContent=record?.kind==='shader'?'Export adapted shader pack ZIP':record?.kind==='resources'?'Export adapted resources ZIP':record?.kind==='config'?'Export adapted settings JSON':record?.kind==='handling'?'Export adapted handling.meta':'Export adapted DLC';

    $('mod-details').textContent=record?.kind==='shader'?record.shaderReplacements.length+' replacement shader programs · '+(packageBytes(record)/1048576).toFixed(1)+' MiB':record?record.packName+' · '+Math.round(packageBytes(record)/1048576)+' MiB · '+record.models.length+(record.kind?' content model(s)':' vehicle model(s)'):'Choose a bundled car or import an add-on vehicle ZIP.';

  }

  async function refresh(chosen){

    records.clear();const preset=$('mod-preset');preset.replaceChildren();

    for(const [value,text] of [['none','None — normal game']]){const option=document.createElement('option');option.value=value;option.textContent=text;preset.append(option);}

    try{for(const record of await GTAUserMods.list()){records.set(record.id,record);const option=document.createElement('option');option.value=record.id;option.textContent=record.packName+' — imported';preset.append(option);}}catch(error){$('mod-result').textContent='Local mod storage unavailable: '+error.message;}

    enabledPackages=new Set([...enabledPackages].filter(id=>id==='rs318'||records.has(id)));preset.value=chosen&&(chosen==='rs318'||records.has(chosen))?chosen:'none';renderDetails();

  }


  function packageBytes(record){return (record.kind==='resources'?0:(record.binaryOverrides||[]).reduce((sum,r)=>sum+(r.blob?.size||0),0))+record.adaptedDlc.size+(!record.kind?(record.replacementResources||[]).reduce((sum,r)=>sum+(r.blob?.size||0),0):0)+(record.textOverrides||[]).filter(p=>p.blob!==record.adaptedDlc).reduce((sum,p)=>sum+(p.blob?.size||0),0);}
  function displayName(record){if(record.kind)return record.label||record.packName;return record.models.includes('rs318')?'Audi RS3 Sportback (2018)':record.models.includes('corsa05')?'Opel Corsa (2005)':record.manifest?.replacement?record.manifest.compatibility.vehicleInfo[0].label:record.packName;}
  function trafficCell(entry,story){
    const cell=document.createElement('td'),label=document.createElement('label'),toggle=document.createElement('input'),state=document.createElement('span');
    const record=records.get(entry.id),preferences=story?storyTrafficPreferences:trafficPreferences,mode=story?'Story':'Sandbox';
    const keys=canTraffic(record)?record.models.map(model=>record.id+':'+model):[],count=keys.filter(key=>preferences[key]).length;
    label.className='mod-switch mod-traffic-switch';toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',mode+' traffic for '+entry.name);toggle.id='mod-'+mode.toLowerCase()+'-'+entry.id;
    toggle.checked=keys.length>0&&count===keys.length;toggle.indeterminate=count>0&&count<keys.length;toggle.disabled=busy||!canTraffic(record)||!enabledPackages.has(entry.id);state.textContent=toggle.indeterminate?'Some':toggle.checked?'On':'Off';
    toggle.onchange=()=>{
      if(toggle.checked){const others=enabledTraffic(story?'story':'sandbox').filter(row=>row.id!==entry.id).length;if(others+keys.length>limits.trafficModels){$('mod-result').textContent='Enable traffic for at most '+limits.trafficModels+' models per mode.';renderTable();return;}}
      for(const key of keys){if(toggle.checked)preferences[key]=true;else delete preferences[key];}
      try{localStorage.setItem(story?STORY_TRAFFIC_PREF:TRAFFIC_PREF,JSON.stringify(preferences));}catch(_){$('mod-result').textContent='Traffic choices apply to this page only; browser storage is unavailable.';}
      syncTraffic();renderTable();savePreferences();$(toggle.id)?.focus();
    };
    label.append(toggle,state);cell.append(label);return cell;
  }

  function renderConflicts(){if(!window.GTAModProfiles)return;const node=$('mod-conflict-report'),issues=GTAModProfiles.analyse([...records.values()].filter(r=>enabledPackages.has(r.id)));node.replaceChildren();node.hidden=!issues.length;for(const issue of issues.slice(0,64)){const row=document.createElement('p');row.textContent=(issue.severity==='error'?'Conflict: ':'Dependency: ')+issue.message;node.append(row);}}
  function refreshProfiles(chosen=''){if(!window.GTAModProfiles)return;const select=$('mod-profile-select');select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Select a profile';select.append(empty);for(const p of GTAModProfiles.list()){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;select.append(o);}select.value=chosen;}
  function setupProfiles(){if(!window.GTAModProfiles)return;const status=$('mod-profile-status'),selectedProfile=()=>GTAModProfiles.list().find(p=>p.id===$('mod-profile-select').value),guard=fn=>async()=>{try{await fn();}catch(e){status.textContent=e.message;}};
   try{refreshProfiles();}catch(e){status.textContent='Stored profiles could not be read: '+e.message;}$('mod-profile-new').onclick=()=>{$('mod-profile-select').value='';$('mod-profile-name').value='';status.textContent='Enter a name and save the current mod selection.';};$('mod-profile-select').onchange=guard(()=>{const p=selectedProfile();$('mod-profile-name').value=p?.name||'';const missing=(p?.packages||[]).filter(x=>!records.has(x.id));status.textContent=missing.length?'Missing packages: '+missing.map(x=>x.label).join(', '):p?'Profile ready to apply.':'Select or save a profile.';});
   $('mod-profile-save').onclick=guard(()=>{const p=GTAModProfiles.save({id:selectedProfile()?.id,name:$('mod-profile-name').value,preferences:currentPreferences(),packages:[...enabledPackages].filter(id=>records.has(id)).map(id=>({id,label:displayName(records.get(id))})),updatedAt:Date.now()});refreshProfiles(p.id);status.textContent='Saved '+p.name;});
   $('mod-profile-apply').onclick=guard(async()=>{const p=selectedProfile();if(!p)throw Error('Select a profile');if(window.GTASaveProfiles)GTASaveProfiles.select(p.preferences.saveProfile||'default');await applyPreferences(p.preferences);const missing=p.packages.filter(x=>!records.has(x.id));status.textContent='Applied '+p.name+(missing.length?'; missing packages stayed disabled: '+missing.map(x=>x.label).join(', '):'. Restart the game to apply.');});
   $('mod-profile-export').onclick=guard(()=>{const p=selectedProfile();if(!p)throw Error('Select a saved profile');GTAUserMods.download(new Blob([GTAModProfiles.encode(p)],{type:'application/json'}),'grandv-mod-profile.json');});
   $('mod-profile-import').onchange=async event=>{try{const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>524288)throw Error('Profile exceeds 512 KiB');const p=GTAModProfiles.save(GTAModProfiles.decode(await file.text()));refreshProfiles(p.id);$('mod-profile-name').value=p.name;status.textContent='Imported '+p.name+'; select Apply profile to use it.';}catch(e){status.textContent=e.message;}};
   $('mod-profile-remove').onclick=guard(()=>{const p=selectedProfile();if(!p)return;GTAModProfiles.remove(p.id);refreshProfiles();status.textContent='Deleted profile '+p.name;});
  }
  function renderTable(){
    renderConflicts();const body=$('mod-table-body');body.replaceChildren();
    const entries=[...records.values()].map(record=>({id:record.id,name:displayName(record),models:record.kind==='shader'?record.shaderReplacements.length+' shader programs':(record.kind?record.kind+' · ':'')+record.models.join(', '),size:(record.kind==='shader'?(packageBytes(record)/1048576).toFixed(1):Math.round(packageBytes(record)/1048576))+' MiB'}));

    for(const entry of entries){
      const row=document.createElement('tr');row.dataset.selected=String($('mod-preset').value===entry.id);
      const cell=document.createElement('td'),label=document.createElement('label'),toggle=document.createElement('input'),state=document.createElement('span');
      label.className='mod-switch';toggle.type='checkbox';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Enable '+entry.name);toggle.checked=enabledPackages.has(entry.id)||(entry.id==='rs318'&&installingAudi);toggle.disabled=busy;toggle.id='mod-enable-'+entry.id;state.textContent=toggle.checked?'On':'Off';
      toggle.onchange=async()=>{
        const previous=new Set(enabledPackages);
        try{
          if(toggle.checked){
            if(enabledPackages.size>=limits.packages&&!enabledPackages.has(entry.id))throw new Error('Enable at most '+limits.packages+' packages at once.');
            if(entry.id==='rs318'){await installBundledHomer();return;}
            const upgradeAudi=enabledPackages.has('rs318');
            enabledPackages.delete('rs318');enabledPackages.add(entry.id);
            if(upgradeAudi)await installBundledHomer();
          }else enabledPackages.delete(entry.id);
          renderTable();renderTrafficPool();savePreferences();$('mod-enable-'+entry.id)?.focus();
        }catch(error){enabledPackages=previous;renderTable();renderTrafficPool();savePreferences();$('mod-result').textContent=error.message;}
      };
      label.append(toggle,state);cell.append(label);row.append(cell);
      const info=document.createElement('td'),name=document.createElement('strong'),models=document.createElement('small');name.textContent=entry.name;models.textContent=entry.models+' · '+entry.size;info.append(name,models);row.append(info);
      for(const story of [false,true])row.append(trafficCell(entry,story));
      const actions=document.createElement('td');if(entry.id!=='rs318'){const button=document.createElement('button');button.type='button';button.className='quiet';button.textContent='Options';button.id='mod-options-'+entry.id;button.setAttribute('aria-controls','mod-package-options');button.setAttribute('aria-expanded',String($('mod-preset').value===entry.id));button.setAttribute('aria-label','Options for '+entry.name);button.disabled=busy;button.onclick=()=>{$('mod-preset').value=entry.id;renderDetails();savePreferences();$('mod-selected-title').focus({preventScroll:true});$('mod-package-options').scrollIntoView({block:'start',behavior:'smooth'});};actions.append(button);}row.append(actions);body.append(row);
    }
    $('mod-enabled-summary').textContent=enabledPackages.size?[...enabledPackages].map(id=>id==='rs318'?'Audi RS3 (upgrade on next package toggle)':displayName(records.get(id))).join(', ')+' enabled':'All mods off — normal game.';
  }

  async function installBundledHomer(){
    const response=await fetch('/_mods/simpsons-homer-v1/Homer-Simpson.rar',{cache:'no-store'});
    if(!response.ok)throw Error('Bundled Homer Simpson package unavailable');
    await importAddon(new File([await response.blob()],'Homer-Simpson.rar'),'Homer Simpson by Quechus13');
  }

  async function importAddon(file,sourceCredit){

    if(!(file instanceof Blob))throw new Error('Package data unavailable');

    if(file.size>128*1048576)throw new Error('Archive exceeds 128 MiB.');

    busy=true;$('start').disabled=true;$('mod-import').disabled=true;$('mod-install-corsa').disabled=true;$('mod-install-colour-shader').disabled=true;$('mod-install-monochrome-shader').disabled=true;$('mod-install-bloom-shader').disabled=true;$('mod-install-rcas-shader').disabled=true;$('mod-install-cinematic-shader').disabled=true;$('mod-install-lut').disabled=true;$('mod-install-homer').disabled=true;renderTable();$('mod-preset').disabled=true;$('mod-result').textContent='Inspecting archive and classic DLC resources…';let worker,abortRequest=()=>{},previewActive=false;

    try{

      const [response,handlingResponse,indexResponse]=await Promise.all([fetch('/data/common/data/levels/gta5/vehicles.meta',{cache:'no-store'}),fetch('/data/common/data/handling.meta',{cache:'no-store'}),fetch('/mod_replacement_index.json').catch(()=>null)]);const detectedIndex=indexResponse?.ok?await indexResponse.json():undefined;if(!response.ok)throw new Error('Base vehicle metadata unavailable');if(!handlingResponse.ok)throw new Error('Base handling metadata unavailable');const baseHandlingXml=await handlingResponse.text();

      const xml=await response.text(),models=Array.from(xml.matchAll(/<modelName>\s*([^<]+)\s*<\/modelName>/g),match=>match[1].trim().toLowerCase());

      const zip=await file.arrayBuffer();worker=new Worker('/mod_converter_worker.js?v=shader-data-v2',{type:'module'});
      let requestId=0;
      function request(type,data={},transfer=[]){return new Promise((resolve,reject)=>{
        const id=++requestId,finish=()=>{clearTimeout(timeout);abortRequest=()=>{};},timeout=setTimeout(()=>{finish();reject(new Error('Inspection timed out; no package installed'));},60000);
        abortRequest=()=>{finish();reject(new Error('Import cancelled'));};
        worker.onerror=error=>{finish();reject(new Error(error.message||'Converter failed'));};
        worker.onmessage=message=>{const value=message.data;if(value.id!==id)return;finish();if(value.type==='error')reject(new Error(value.message));else resolve(value);};
        worker.postMessage({type,id,...data},transfer);
      });}
      const inspection=await request('inspect',{zip,archiveName:file.name,baseVehicleXml:xml,baseVehicleModels:models,baseHandlingXml,compatibilityIndex:detectedIndex},[zip]),panel=$('mod-import-preview'),select=$('mod-import-candidate'),details=$('mod-import-findings'),install=$('mod-import-confirm'),cancel=$('mod-import-cancel');
      select.replaceChildren();for(const candidate of inspection.candidates){const option=document.createElement('option');option.value=candidate.entryPath;option.textContent=(candidate.label||(candidate.kind==='replacement'?'Convert '+candidate.sourceModel+' replacement':candidate.entryPath))+' · '+(candidate.bytes/1048576).toFixed(1)+' MiB';select.append(option);}
      const multiple=inspection.candidates.length>1;$('mod-import-choice').hidden=!multiple;install.textContent=multiple?'Install selected package':'Install detected mod';
      previewActive=true;panel.hidden=false;panel.scrollIntoView({block:'nearest'});(multiple?select:cancel).focus();
      let converted=null,lastContentEntry=null;
      const pedCategory=ped=>ped.startsWith('ig_')?'Story characters':ped.startsWith('a_m_')?'Ambient male':ped.startsWith('a_f_')?'Ambient female':ped.startsWith('g_')?'Gang members':ped.startsWith('s_')?'Service and workers':ped.startsWith('u_')?'Special characters':'Multiplayer characters';
      function populatePedTargets(candidate,reset=false){
        const group=$('mod-target-ped-group'),slot=$('mod-target-ped'),targets=candidate.targetPeds||[],used=new Set([...records.values()].flatMap(r=>(r.manifest?.content?.peds||[]).map(p=>p.model))),preferred=targets.slice(0,5);let chosen=slot.value;
        if(reset)chosen=targets.find(p=>!used.has(p))||targets[0];
        const categories=['Suggested slots',...new Set(targets.map(pedCategory))],current=group.value;group.replaceChildren();for(const name of categories){const option=document.createElement('option');option.value=name;option.textContent=name;group.append(option);}group.value=reset?(preferred.includes(chosen)?'Suggested slots':pedCategory(chosen)):(categories.includes(current)?current:categories[0]);
        const visible=group.value==='Suggested slots'?preferred:targets.filter(p=>pedCategory(p)===group.value);slot.replaceChildren();for(const ped of visible){const option=document.createElement('option');option.value=ped;option.textContent=ped+(used.has(ped)?' (used by an installed skin)':'');slot.append(option);}if(visible.includes(chosen))slot.value=chosen;
      }

      async function inspectSelected(){
        const candidate=inspection.candidates.find(c=>c.entryPath===select.value),kind=candidate?.kind;$('mod-import-detection').textContent=(inspection.candidates.length===1?'Automatically detected: ':'')+(candidate?.reason?.replace(/^Detected (?:an? )?/,'')||candidate?.label||'Compatible package')+(inspection.candidates.length>1?' This archive contains multiple packages or variants; choose which to install.':'');if(lastContentEntry!==select.value){if(kind==='ped'){populatePedTargets(candidate,true);$('mod-ped-mode').value=candidate.textureOnly?'replace':'addon';}if(candidate?.clothingPed)$('mod-clothing-ped').value=candidate.clothingPed;if(candidate?.textureLetter)$('mod-clothing-textures').value=candidate.textureLetter;if(kind==='ped'&&candidate.textureOnly)$('mod-target-ped').value=candidate.sourceModel;lastContentEntry=select.value;}$('mod-reinspect').hidden=!['ped','clothing','animation'].includes(kind);$('mod-content-ped-options').hidden=kind!=='ped';$('mod-ped-replacement-options').hidden=$('mod-ped-mode').value==='addon';if(kind==='ped')$('mod-ped-mode').querySelector('option[value=addon]').disabled=!!candidate?.textureOnly;$('mod-content-clothing-options').hidden=kind!=='clothing';$('mod-content-animation-options').hidden=kind!=='animation';
        for(const id of ['mod-ped-mode','mod-target-ped-group','mod-target-ped','mod-clothing-ped','mod-clothing-textures','mod-animation-clips','mod-reinspect'])$(id).disabled=true;
        converted=null;install.disabled=true;select.disabled=true;details.replaceChildren();details.textContent='Inspecting selected package…';
        try{const baseConfigFiles={};if(kind==='config'||select.value.startsWith('oiv:'))await Promise.all((candidate.targets||inspection.configPaths||[]).map(async path=>{const res=await fetch('/data/'+path,{cache:'no-store'});if(res.ok)baseConfigFiles[path]=await res.text();}));let compatibilityIndex=detectedIndex;if(kind==='resources'&&!compatibilityIndex){const res=await fetch('/mod_replacement_index.json',{cache:'no-store'});if(!res.ok)throw new Error('Replacement compatibility index unavailable');compatibilityIndex=await res.json();}converted=await request('convert',{baseConfigFiles,baseHandlingXml,compatibilityIndex,entryPath:select.value,baseVehicleModels:models,baseVehicleXml:xml,sourceCredit,pedMode:$('mod-ped-mode').value,targetPed:$('mod-target-ped').value,clothingPed:$('mod-clothing-ped').value,clothingTextures:$('mod-clothing-textures').value,animationClips:$('mod-animation-clips').value});if(!previewActive)return;if(converted.kind==='shader'){details.textContent='Checking shader interfaces and WebGPU compilation…';await GTAShaderMods.review(converted.shaderReplacements);if(!previewActive)return;converted.manifest.compatibility.warnings.push({code:'SHADER_CHECKED',message:'Installed source hashes, resource interfaces and browser WebGPU compilation passed for every program. In-game visual/performance testing is still required.'});}
          if(inspection.ignoredZipEntries.some(x=>x.reason==='FiveM manifest (not executed)'))converted.manifest.compatibility.warnings.push({code:'FIVEM_DATA_ONLY',message:'FiveM manifest ignored. Only compatible assets are imported; FiveM scripts, events, metadata registration and server behaviour are not provided.'});
          if(/\.oiv$/i.test(file.name||'')&&!converted.manifest.oiv)converted.manifest.compatibility.warnings.push({code:'OIV_DATA_ONLY',message:'Data-only OIV import: installer actions and assembly.xml commands are not executed. Only the inspected compatible resources are installed.'});
          if(converted.replacementResources?.length){const res=await fetch('/mod_replacement_index.json',{cache:'no-store'});if(!res.ok)throw new Error('Replacement compatibility index unavailable');const idx=await res.json();const mounted=[];for(const r of converted.replacementResources){if(idx.archives[r.archive]?.entries[r.path.toLowerCase()])mounted.push(r);else if(/\+hi\.ytd$/i.test(r.path))converted.manifest.compatibility.warnings.push({code:'OPTIONAL_TEXTURE',message:'Not used by this build: '+r.path});else throw new Error('Replacement slot unavailable in this build: '+r.path);}converted.replacementResources=mounted;converted.manifest.replacementTargets=[...mounted.map(r=>r.archive+'/'+r.path.toLowerCase()),...(converted.binaryOverrides||[]).map(p=>p.path),...(converted.textOverrides||[]).map(p=>p.path)];}
          if(!previewActive)return;details.replaceChildren();
          const summary=document.createElement('p');summary.textContent=(converted.kind==='shader'?'Shaders: '+converted.shaderReplacements.length:(converted.kind?'Content: ':'Vehicles: ')+converted.models.join(', '))+' · '+(converted.kind==='shader'?'Pack ':converted.kind==='config'?'Settings ':'DLC ')+(packageBytes(converted)/1048576).toFixed(1)+' MiB · '+String(converted.sourceArchive?.format||'zip').toUpperCase()+' '+((converted.sourceArchive?.bytes||inspection.zipBytes)/1048576).toFixed(1)+' MiB';details.append(summary);
          const ignored=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Ignored files (documentation, previews, manifests or unsupported audio) ('+inspection.ignoredZipEntries.length+')';ignored.append(heading);
          const ignoredList=document.createElement('ul');for(const item of inspection.ignoredZipEntries){const li=document.createElement('li');li.textContent=item.path;ignoredList.append(li);}ignored.append(ignoredList);details.append(ignored);
          const findings=document.createElement('ul');for(const warning of converted.manifest.compatibility.warnings){const li=document.createElement('li');li.textContent=warning.message;findings.append(li);}for(const adaptation of converted.manifest.audio){const li=document.createElement('li');li.textContent='Audio adapted: '+adaptation.from+' → '+adaptation.to;findings.append(li);}details.append(findings);
          if(converted.replacementResources?.length||converted.binaryOverrides?.length||converted.textOverrides?.length){const group=document.createElement('details'),heading=document.createElement('summary'),list=document.createElement('ul'),targets=[...(converted.manifest.resources||[]),...(converted.textOverrides||[]).map(p=>({sourcePath:'Adapted stock settings',targetPath:p.path,archive:''}))];heading.textContent='Replacement targets ('+targets.length+')';group.append(heading);for(const row of targets){const li=document.createElement('li');li.textContent=row.sourcePath+' → '+(row.archive?row.archive+'/':'')+row.targetPath;list.append(li);}group.append(list);details.append(group);}

          install.disabled=false;
          $('mod-result').textContent='Review the findings, then install the selected package or cancel.';
        }catch(error){if(previewActive)details.textContent='Cannot install this package: '+error.message;}finally{if(previewActive){select.disabled=false;for(const id of ['mod-ped-mode','mod-target-ped-group','mod-target-ped','mod-clothing-ped','mod-clothing-textures','mod-animation-clips','mod-reinspect'])$(id).disabled=false;}}
      }
      const closePreview=()=>cancel.onclick?.();$('mods-dialog').addEventListener('close',closePreview);
      const result=await new Promise(resolve=>{
        cancel.onclick=()=>{previewActive=false;abortRequest();resolve(null);};install.onclick=()=>{if(converted&&!install.disabled){previewActive=false;resolve(converted);}};$('mod-target-ped-group').onchange=()=>{const candidate=inspection.candidates.find(c=>c.entryPath===select.value);populatePedTargets(candidate);install.disabled=true;};$('mod-ped-mode').onchange=inspectSelected;select.onchange=inspectSelected;$('mod-reinspect').onclick=inspectSelected;for(const id of ['mod-ped-mode','mod-target-ped-group','mod-target-ped','mod-clothing-ped','mod-clothing-textures','mod-animation-clips'])$(id).oninput=()=>{install.disabled=true;};void inspectSelected();
      });
      $('mods-dialog').removeEventListener('close',closePreview);
      panel.hidden=true;select.onchange=install.onclick=cancel.onclick=null;
      if(!result){$('mod-result').textContent='Import cancelled; no package installed.';return;}

      const record=await GTAUserMods.save(result);await refresh(record.id);if(enabledPackages.size<limits.packages||enabledPackages.has('rs318')){enabledPackages.delete('rs318');enabledPackages.add(record.id);}renderDetails();savePreferences();$('mod-result').textContent='Installed '+displayName(record)+(enabledPackages.has(record.id)?'. Enabled for the next launch.':'. Enable it in the table when a package slot is available.')+(record.manifest.ignoredZipEntries?.length?' Ignored '+record.manifest.ignoredZipEntries.length+' auxiliary/unsupported files.':'');

    }finally{previewActive=false;abortRequest();$('mod-import-preview').hidden=true;worker?.terminate();busy=false;$('start').disabled=false;$('mod-import').disabled=false;$('mod-install-corsa').disabled=false;$('mod-install-colour-shader').disabled=false;$('mod-install-monochrome-shader').disabled=false;$('mod-install-bloom-shader').disabled=false;$('mod-install-rcas-shader').disabled=false;$('mod-install-cinematic-shader').disabled=false;$('mod-install-lut').disabled=false;$('mod-install-homer').disabled=false;renderTable();$('mod-preset').disabled=false;}

  }

  window.GTAModLaunch={normalisePreferences,currentPreferences,applyPreferences,prepare(mode,multiplayer){

    $('mods-error').textContent='';
    const ids=[...enabledPackages],value=ids[0]||'none',enabled=ids.length>0,record=records.get(value),trainer=mode==='sandbox'?$('mod-trainer-sandbox').checked:mode==='story'?$('mod-trainer-story').checked:false,selections=record?enabledTraffic(mode):[],storyTraffic=mode==='story'&&selections.length>0;
    const stop=message=>{$('mods-error').textContent=message;$('mods-dialog').showModal();return null;};
    if(busy)return stop('Wait for import to complete.');
    if((enabled||trainer)&&multiplayer)return stop('Modded multiplayer needs content matching; use single-player.');
    if(enabled&&mode!=='sandbox'&&!storyTraffic&&!trainer)return stop('Enable the Story trainer or Story traffic to use vehicle mods in Story.');
    if(!enabled)return {enabled:false,trainer};if(window.GTAModProfiles){const conflict=GTAModProfiles.analyse(ids.map(id=>records.get(id)).filter(Boolean)).find(x=>x.severity==='error');if(conflict)return stop(conflict.message);}
    if(value==='rs318')return {enabled:true,trainer};
    if(ids.length>limits.packages||ids.some(id=>!records.has(id)))return stop('Enable at most '+limits.packages+' installed mod packages.');
    if(ids.reduce((sum,id)=>sum+records.get(id).adaptedDlc.size,0)>limits.dlcBytes)return stop('Enabled mod packages exceed the '+(limits.dlcBytes/1048576)+' MiB combined limit.');
    if(selections.length>limits.trafficModels)return stop('Enable at most '+limits.trafficModels+' traffic models.');
    const model=$('mod-preset').value===record.id&&record.models.includes($('mod-model').value)?$('mod-model').value:record.models[0];
    return {enabled:true,trainer,storyTraffic,trafficShare:currentPreferences().trafficShare,traffic:selections.length>0,selections,id:record.id,model,packages:ids};

  }};

  document.addEventListener('DOMContentLoaded',async()=>{

    $('mods-open').onclick=()=>$('mods-dialog').showModal();$('mod-options-close').onclick=()=>{$('mod-preset').value='none';renderDetails();savePreferences();};for(const id of ['mod-trainer-sandbox','mod-trainer-story','mod-traffic-share'])$(id).onchange=savePreferences;$('mod-preset').onchange=()=>{renderDetails();savePreferences();};$('mod-model').onchange=()=>{syncTraffic();savePreferences();};$('mod-traffic').onchange=()=>{saveTraffic();savePreferences();};$('mod-story-traffic').onchange=()=>{saveTraffic(true);savePreferences();};

    $('reset-settings').addEventListener('click',()=>{trafficPreferences={};storyTrafficPreferences={};$('mod-traffic-share').value='5';try{localStorage.setItem(TRAFFIC_PREF,'{}');localStorage.setItem(STORY_TRAFFIC_PREF,'{}');}catch(_){};enabledPackages.clear();$('mod-preset').value='none';$('mod-trainer-sandbox').checked=false;$('mod-trainer-story').checked=false;renderDetails();savePreferences();});

    let stored={};try{stored=JSON.parse(localStorage.getItem(PREF)||'{}');}catch(_){}

    ready=refresh();await ready;setupProfiles();if(new URLSearchParams(location.search).get('carmod')==='rs318-test')stored={package:'rs318'};await applyPreferences(stored);

    $('mod-import').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{await importAddon(file,file.name);}catch(error){$('mod-result').textContent='Import rejected: '+error.message;}};

    $('mod-install-homer').onclick=async()=>{try{await installBundledHomer();}catch(error){$('mod-result').textContent='Homer install failed: '+error.message;}};
    $('mod-install-colour-shader').onclick=async()=>{try{const response=await fetch('/_mods/shader-colour-v1/sweetfx-vibrance.zip',{cache:'no-store'});if(!response.ok)throw Error('Colour shader example unavailable');await importAddon(new File([await response.blob()],'sweetfx-vibrance.zip'),'SweetFX Vibrance by CeeJay.dk (MIT), WGSL port');}catch(error){$('mod-result').textContent='Shader import failed: '+error.message;}};
    $('mod-install-lut').onclick=async()=>{try{const response=await fetch('/_mods/lut-v1/warm-film.cube',{cache:'no-store'});if(!response.ok)throw Error('LUT example unavailable');await importAddon(new File([await response.blob()],'warm-film.cube'),'Original GrandV warm-film SDR CUBE example');}catch(error){$('mod-result').textContent='LUT import failed: '+error.message;}};
    for(const mode of ['bloom','rcas','cinematic'])$('mod-install-'+mode+'-shader').onclick=async()=>{try{const response=await fetch('/_mods/shader-spatial-v1/'+mode+'.zip',{cache:'no-store'});if(!response.ok)throw Error('Spatial shader pack unavailable');await importAddon(new File([await response.blob()],mode+'.zip'),'Spatial world effects: bloom / AMD FidelityFX RCAS (MIT). Review performance notes.');}catch(error){$('mod-result').textContent='Shader import failed: '+error.message;}};
    $('mod-install-monochrome-shader').onclick=async()=>{try{const response=await fetch('/_mods/shader-colour-v1/sweetfx-monochrome.zip',{cache:'no-store'});if(!response.ok)throw Error('Monochrome shader example unavailable');await importAddon(new File([await response.blob()],'sweetfx-monochrome.zip'),'SweetFX Monochrome by CeeJay.dk (MIT), WGSL port');}catch(error){$('mod-result').textContent='Shader import failed: '+error.message;}};
    $('mod-install-corsa').onclick=async()=>{try{const response=await fetch('/_mods/opel-corsa-2005-v1/corsa05.addon-normalized.zip',{cache:'no-store'});if(!response.ok)throw new Error('Bundled Corsa package unavailable');await importAddon(await response.blob(),'Bundled Opel Corsa 2005 add-on');}catch(error){$('mod-result').textContent='Corsa install failed: '+error.message;}};

    $('mod-export-original').onclick=()=>{const record=selected();if(record)GTAUserMods.download(record.originalZip||record.originalDlc,record.packName+(record.originalZip?'.source.'+(record.sourceArchive?.format||'zip'):'.original.rpf'));};

    $('mod-export-adapted').onclick=async()=>{const record=selected();if(record?.kind==='resources'){try{const {storedZip}=await import('./mod_archive.js'),files=await Promise.all([...(record.binaryOverrides||[]).map(p=>({path:p.path,blob:p.blob})),...(record.replacementResources||[]).map(p=>({path:p.archive+'/'+p.path,blob:p.blob}))].map(async p=>({path:p.path,bytes:new Uint8Array(await p.blob.arrayBuffer())})));GTAUserMods.download(new Blob([storedZip(files)],{type:'application/zip'}),record.packName+'.adapted-resources.zip');}catch(error){$('mod-result').textContent='Export failed: '+error.message;}return;}if(record?.kind==='config'){const files=await Promise.all(record.textOverrides.map(async p=>({path:p.path,baseHash:p.baseHash,text:await p.blob.text()})));GTAUserMods.download(new Blob([JSON.stringify({format:'gta-adapted-settings-v1',files},null,2)]),record.packName+'.settings.json');return;}if(record)GTAUserMods.download(record.adaptedDlc,record.packName+(record.kind==='shader'?'.shader-pack.zip':record.kind==='handling'?'.handling.meta':'.browser-adapted.rpf'));};

    $('mod-export-report').onclick=()=>{const record=selected();if(record)GTAUserMods.download(new Blob([JSON.stringify(record.manifest,null,2)],{type:'application/json'}),record.packName+'.conversion.json');};

    $('mod-remove').onclick=()=>{if(selected())$('mod-remove-dialog').showModal();};

    $('mod-remove-cancel').onclick=()=>$('mod-remove-dialog').close();

    $('mod-remove-confirm').onclick=async()=>{const record=selected();if(!record)return;try{await GTAUserMods.remove(record.id);$('mod-remove-dialog').close();await refresh();savePreferences();$('mod-result').textContent='Local package removed. Base assets and saves kept.';}catch(error){$('mod-result').textContent='Could not remove package: '+error.message;$('mod-remove-dialog').close();}};

  });

})();

