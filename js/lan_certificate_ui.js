/* First-use LAN setup: public certificate download, never an automatic trust change. */
(()=>{
  'use strict';
  window.GTALANCertificate={needsSetup:false,open:()=>document.getElementById('lan-certificate-dialog').showModal()};
  function workerReady(){
    return new Promise(resolve=>{
      let worker,timer,finished=false;
      const finish=ready=>{if(finished)return;finished=true;clearTimeout(timer);worker?.terminate();resolve(ready);};
      try{
        worker=new Worker('lan_trust_probe.js?v=1');
        worker.onmessage=event=>finish(event.data?.ready===true);
        worker.onerror=event=>{event.preventDefault();finish(false);};
        timer=setTimeout(()=>finish(false),3000);
      }catch(_){finish(false);}
    });
  }
  function prepareDownload(info,links){
    let busy=false;
    const status=message=>{
      for(const item of document.querySelectorAll('[data-lan-certificate-status]')){
        item.textContent=message;item.hidden=false;
      }
    };
    for(const link of links)link.addEventListener('click',async event=>{
      // Keep Copy link / modified clicks available for manual bootstrap navigation.
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      if(busy)return;
      busy=true;
      for(const item of links)item.setAttribute('aria-busy','true');
      status('Preparing certificate download…');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
      try{
        // Fetch from the page's own connection: an HTTPS → HTTP attachment
        // navigation can be blocked by Chrome as a mixed download.
        const response=await fetch(info.url,{cache:'no-store',credentials:'omit',mode:'same-origin',redirect:'error',signal:controller.signal});
        if(!response.ok||response.headers.get('Content-Type')?.split(';')[0].trim()!=='application/pkix-cert')throw new Error('Invalid certificate response');
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength<64||bytes.byteLength>65536)throw new Error('Invalid certificate size');
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(hash!==info.sha256)throw new Error('Certificate fingerprint changed');
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/pkix-cert'}));
        const save=document.createElement('a');save.href=url;save.download='lan-root-ca.cer';
        document.body.appendChild(save);
        try{save.click();}finally{save.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
        status('Certificate download started. Open lan-root-ca.cer from your browser’s Downloads, then follow How to install.');
      }catch(_){
        status('Could not start the download. Right-click Download LAN certificate → Copy link, then paste it into a new tab.');
      }finally{
        clearTimeout(timer);busy=false;
        for(const item of links)item.removeAttribute('aria-busy');
      }
    });
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const controls=document.getElementById('lan-certificate-controls');
    if(!controls)return;
    document.getElementById('lan-certificate-help').onclick=()=>document.getElementById('lan-certificate-dialog').showModal();
    document.getElementById('lan-certificate-advanced').onclick=()=>document.getElementById('lan-certificate-dialog').showModal();
    try{
      const response=await fetch('/__lan/certificate-info',{cache:'no-store'});
      if(!response.ok)return;
      const info=await response.json();
      if(info.url!=='/__lan/certificate.cer'||!/^[a-f0-9]{64}$/.test(info.sha256))return;
      document.getElementById('lan-certificate-fingerprint').textContent=info.sha256;
      document.getElementById('lan-certificate-advanced').hidden=false;
      const ready=await workerReady();
      const download=new URL(info.url,location.href);if(!ready)download.protocol='http:';
      const links=Array.from(document.querySelectorAll('[data-lan-certificate-download]'));
      for(const link of links)link.href=download.href;
      prepareDownload(info,links);
      controls.hidden=ready;window.GTALANCertificate.needsSetup=!ready;
    }catch(_){/* Other websites do not expose the local host's certificate route. */}
  });
})();
