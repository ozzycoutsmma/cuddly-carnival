/* Quick-start adapter; launcher.js remains the source of persisted settings. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),BUILD='8b0b5899ed-replica-20261009-v1';

  function setMode(value){
    const input=document.querySelector('input[name=mode][value="'+value+'"]');
    input.checked=true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function syncSingleMode(){
    const mode=document.querySelector('input[name=mode]:checked').value;
    $('play-single-mode').value=mode==='story'?'story':'sandbox';
    if(mode==='story')$('play-map').value='gta5';
    $('map-mode-choice').hidden=$('mp-enable').checked||mode==='story';
    $('map-note').hidden=$('play-map').value==='gta5';
  }
  const selectedSingleMode=()=>$('play-single-mode').value==='story'?'story':'sandbox';
  function syncFromSimple(){$('mp-key').value=$('mp-access').value;}
  function syncFromAdvanced(){$('mp-access').value=$('mp-key').value;}
  const codeFields=[['mp-access','mp-access-show'],['mp-key','mp-key-show']];
  function showCode(inputId,buttonId,visible){
    $(inputId).type=visible?'text':'password';
    const button=$(buttonId);button.textContent=visible?'Hide':'Show';
    button.setAttribute('aria-pressed',String(visible));
    button.setAttribute('aria-label',(visible?'Hide':'Show')+' access code');
  }
  function feedback(message,focusCode=false){
    $('play-feedback').textContent=message;
    if(focusCode)$('mp-access').focus();
  }
  let focusCodeAfterError=false,bcFallbackAcknowledged=false,bcFallbackButton;
  const bcWarningPrefix='Your graphics setup does not support BC texture compression';
  function proceedWithFallback(){
    const settings=window.GTALauncherSettings?.currentSettings();
    if(!settings)return;
    if(settings.bcfallback==='off')window.GTALauncherSettings.applySettings({...settings,bcfallback:'auto'});
    bcFallbackAcknowledged=true;
    $('mp-failure-dialog').close();
    $('start').click();
  }
  function joinFailure(message,focusCode=false,title='Could not join multiplayer',helpSection=''){
    feedback(message);
    focusCodeAfterError=focusCode;
    const bcWarning=message.startsWith(bcWarningPrefix)&&!$('mp-enable').checked;
    if(!bcFallbackButton){
      bcFallbackButton=document.createElement('button');
      bcFallbackButton.type='button';
      bcFallbackButton.id='bc-launch-anyway';
      bcFallbackButton.textContent='proceed with Fallback';
      bcFallbackButton.onclick=proceedWithFallback;
      $('mp-failure-info').before(bcFallbackButton);
    }
    bcFallbackButton.hidden=!bcWarning;
    $('mp-failure-title').textContent=bcWarning?'BC texture fallback':title;
    $('mp-failure-message').textContent=message;
    $('mp-failure-info').hidden=!helpSection;
    $('mp-failure-info').onclick=()=>{
      $('mp-failure-dialog').close();
      window.GTALauncherHelp?.open(helpSection);
    };
    $('mp-failure-dialog').showModal();
  }
  function joinErrorMessage(error){
    const message=error.message||'Unable to connect to multiplayer.';
    if(/join key rejected|access code rejected/i.test(message))return 'Access code rejected. Enter the code chosen by the host exactly; capitalization matters. Then try again.';
    if(/room full/i.test(message))return 'This room already has two players. Ask a player to disconnect, or choose another room on both PCs.';
    return message;
  }
  function syncPlayType(multiplayer){
    multiplayer=multiplayer&&!$('play-multiplayer').disabled;
    $('play-single').checked=!multiplayer;
    $('play-multiplayer').checked=multiplayer;
    $('mp-simple').hidden=!multiplayer;
    $('single-mode-choice').hidden=multiplayer;
    $('map-mode-choice').hidden=multiplayer||$('play-single-mode').value==='story';
    const changed=$('mp-enable').checked!==multiplayer;
    $('mp-enable').checked=multiplayer;
    if(changed)$('mp-enable').dispatchEvent(new Event('change',{bubbles:true}));
  }
  function choose(multiplayer){
    syncPlayType(multiplayer);
    if(multiplayer){
      setMode('sandbox');
    }
  }
  function restorePlayType(){
    const multiplayer=$('play-multiplayer').checked&&!$('play-multiplayer').disabled;
    syncPlayType(multiplayer);
    if(multiplayer)setMode('sandbox');
    if($('mp-key').value)syncFromAdvanced();else syncFromSimple();
  }
  function browserError(){
    if(!isSecureContext)return 'Open the HTTPS game link (or localhost) in Chrome or Edge.';
    if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined')return 'This browser blocked required isolated-memory features. Use the supplied HTTPS link in current Chrome or Edge.';
    if(!navigator.gpu)return 'Your browser cannot use the gameâ€™s graphics. Try current Chrome or Edge with graphics acceleration switched on.';
    if(window.GTATouchControls)return GTATouchControls.capabilityError();
    return '';
  }
  // Browser identity is only an advisory gate; actual capabilities decide whether
  // the engine can start. Chrome's UA also contains AppleWebKit and Safari.
  function unsupportedBrowser(ua=navigator.userAgent||''){
    if(/AppleWebKit\//.test(ua)&&!/(?:Chrome|Chromium)\/\d/.test(ua))return 'Safari / WebKit';
    if(/(?:Firefox|Waterfox|LibreWolf)\/|Gecko\/\d/.test(ua))return 'Firefox';
    return '';
  }
  async function graphicsError(){
    let timer;
    try{
      const adapter=await Promise.race([
        navigator.gpu.requestAdapter({powerPreference:'high-performance'}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('GPU check timed out')),7000);})
      ]);
      if(!adapter)return 'The game cannot use your graphics card. Turn on graphics acceleration in your browser settings and restart the browser. Your card or driver may not be supported.';
      if(!adapter.features.has('texture-compression-bc')&&(!bcFallbackAcknowledged||window.GTALauncherSettings?.currentSettings().bcfallback==='off'))return bcWarningPrefix+'. You can proceed with local texture decoding for this singleplayer test. Downloads stay compressed, but the fallback uses more RAM/GPU memory and may load slower. Mobile gameplay is not yet verified.';
      return '';
    }catch(_){
      return 'Could not check your graphics card. Restart your browser and try again.';
    }finally{clearTimeout(timer);}
  }
  function relayURL(){
    return new URL($('mp-samehost').checked
      ?new URL('/relay',location.href).href.replace(/^http/,'ws')
      :$('mp-url').value.trim());
  }
  function multiplayerConfig(){
    const room=$('mp-room').value.trim(),key=$('mp-key').value.trim(),url=relayURL();
    if(!/^[\x20-\x7e]{4,128}$/.test(key)){
      throw Error('Enter the hostâ€™s access code (4â€“128 characters, case-sensitive).');
    }
    if(!/^[A-Za-z0-9_-]{1,32}$/.test(room)){
      throw Error('Enter a valid room name (letters, numbers, underscores or hyphens).');
    }
    if(location.protocol==='https:'&&url.protocol!=='wss:'){
      throw Error('This HTTPS game link needs its default secure relay.');
    }
    return {room,key,url:url.href};
  }
  function sameConfig(config){
    try{
      const current=multiplayerConfig();
      return current.room===config.room&&current.key===config.key&&current.url===config.url;
    }catch(_){return false;}
  }
  function check(config){
    return new Promise((resolve,reject)=>{
      let ws,timer;
      const finish=error=>{
        if(!timer)return;
        clearTimeout(timer);timer=0;
        try{ws.close();}catch(_){}
        error?reject(error):resolve();
      };
      try{
        ws=new WebSocket(config.url);
        timer=setTimeout(()=>finish(Error('Relay check timed out. Check the host is still running.')),8000);
        ws.onopen=()=>ws.send(JSON.stringify({type:'check',protocol:1,key:config.key,room:config.room,build:BUILD,map:'gta5'}));
        ws.onmessage=event=>{
          try{
            const message=JSON.parse(event.data);
            finish(message.type==='checked'?null:Error(message.message||'Access code or relay check failed.'));
          }catch(_){finish(Error('Relay sent an invalid response.'));}
        };
        ws.onerror=()=>finish(Error('Cannot reach the relay. Check the game link and access code.'));
        ws.onclose=event=>{if(event.code!==1000)finish(Error(event.reason||'Access code rejected or room is full.'));};
      }catch(error){reject(error);}
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const saved=document.querySelector('input[name=mode]:checked').value;
    $('play-single-mode').value=saved==='story'?'story':'sandbox';
    restorePlayType();
    if(saved==='story'&&!$('play-multiplayer').checked)setMode('story');
    // Chrome can restore form controls after DOMContentLoaded without change
    // events. Reconcile the visible form on normal loads and back/forward restores.
    window.addEventListener('pageshow',restorePlayType);
    window.addEventListener('gta-multiplayer-preferences',restorePlayType);
    window.addEventListener('gta-launcher-settings',syncSingleMode);
    syncSingleMode();
    $('play-single').onchange=()=>{choose(false);setMode(selectedSingleMode());};
    $('play-single-mode').onchange=()=>setMode(selectedSingleMode());
    $('play-map').onchange=()=>setMode(selectedSingleMode());
    $('play-multiplayer').onchange=()=>choose(true);
    $('mp-enable').addEventListener('change',()=>{syncPlayType($('mp-enable').checked);if($('mp-enable').checked)setMode('sandbox');});
    $('mp-access').oninput=syncFromSimple;
    $('mp-key').oninput=syncFromAdvanced;
    for(const [inputId,buttonId] of codeFields){
      showCode(inputId,buttonId,false);
      $(buttonId).onclick=()=>showCode(inputId,buttonId,$(inputId).type==='password');
    }
    window.addEventListener('pagehide',()=>{for(const [inputId,buttonId] of codeFields)showCode(inputId,buttonId,false);});
    $('mp-failure-close').onclick=()=>$('mp-failure-dialog').close();
    $('mp-failure-dialog').addEventListener('close',()=>{if(focusCodeAfterError)$('mp-access').focus();focusCodeAfterError=false;});
    $('mp-advanced').onchange=()=>{if($('mp-advanced').checked)$('multiplayer-dialog').showModal();};
    $('multiplayer-open').onclick=()=>{$('mp-advanced').checked=true;$('multiplayer-dialog').showModal();};

    let replay=false,busy=false,browserAcknowledged=false;
    $('browser-warning-back').onclick=()=>$('browser-warning-dialog').close();
    $('browser-warning-info').onclick=()=>{
      $('browser-warning-dialog').close();
      window.GTALauncherHelp?.open('Supported browsers');
    };
    $('browser-warning-continue').onclick=()=>{
      browserAcknowledged=true;
      $('browser-warning-dialog').close();
      $('start').click();
    };
    $('start').addEventListener('click',async event=>{
      if(replay)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(busy)return;
      const browser=unsupportedBrowser();
      if(browser&&!browserAcknowledged){
        $('browser-warning-message').textContent=browser+' is not supported by this build. Try a Chromium browser such as Chrome, Edge, Brave, Opera or Vivaldi. You can continue, but the game may fail to load.';
        if(!$('browser-warning-dialog').open)$('browser-warning-dialog').showModal();
        return;
      }
      const problem=browserError();
      if(problem){joinFailure(problem,false,'Cannot start GTA V',navigator.gpu?'The game will not start, or loading stops':'Turn on graphics acceleration');return;}
      if(window.GTALANCertificate?.needsSetup){
        feedback('Install this hostâ€™s LAN certificate and restart Chrome/Edge before playing.');
        GTALANCertificate.open();return;
      }
      const start=$('start'),wasDisabled=start.disabled;
      busy=true;
      start.disabled=true;
      feedback('Checking graphics supportâ€¦');
      try{
        const graphics=await graphicsError();
        if(graphics){joinFailure(graphics,false,'Cannot start GTA V','Turn on graphics acceleration');return;}
        if($('mp-enable').checked){
          let config;
          try{config=multiplayerConfig();}catch(error){
            $('mp-error').textContent=error.message;joinFailure(error.message,true);return;
          }
          feedback('Checking access codeâ€¦');
          await check(config);
          if(!sameConfig(config)){
            feedback('Multiplayer settings changed while checking. Press Play again.');return;
          }
        }
        busy=false;
        start.disabled=wasDisabled;
        feedback('');
        replay=true;
        try{start.click();}finally{replay=false;}
      }catch(error){
        const message=joinErrorMessage(error);
        $('mp-error').textContent=message;
        joinFailure(message,/(code|rejected)/i.test(message));
      }finally{
        if(busy){busy=false;start.disabled=wasDisabled;}
      }
    },true);
  });
  window.GTAPlayerFlow={choose,check,browserError,graphicsError,unsupportedBrowser};
})();
