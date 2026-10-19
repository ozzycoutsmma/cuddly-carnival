/* Mode-scoped portable saves. Mode changes cannot retarget an in-flight import. */
(()=>{
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const api=window.GTAUserdataPersistence,settings=window.GTALauncherSettings,$=id=>document.getElementById(id);
    const status=text=>$('save-status').textContent=text;
    let db=null,active=null,busy=false,revision=0,available=false;
    const target=()=>{const scope=api.scope(settings.currentSettings().mode);return {scope,...(window.GTASaveProfiles?GTASaveProfiles.resolve(localStorage,scope):{profile:api.profile(localStorage,scope),legacy:true,name:'Default'})};};
    const same=value=>active&&active.scope===value.scope&&active.profile===value.profile;
    function controls(){
      $('export-save').disabled=busy||!available;$('import-save').disabled=busy||!available||!db;
      $('import-label').classList.toggle('disabled',$('import-save').disabled);
      $('undo-import').disabled=busy||!available||!db||!active||!localStorage.getItem('gta5.lastImport.'+active.profile);
    }
    function lock(value){busy=value;for(const id of ['save-profile-select','save-profile-create','save-profile-rename','mod-profile-apply'])if($(id))$(id).disabled=value;$('start').disabled=value;$('reset-settings').disabled=value;document.querySelectorAll('input[name=mode]').forEach(input=>input.disabled=value);controls();}
    async function refresh(force=false){
      if(busy)return;const next=target();if(!force&&same(next))return;
      active=next;available=false;controls();const version=++revision,title=(next.scope==='story'?'Story':'Sandbox')+' — '+next.name;
      $('saves-heading').textContent=title+' save data';
      $('save-scope-note').textContent='Export '+title+' saves and launcher settings. Imports restore both. Story and Sandbox saves are separate. Mod files and access codes are excluded.';
      status('Reading '+title+' saves…');
      try{const files=await api.restore(db,next.profile,fetch,next.scope,next.legacy);if(version!==revision)return;const count=[...files.values()].filter(row=>!row.deleted).length;available=true;status(title+': '+count+' saved file'+(count===1?'':'s')+(db?'':' · disk only'));}
      catch(error){if(version===revision)status('Save storage unavailable: '+error.message);}
      if(version===revision)controls();
    }
    if(!api||!settings){status('Save helper unavailable');return;}
    window.addEventListener('gta-save-profile',()=>refresh().catch(error=>status(error.message)));
    window.addEventListener('gta-launcher-settings',()=>refresh().catch(error=>status(error.message)));
    try{db=await api.open();}catch(_){}
    await refresh(true);
    $('export-save').onclick=async()=>{
      const selected=target(),prefs=settings.currentSettings();lock(true);
      try{const bundle=await api.exportProfile(db,selected.profile,false,fetch,selected.scope,selected.legacy);bundle.launcherSettings=prefs;bundle.launcherConfig=window.GTALauncherConfig.snapshot();
        const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'})),link=document.createElement('a');
        link.href=url;link.download='gta5-'+selected.scope+'-saves-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status(selected.scope+': '+bundle.files.length+' save entries and web UI settings/configuration exported');
      }catch(error){status('Export failed: '+error.message);}finally{lock(false);}
    };
    $('import-save').onchange=async event=>{
      const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>90*1048576){status('Import exceeds90 MiB');return;}
      const selected=target(),previous=JSON.stringify(settings.currentSettings()),previousConfig=JSON.stringify(window.GTALauncherConfig.snapshot());let imported=false;lock(true);
      try{const bundle=JSON.parse(await file.text());if(bundle.launcherConfig)window.GTALauncherConfig.validate(bundle.launcherConfig);const token=await api.importBundle(db,selected.profile,bundle,selected.scope,selected.legacy);
        localStorage.setItem('gta5.lastImport.'+selected.profile,token);localStorage.setItem('gta5.preImportSettings.'+selected.profile,previous);
        localStorage.setItem('gta5.preImportConfig.'+selected.profile,previousConfig);
        imported=true;
        if(bundle.launcherSettings)settings.applySettings(bundle.launcherSettings);
        if(bundle.launcherConfig)await window.GTALauncherConfig.apply(bundle.launcherConfig);
        status(selected.scope+': '+bundle.files.length+' files imported'+(api.warnings.length?' · browser saved; disk backup unavailable':''));
      }catch(error){status((imported?'Saves imported; preference restore failed. Undo import is available: ':'Import rejected: ')+error.message);}finally{lock(false);}
    };
    $('undo-import').onclick=async()=>{
      const selected=target(),token=localStorage.getItem('gta5.lastImport.'+selected.profile);if(!token)return;lock(true);
      try{await api.rollbackImport(db,selected.profile,token,selected.scope,selected.legacy);localStorage.removeItem('gta5.lastImport.'+selected.profile);
        const previous=localStorage.getItem('gta5.preImportSettings.'+selected.profile);if(previous)settings.applySettings(JSON.parse(previous));localStorage.removeItem('gta5.preImportSettings.'+selected.profile);
        const previousConfig=localStorage.getItem('gta5.preImportConfig.'+selected.profile);if(previousConfig)await window.GTALauncherConfig.apply(JSON.parse(previousConfig));localStorage.removeItem('gta5.preImportConfig.'+selected.profile);
        status(selected.scope+': import undone'+(api.warnings.length?' · disk backup unavailable':''));
      }catch(error){status('Undo failed: '+error.message);}finally{lock(false);}
    };
  });
})();
