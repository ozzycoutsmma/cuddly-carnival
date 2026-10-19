/* Optional classic level packages. Files remain in this browser, outside base assets. */
(function(root){
  'use strict';
  const PREFIX='common/data/levels/env_test/', PLATFORM='x64/levels/env_test/';
  function safePath(value){const p=value.replace(/\\/g,'/');if(p.startsWith('/')||p.split('/').some(x=>!x||x==='.'||x==='..')||/[\x00-\x1f:]/.test(p))throw Error('Unsafe map path');return p;}
  async function normalise(files){
    let extras=[];
    let inputs=Array.from(files,x=>({path:safePath(x.mapPath||x.webkitRelativePath||x.name),blob:x.blob||x}));
    if(inputs.length&&!inputs.some(x=>/(?:^|\/)common\/data\/levels\//i.test(x.path))){
      const folder=inputs[0].path.split('/')[0];
      const relative=inputs.map(x=>({...x,path:x.path.replace(/^(?:.*\/)?x64\/levels\/[^/]+\//i,'').replace(new RegExp('^'+folder.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/'), '')}));
      const paths=new Set(relative.map(x=>x.path.toLowerCase()));
      if(!paths.has('v_bins.rpf')||!paths.has('tmp/tmp_01.rpf')||!paths.has('zonebind.ymt'))throw Error('This bare folder is not the supported v1 env_test map. Other maps must include their level metadata.');
      const response=await fetch('/_map_support/env_test.json?v=1');if(!response.ok)throw Error('Map compatibility metadata unavailable');
      const support=await response.json();
      const supplied=support.files.map(x=>({path:x.path,blob:new Blob([Uint8Array.from(atob(x.base64),c=>c.charCodeAt(0))])}));
      extras=supplied.filter(x=>!x.path.startsWith(PREFIX));
      inputs=[...relative.map(x=>({...x,path:folder+'/x64/levels/env_test/'+x.path})),...supplied.filter(x=>x.path.startsWith(PREFIX)).map(x=>({...x,path:folder+'/'+x.path}))];
    }
    if(!inputs.length)throw Error('Choose an extracted map folder containing common/data/levels and x64/levels.');
    const roots=new Set(), commonRoots=new Set(), platformRoots=new Set(), mapped=[];
    for(const item of inputs){
      const match=item.path.match(/(?:^|\/)(common\/data\/levels|x64\/levels)\/([^/]+)\/(.+)$/i);
      if(!match)continue;
      const common=match[1].toLowerCase().startsWith('common');roots.add(match[2].toLowerCase());(common?commonRoots:platformRoots).add(match[2].toLowerCase());mapped.push({...item,path:(common?PREFIX:PLATFORM)+match[3],oldRoot:match[2]});
    }
    if(commonRoots.size!==1||platformRoots.size!==1)throw Error('Import exactly one complete classic level with common and x64 level folders. Loose YMAP/FiveM/DLC maps need conversion first.');
    const oldRoot=[...roots][0], seen=new Set(extras.map(x=>x.path.toLowerCase())), output=[...extras];
    const meta=mapped.filter(x=>x.path.startsWith(PREFIX)&&x.path.endsWith('.meta'));
    let entry=null;
    for(const item of meta)if((await item.blob.text()).includes('CDataFileMgr__ContentsOfDataFileXml')){if(entry)throw Error('More than one level entry metadata file');entry=item;}
    if(!entry||!mapped.some(x=>x.path.startsWith(PLATFORM)))throw Error('Incomplete map: level entry .meta and x64 resources are required.');
    const escaped=[...roots].map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const references=new RegExp('(levels[/\\\\])(?:'+escaped+')(?=[/\\\\])','gi');
    for(const item of mapped){
      let path=item===entry?PREFIX+'env_test.meta':item.path;
      if(seen.has(path.toLowerCase()))throw Error('Duplicate normalized map path: '+path);seen.add(path.toLowerCase());
      let blob=item.blob;
      if(/\.rpf$/i.test(path)&&String.fromCharCode(...new Uint8Array(await blob.slice(0,4).arrayBuffer()))!=='7FPR')throw Error('Unsupported archive format: '+path+' (classic RPF7 required)');
      if(/\.(meta|xml|ipl|dat)$/i.test(path)){
        const bytes=new Uint8Array(await blob.arrayBuffer());
        // Binary DAT/IPL resources must keep their original bytes.
        if(!bytes.includes(0)){let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(error){if(/\.(meta|xml)$/i.test(path))throw Error('Map metadata must be UTF-8 XML');}if(text!==undefined){text=text.replace(references,'$1env_test');const entryName=entry.path.slice(PREFIX.length);text=text.split('levels/env_test/'+entryName).join('levels/env_test/env_test.meta');blob=new Blob([text]);}}
      }
      output.push({path,blob});
    }
    const name=inputs[0].path.split('/')[0];return {name,files:output,oldRoot};
  }
  function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('grandv-maps-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('maps',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function run(mode,action){const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction('maps',mode),r=action(tx.objectStore('maps'));let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{d.close();}}
  const list=()=>run('readonly',s=>s.getAll());
  async function base(){const r=await fetch('/data/manifest.json',{cache:'no-store'});if(!r.ok)throw Error('Game manifest unavailable');return r.json();}
  async function validate(record,manifest){
    const paths=new Set([...manifest.files.map(x=>x[0].toLowerCase()),...record.files.map(x=>x.path.toLowerCase())]);
    for(const item of record.files.filter(x=>/\.(meta|xml)$/i.test(x.path))){
      const text=await item.blob.text();
      for(const match of text.matchAll(/(?:common(?:crc)?|platform(?:crc)?):[/\\]([^<"\s]+)/gi)){
        const path=(/^common/i.test(match[0])?'common/':'x64/')+match[1].replace(/\\/g,'/').toLowerCase();
        // Extensionless virtual resources are resolved by the engine.
        if(/\.[a-z0-9]+$/i.test(path)&&!paths.has(path))throw Error('Map dependency missing: '+path);
      }
    }
  }
  async function install(files){const record=await normalise(files);await validate(record,await base());record.id=crypto.randomUUID();await run('readwrite',s=>s.put(record));return record;}
  async function prepare(id){
    if(!/^[0-9a-f-]{36}$/.test(id||''))throw Error('Invalid custom map selection');
    const record=await run('readonly',s=>s.get(id));if(!record)throw Error('Custom map is not installed in this browser');
    const manifest=await base();await validate(record,manifest);
    const rows=manifest.files.map(x=>x.slice()),overrides={};
    for(const item of record.files){const row=rows.find(x=>x[0]===item.path);if(row)row[1]=item.blob.size;else rows.push([item.path,item.blob.size,0]);overrides[item.path]=item.blob;}
    const manifestUrl=URL.createObjectURL(new Blob([JSON.stringify({...manifest,files:rows})],{type:'application/json'}));
    addEventListener('pagehide',()=>URL.revokeObjectURL(manifestUrl),{once:true});return {manifestUrl,overrides};
  }
  root.GTACustomMaps={normalise,validate,install,list,prepare,remove:id=>run('readwrite',s=>s.delete(id))};
  if(typeof module!=='undefined')module.exports=root.GTACustomMaps;
})(globalThis);
