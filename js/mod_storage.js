/* Per-save-profile local mod packages. No uploads and no base-cache writes. */
(function(root){
  'use strict';
  const DB='gta5-mods-v1',STORE='packages';
  const limits=Object.freeze({packages:64,dlcBytes:512*1048576,trafficModels:16});
  function profile(){return root.GTAUserdataPersistence.profile(localStorage);}
  function open(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function transaction(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),request=action(tx.objectStore(STORE));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Mod storage aborted'));});}finally{db.close();}}
  async function save(result){
    if(result.manifest?.format!=='gta-classic-addon-v1'||!result.models?.length||!(result.adaptedDlc instanceof Blob))throw new Error('Invalid converted package');
    const digest=result.manifest.packageIdentity||result.manifest.sourceZip.sha256;
    if(!/^[a-f0-9]{64}$/.test(digest))throw new Error('Package identity missing');
    const id=digest.slice(0,24),record={...result,id,key:profile()+':'+id,importedAt:Date.now()};
    await transaction('readwrite',store=>store.put(record));return record;
  }
  async function list(){const records=await transaction('readonly',store=>store.getAll());return records.filter(record=>record.key.startsWith(profile()+':'));}
  async function get(id){if(!/^[a-f0-9]{24}$/.test(id||''))throw new Error('Invalid mod identity');return transaction('readonly',store=>store.get(profile()+':'+id));}
  async function remove(id){const record=await get(id);if(record)await transaction('readwrite',store=>store.delete(record.key));}
  function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function modelHash(name){let h=0;for(const c of new TextEncoder().encode(name.toLowerCase())){h=(h+c)>>>0;h=(h+(h<<10))>>>0;h^=h>>>6;}h=(h+(h<<3))>>>0;h^=h>>>11;return (h+(h<<15))>>>0;}
  function normaliseSelections(value){
    if(!Array.isArray(value)||value.length>limits.trafficModels)throw new Error('Enable at most '+limits.trafficModels+' traffic models');
    const seen=new Set();return value.map(row=>{
      if(!row||!/^[a-f0-9]{24}$/.test(row.id||'')||!/^[a-z0-9_]{1,64}$/.test(row.model||''))throw new Error('Invalid traffic package/model');
      const key=row.id+':'+row.model;if(seen.has(key))throw new Error('Duplicate traffic model');seen.add(key);return {id:row.id,model:row.model};
    });
  }
  async function nativeAudioDlc(item){
    // This bank build opens *.dat151, while retail add-ons supply *.dat151.rel.
    // Change only TOC names in a session Blob; saved/imported package bytes stay intact.
    const blob=item.adaptedDlc;
    if(!item.manifest?.audioMetadata?.some(f=>f.type===151))return blob;
    const header=new Uint8Array(await blob.slice(0,16).arrayBuffer()),view=new DataView(header.buffer);
    if(header.length!==16||view.getUint32(0,true)!==0x52504637||view.getUint32(12,true)!==0x4e45504f)throw new Error('Audio naming adaptation requires an OPEN RPF7 package');
    const count=view.getUint32(4,true),field=view.getUint32(8,true),heap=field&0x0fffffff,shift=(field>>>28)&7,end=16+count*16+heap;
    if(!count||count>4096||heap>1048576||end>blob.size)throw new Error('Invalid audio package name table');
    const toc=new Uint8Array(await blob.slice(0,end).arrayBuffer()),dv=new DataView(toc.buffer),start=16+count*16,entries=[];
    for(let i=0;i<count;i++){
      const row=16+i*16,offset=start+(dv.getUint16(row,true)<<shift);if(offset<start||offset>=end)throw new Error('Invalid audio package name offset');
      let stop=offset;while(stop<end&&toc[stop])stop++;if(stop===end)throw new Error('Unterminated audio package name');
      const name=new TextDecoder().decode(toc.subarray(offset,stop)),sector=toc[row+5]|toc[row+6]<<8|toc[row+7]<<16;
      entries.push({i,offset,stop,name,sector});
    }
    const parents=new Map();for(const e of entries)if(e.sector===0x7fffff){const row=16+e.i*16,first=dv.getUint32(row+8,true),n=dv.getUint32(row+12,true);if(first+n>count)throw new Error('Invalid audio package directory');for(let i=first;i<first+n;i++)parents.set(i,e.i);}
    let changed=false;
    for(const e of entries){
      if(e.sector&0x800000||!/\.dat151\.rel(?:\.nametable)?$/i.test(e.name))continue;
      const name=e.name.replace(/(\.dat151)\.rel(?=\.|$)/i,'$1');
      if(entries.some(other=>other.i!==e.i&&parents.get(other.i)===parents.get(e.i)&&other.name.toLowerCase()===name.toLowerCase()))continue;
      if(entries.some(other=>other.offset>e.offset&&other.offset<=e.stop))throw new Error('Overlapping audio package names');
      toc.fill(0,e.offset,e.stop+1);toc.set(new TextEncoder().encode(name),e.offset);changed=true;
    }
    return changed?new Blob([toc,blob.slice(end)],{type:blob.type}):blob;
  }
  async function mountReplacements(records,rows,overrides){
    const packages=records.filter(x=>['ped','weapon','clothing'].includes(x.kind)||x.replacementResources?.length);if(!packages.length)return;
    const res=await fetch('/mod_replacement_index.json',{cache:'no-store'});if(!res.ok)throw new Error('Replacement compatibility index unavailable');const index=await res.json();
    const grouped=new Map();
    for(const item of packages){if(!item.replacementResources?.length)throw new Error('Reimport '+item.label+' to update replacement mounting');for(const resource of item.replacementResources){if(!grouped.has(resource.archive))grouped.set(resource.archive,[]);grouped.get(resource.archive).push(resource);}}
    for(const [path,resources] of grouped){
      const info=index.archives[path],row=rows.find(r=>r[0]===path);if(!info||!row||row[1]!==info.size)throw new Error('Unsupported base replacement archive: '+path);
      const header=Uint8Array.from(atob(info.header),c=>c.charCodeAt(0)),response=await fetch('/data/'+path,{cache:'no-store',headers:{Range:'bytes=0-'+(header.length-1)}});
      if(response.status!==206)throw new Error('Replacement archive requires bounded range support: '+path);
      const raw=await response.arrayBuffer();if(raw.byteLength!==header.length)throw new Error('Truncated replacement archive header');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==info.headerHash)throw new Error('Base archive changed; replacement index needs rebuilding: '+path);
      const view=new DataView(header.buffer),segments=[{offset:0,blob:new Blob([header])},...(info.baseSegments||[]).map(s=>({offset:s.offset,blob:new Blob([Uint8Array.from(atob(s.bytes),c=>c.charCodeAt(0))])}))];let size=info.size;
      for(const resource of resources){const target=info.entries[resource.path.toLowerCase()];if(!target){if(/\+hi\.ytd$/i.test(resource.path))continue;throw new Error('Replacement slot unavailable in this build: '+resource.path);}
        if(!(resource.blob instanceof Blob)||resource.blob.size>=0xffffff)throw new Error('Invalid replacement resource');size=Math.ceil(size/512)*512;const sector=size/512;if(sector>=0x800000)throw new Error('Replacement archive exceeds address range');
        const at=target.row;for(let i=0;i<3;i++){header[at+2+i]=(resource.blob.size>>>(i*8))&255;header[at+5+i]=((sector|0x800000)>>>(i*8))&255;}view.setUint32(at+8,resource.system,true);view.setUint32(at+12,resource.graphics,true);segments.push({offset:size,blob:resource.blob});size+=resource.blob.size;
      }
      // Blob snapshots its input: create it only after every TOC row is patched.
      segments[0].blob=new Blob([header]);row[1]=size;overrides[path]={kind:'rpf-overlay-v1',baseSize:info.size,size,segments};
    }
  }
  async function mountBinaryOverrides(records,rows,overrides){for(const item of records)for(const patch of item.binaryOverrides||[]){
    if(!/^x64\/textures\/[a-z0-9_+.-]+\.ytd$/i.test(patch.path)||!(patch.blob instanceof Blob)||patch.blob.size>=0xffffff||!/^[a-f0-9]{64}$/.test(patch.baseHash||''))throw Error('Unsupported standalone texture override');
    const row=rows.find(r=>r[0]===patch.path);if(!row||row[1]!==patch.baseBytes||overrides[patch.path])throw Error('Standalone texture target missing, changed or duplicated');
    const header=new DataView(await patch.blob.slice(0,16).arrayBuffer());if(header.byteLength!==16||header.getUint32(0,true)!==0x37435352||header.getUint32(4,true)!==13)throw Error('Standalone texture is not classic RSC7 YTD');
    const response=await fetch('/data/'+patch.path,{cache:'no-store'});if(!response.ok)throw Error('Base texture unavailable');const raw=await response.arrayBuffer();if(raw.byteLength!==patch.baseBytes)throw Error('Base texture size changed; reimport the package');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==patch.baseHash)throw Error('Base texture changed; reimport the package');
    row[1]=patch.blob.size;overrides[patch.path]=patch.blob;
  }}
  async function mountTextOverrides(records,rows,overrides){for(const item of records)for(const patch of item.textOverrides||[]){if(!/^(?:common\/data\/(?:handling\.meta|visualsettings\.dat|(?:Clouds|CloudKeyframes|lensflare(?:_[FMT])?|watertune)\.xml|timecycle\/(?:w_(?:blizzard|clear|clearing|clouds|extrasunny|foggy|neutral|overcast|rain|smog|snow|snowlight|thunder|XMAS)|underwater_deep|timecycle_mods_[1-4])\.xml|levels\/gta5\/weather\.xml|ai\/(?:weapons|weaponcomponents)\.meta))$/.test(patch.path)||!(patch.blob instanceof Blob)||patch.blob.size>4*1048576)throw new Error('Unsupported metadata override');const row=rows.find(r=>r[0]===patch.path);if(!row||overrides[patch.path])throw new Error('Metadata override target missing or duplicated');const response=await fetch('/data/'+patch.path,{cache:'no-store'});if(!response.ok)throw new Error('Base metadata unavailable');const raw=new TextEncoder().encode(await response.text()),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==patch.baseHash)throw new Error('Base metadata changed; reimport the package');row[1]=patch.blob.size;overrides[patch.path]=patch.blob;}}
  async function prepare(id,model){return prepareMany(id,model,[]);}
  async function prepareMany(id,model,trafficSelections=[],enabledPackageIds=[]){
    if(!Array.isArray(enabledPackageIds)||enabledPackageIds.length>limits.packages||enabledPackageIds.some(value=>!/^[a-f0-9]{24}$/.test(value)))throw new Error('Invalid enabled mod packages');
    const traffic=normaliseSelections(trafficSelections),ids=[...new Set([id,...enabledPackageIds,...traffic.map(x=>x.id)])];
    if(ids.length>limits.packages)throw new Error('Load at most '+limits.packages+' mod packages including the selected package');
    const records=await Promise.all(ids.map(get));if(records.some(x=>!x))throw new Error('A selected mod is not imported in this browser');
    const record=records[0];if(!record.models.includes(model))throw new Error('Selected model is not in the imported package');
    for(const entry of traffic)if(records.find(x=>x.id===entry.id).kind||(records.find(x=>x.id===entry.id).manifest?.replacement?.vehicleType&&records.find(x=>x.id===entry.id).manifest.replacement.vehicleType!=='VEHICLE_TYPE_CAR')||!records.find(x=>x.id===entry.id).models.includes(entry.model))throw new Error('Traffic model is not in its imported package');
    const baseResponse=await fetch('/data/common/data/levels/gta5/vehicles.meta',{cache:'no-store'});if(!baseResponse.ok)throw new Error('Base vehicle metadata unavailable');
    const baseModels=Array.from((await baseResponse.text()).matchAll(/<modelName>\s*([^<]+)\s*<\/modelName>/g),x=>x[1].trim().toLowerCase());
    let bytes=0;const kitIds=new Set(),replacementTargets=new Set();const packs=new Set(),hashes=new Map(baseModels.map(name=>[modelHash(name),'base:'+name]));
    for(const item of records){
      if(!/^[A-Za-z0-9_-]{1,48}$/.test(item.packName))throw new Error('Invalid DLC pack name');
      for(const kit of item.manifest?.compatibility?.modKits||[]){if(kitIds.has(kit.id))throw new Error('Enabled cars share tuning kit ID '+kit.id);kitIds.add(kit.id);}
      const pack=item.packName.toLowerCase();if(packs.has(pack))throw new Error('Mod packages use the same DLC pack name');packs.add(pack);
      for(const target of item.manifest?.replacementTargets||[]){if(replacementTargets.has(target))throw new Error('Enabled content packages replace the same resource: '+target);replacementTargets.add(target);}
      if(!(item.adaptedDlc instanceof Blob))throw new Error('Mod data unavailable');bytes+=(item.kind==='resources'?0:(item.binaryOverrides||[]).reduce((sum,r)=>sum+(r.blob?.size||0),0))+item.adaptedDlc.size+(!item.kind?(item.replacementResources||[]).reduce((sum,r)=>sum+(r.blob?.size||0),0):0)+(item.textOverrides||[]).filter(p=>p.blob!==item.adaptedDlc).reduce((sum,p)=>sum+(p.blob?.size||0),0);
      for(const name of (!item.kind||item.kind==='ped-addon'?item.models:[])){const hash=modelHash(name);if(hashes.has(hash))throw new Error('Mod model-name/hash conflict: '+name);hashes.set(hash,name);}
    }
    if(bytes>limits.dlcBytes)throw new Error('Combined mod DLC data exceeds '+(limits.dlcBytes/1048576)+' MiB');
    const response=await fetch('/data/manifest.json',{cache:'no-store'});if(!response.ok)throw new Error('Base manifest unavailable');
    const manifest=await response.json(),rows=manifest.files.map(row=>row.slice()),index=rows.findIndex(row=>row[0]==='common/data/dlcList.xml');
    if(index<0)throw new Error('Base DLC list missing');
    const xmlResponse=await fetch('/data/common/data/dlcList.xml',{cache:'no-store'});if(!xmlResponse.ok)throw new Error('Base DLC list unavailable');
    let xml=await xmlResponse.text();if((xml.match(/<\/Paths>/g)||[]).length!==1)throw new Error('Unsupported base DLC list');
    const overrides={},paths=[];
    for(const item of records){
      if(['ped','weapon','clothing','resources','handling','config','shader'].includes(item.kind))continue;
      const path='x64/dlcPacks/'+item.packName+'/dlc.rpf';
      if(rows.some(row=>row[0].toLowerCase()===path.toLowerCase())||new RegExp('(?:dlcPacks|dlcpacks)[\\\\/]'+item.packName+'[\\\\/]','i').test(xml))throw new Error('Mod pack conflicts with a base DLC pack');
      const mountedDlc=await nativeAudioDlc(item);
      paths.push('<Item>platform:\\dlcPacks\\'+item.packName+'\\</Item>');rows.push([path,mountedDlc.size,Math.floor(item.importedAt/1000)]);overrides[path]=mountedDlc;
    }
    await mountBinaryOverrides(records,rows,overrides);
    await mountTextOverrides(records,rows,overrides);
    await mountReplacements(records,rows,overrides);
    xml=xml.replace('</Paths>',paths.join('\n')+'\n</Paths>');
    const xmlBlob=new Blob([xml],{type:'application/xml'});rows[index][1]=xmlBlob.size;overrides['common/data/dlcList.xml']=xmlBlob;
    const manifestUrl=URL.createObjectURL(new Blob([JSON.stringify({...manifest,files:rows})],{type:'application/json'}));
    const close=()=>URL.revokeObjectURL(manifestUrl);addEventListener('pagehide',close,{once:true});
    const shaderReplacements=records.flatMap(r=>r.shaderReplacements||[]);if(shaderReplacements.length){if(!root.GTAShaderMods)throw Error('Shader support helper missing; reload the launcher');root.GTAShaderMods.validate(shaderReplacements);}
    const trainerVehicles=records.filter(item=>!item.kind).flatMap(item=>item.models.map(model=>({model,label:item.manifest?.compatibility?.vehicleInfo?.find(row=>row.model===model)?.label||model,package:item.packName})));
    if(trainerVehicles.length>4096)throw new Error('Enabled packages exceed the 4096 trainer model catalogue limit');
    const trainerContent={peds:[],weapons:[],animations:[],clothes:[]};for(const item of records)for(const kind of Object.keys(trainerContent))trainerContent[kind].push(...(item.manifest?.content?.[kind]||[]));
    if(Object.values(trainerContent).some(rows=>rows.length>1024))throw new Error('Imported content exceeds the 1024-entry per-category menu limit');
    return {shaderReplacements,trainerContent,trainerVehicles,manifestUrl,overrides,model:record.kind?null:model,packName:record.packName,id:record.id,packages:ids,trafficModels:traffic.map(x=>x.model)};
  }
  root.GTAUserMods={limits,open,list,get,save,remove,prepare,prepareMany,normaliseSelections,download};
})(typeof self!=='undefined'?self:globalThis);
