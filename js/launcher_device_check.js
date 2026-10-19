/* Small read-only readiness checks; no engine launch, game data or storage writes. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const explanations={
    'Secure connection':['Secure game link','Your game link supports the required browser features.','Open the host’s HTTPS link, or localhost on the host PC.'],
    'Isolated shared memory':['Background workers','The game’s background workers can share memory.','The host needs to enable the required isolation headers. See connection help.'],
    'Shared memory64':['Browser memory support','The required memory support is available.','Update the browser or try another Chromium browser. This memory feature is required to start.'],
    'WebGPU':['Graphics API','WebGPU is available.','Enable graphics acceleration and update your browser.'],
    'WebGPU adapter':['Graphics card access','Your browser can use the graphics card.','Enable graphics acceleration, restart the browser and update the graphics driver. Older cards may be unsupported.'],
    'BC texture compression':['Game textures','Your graphics setup supports the game’s textures.','Hardware BC is unavailable. Select Auto texture compatibility in Graphics & performance to decode the existing downloads locally. This uses more memory and CPU time; mobile gameplay remains unverified.'],
    'Clip distances':['Shader clipping','Native shader clipping is available.','Native clipping is unavailable. Fragment-based clipping will be used automatically.'],
    'Graphics device startup':['Graphics startup','The graphics device starts successfully.','Graphics could not start. Restart your browser and update the graphics driver.']
  };
  async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Check timed out')),6000);})]);}finally{clearTimeout(timer);}}
  document.addEventListener('DOMContentLoaded',()=>{
    let busy=false,helpSection='Supported browsers';
    function result(name,state,detail){
      const row=document.createElement('section'),heading=document.createElement('h3'),text=document.createElement('p');
      row.className='device-check-row';row.dataset.state=state;
      const labels={ready:'Ready',unavailable:'Unavailable',warning:'Warning',info:'Info'};
      heading.textContent=(state==='info'?'':labels[state]+' — ')+name;text.textContent=detail;row.append(heading,text);$('device-check-results').append(row);
    }
    async function run(){
      if(busy)return;busy=true;$('device-check-run').disabled=true;$('device-check-summary').textContent='Checking this device…';$('device-check-results').replaceChildren();
      try{
        const browser=window.GTAPlayerFlow?.unsupportedBrowser()||'';
        result('Browser choice',browser?'warning':'info',browser?browser+' is not supported by this build. Try desktop Chrome, Edge, Brave, Opera or Vivaldi.':'Chromium browsers include Chrome, Edge, Brave, Opera, Opera GX and Vivaldi. Use an up-to-date desktop version. Brave’s Shields may affect loading; try Chrome or Edge if it does not work.');
        const rows=await GTATouchControls.checkDevice();
        if(rows.some(r=>r.name==='WebGPU adapter'&&r.ok)){
          try{
            const adapter=await bounded(navigator.gpu.requestAdapter({powerPreference:'high-performance'}));
            if(!adapter)throw Error('Graphics adapter no longer available');
            // Destroy even if the promise finishes after the timeout; no device is retained.
            await bounded(adapter.requestDevice().then(device=>{device.destroy();}));
            rows.push({name:'Graphics device startup',ok:true});
          }catch(error){rows.push({name:'Graphics device startup',ok:false,detail:error.message});}
        }
        for(const row of rows.sort((a,b)=>Number(a.ok)-Number(b.ok))){
          const [name,ready,failure]=explanations[row.name]||[row.name,row.detail||'',row.detail||''];
          result(name,row.ok?'ready':(row.name==='Clip distances'||(row.name==='BC texture compression'&&window.GTALauncherSettings?.currentSettings().bcfallback!=='off'))?'warning':'unavailable',row.ok?ready:failure+(['WebGPU adapter','Graphics device startup'].includes(row.name)&&row.detail?' Details: '+row.detail:''));
        }
        const cores=GTACpuSettings.detected();
        result('Logical CPU cores','info',cores?'Browser reports '+cores+' logical cores. Choose Engine core limit in Graphics & performance. This is worker-pool sizing, not CPU affinity.':'The browser did not report its logical core count. Auto remains available.');
        const ram=navigator.deviceMemory;
        result('Reported RAM','info',ram?ram+' GB RAM reported.':'RAM not reported.');
        try{
          const estimate=await bounded(navigator.storage.estimate());
          const free=Number.isFinite(estimate.quota)&&Number.isFinite(estimate.usage)?Math.max(0,estimate.quota-estimate.usage):null;
          result('Browser storage','info',free===null?'Available storage could not be measured.':'About '+(free/1073741824).toFixed(1)+' GiB available for this site. This browser estimate can change.');
        }catch(_){result('Browser storage','info','Storage estimate unavailable.');}
        const failures=rows.filter(r=>!r.ok&&r.name!=='Clip distances'&&(r.name!=='BC texture compression'||window.GTALauncherSettings?.currentSettings().bcfallback==='off'));
        helpSection=failures.some(r=>/WebGPU|BC texture|Graphics device/.test(r.name))?'Turn on graphics acceleration':'Supported browsers';
        $('device-check-summary').textContent=failures.length?'Some required features are missing. Read the results below.':browser||rows.some(r=>!r.ok)?'Core features are available. Check the warnings below.':'Core browser and graphics checks passed.';
      }catch(_){$('device-check-summary').textContent='The device check could not finish. Restart the browser or open More info.';}
      finally{busy=false;$('device-check-run').disabled=false;}
    }
    $('device-check-open').onclick=()=>{$('device-check-dialog').showModal();run();};
    $('device-check-run').onclick=run;
    $('device-check-help').onclick=()=>{$('device-check-dialog').close();window.GTALauncherHelp?.open(helpSection);};
  });
})();
