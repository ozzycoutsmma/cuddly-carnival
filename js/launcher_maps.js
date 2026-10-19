(()=>{
  'use strict';const $=id=>document.getElementById(id);let busy=false;
  async function refresh(selected='gta5'){
    const selector=$('play-map');selector.replaceChildren(new Option('GTA 5 map','gta5'));
    for(const record of await GTACustomMaps.list())selector.add(new Option(record.name+' — imported',record.id));
    selector.value=[...selector.options].some(x=>x.value===selected)?selected:'gta5';$('map-remove').disabled=selector.value==='gta5';
  }
  window.GTAMapLaunch={prepare(mode,multiplayer,mod){
    if(busy){$('map-result').textContent='Wait for the map import to finish.';$('mods-dialog').showModal();return null;}
    const id=$('play-map').value;if(mode==='story'||id==='gta5')return {enabled:false};
    if(multiplayer||mod.enabled||mod.trainer){$('map-result').textContent='Custom maps currently require single-player Sandbox with vehicle mods/trainer disabled.';$('mods-dialog').showModal();return null;}
    return {enabled:true,id};
  }};
  document.addEventListener('DOMContentLoaded',async()=>{
    try{await refresh();}catch(e){$('map-result').textContent=e.message;}
    async function importFiles(files){
      if(!files.length||busy)return;
      busy=true;$('map-result').textContent='Normalizing map paths and checking dependencies…';
      try{const record=await GTACustomMaps.install(files);await refresh(record.id);$('play-map').dispatchEvent(new Event('change'));$('map-result').textContent='Installed '+record.name+'. Select Sandbox to use it.';}catch(e){$('map-result').textContent='Import rejected: '+e.message;}finally{busy=false;}
    }
    $('map-import').onchange=event=>{const files=Array.from(event.target.files);event.target.value='';importFiles(files);};
    async function collect(entry,files){
      if(entry.isFile){const blob=await new Promise((resolve,reject)=>entry.file(resolve,reject));files.push({mapPath:entry.fullPath.replace(/^\//,''),blob});}
      else if(entry.isDirectory){const reader=entry.createReader();for(;;){const batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));if(!batch.length)break;for(const child of batch)await collect(child,files);}}
    }
    const drop=$('map-drop');
    drop.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';drop.classList.add('dragover');});
    drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
    drop.addEventListener('drop',async event=>{
      event.preventDefault();drop.classList.remove('dragover');if(busy)return;
      // Capture entries before awaiting: DataTransfer access ends after the event.
      const entries=Array.from(event.dataTransfer.items,item=>item.webkitGetAsEntry?.()).filter(Boolean);
      try{if(!entries.length)throw Error('Drop an extracted map folder, or use Import map folder.');const files=[];for(const entry of entries)await collect(entry,files);await importFiles(files);}catch(e){$('map-result').textContent='Import rejected: '+e.message;}
    });
    $('play-map').addEventListener('change',()=>{$('map-remove').disabled=$('play-map').value==='gta5';});
    $('map-remove').onclick=async()=>{try{if($('play-map').value==='gta5')return;await GTACustomMaps.remove($('play-map').value);await refresh();$('map-result').textContent='Imported map removed from this browser.';}catch(e){$('map-result').textContent=e.message;}};
  });
})();
