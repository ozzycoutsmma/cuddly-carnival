/* Experimental Sandbox sessions; keep the join key out of URLs/save exports. */
(()=>{
  'use strict';
  const KEY='gta5.multiplayer.pending.v1',PREF='gta5.multiplayer.server.v1';
  const $=id=>document.getElementById(id);
  const websiteRelay=()=>new URL('/relay',location.href).href.replace(/^http/,'ws');
  function normalisePreferences(value={}){
    let url=websiteRelay();try{const parsed=new URL(value.url);if(['ws:','wss:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password)url=parsed.href;}catch(_){}
    const legacy=(location.protocol==='https:'?'wss://':'ws://')+location.hostname+':8012';
    const sameHost=value.sameHost===true||value.sameHost!==false&&(!value.url||url.replace(/\/$/,'')===legacy||url===websiteRelay());
    return {sameHost,url:sameHost?websiteRelay():url,room:typeof value.room==='string'&&/^[A-Za-z0-9_-]{1,32}$/.test(value.room)?value.room:'friends',enabled:value.enabled===true};
  }
  const currentPreferences=()=>normalisePreferences({sameHost:$('mp-samehost').checked,url:$('mp-url').value.trim(),room:$('mp-room').value.trim(),enabled:$('mp-enable').checked});
  function savePreferences(){try{localStorage.setItem(PREF,JSON.stringify(currentPreferences()));}catch(_){$('mp-error').textContent='Browser storage is unavailable; connection preferences apply to this page only.';}}
  function applyPreferences(value){const prefs=normalisePreferences(value);if($('play-multiplayer').disabled||window.GTALauncherSettings.currentSettings().mode!=='sandbox')prefs.enabled=false;$('mp-samehost').checked=prefs.sameHost;$('mp-url').value=prefs.url;$('mp-url').disabled=prefs.sameHost;$('mp-room').value=prefs.room;$('mp-enable').checked=prefs.enabled;$('play-single').checked=!prefs.enabled;$('play-multiplayer').checked=prefs.enabled;savePreferences();window.dispatchEvent(new Event('gta-multiplayer-preferences'));}
  window.GTAMultiplayerLaunch={normalisePreferences,currentPreferences,applyPreferences,prepare(mode){
    $('mp-error').textContent='';
    if(!$('mp-enable').checked){sessionStorage.removeItem(KEY);return {enabled:false};}
    try{
      if(mode!=='sandbox')throw new Error('Select GTA V Sandbox for this multiplayer prototype.');
      const url=new URL($('mp-samehost').checked?websiteRelay():$('mp-url').value.trim()),room=$('mp-room').value.trim(),key=$('mp-key').value.trim();
      if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Enter a ws:// or wss:// relay address.');
      if(location.protocol==='https:'&&url.protocol!=='wss:')throw new Error('An HTTPS game website requires a WSS relay.');
      if(!/^[A-Za-z0-9_-]{1,32}$/.test(room))throw new Error('Room name:1–32 letters, numbers, underscores or hyphens.');
      if(!/^[\x20-\x7e]{4,128}$/.test(key))throw new Error('Enter the host’s access code (4–128 characters, case-sensitive).');
      sessionStorage.setItem(KEY,JSON.stringify({url:url.href,room,key}));
      savePreferences();
      return {enabled:true};
    }catch(error){$('mp-error').textContent=error.message;$('multiplayer-dialog').showModal();return null;}
  }};
  document.addEventListener('DOMContentLoaded',()=>{
    let stored={};try{stored=JSON.parse(localStorage.getItem(PREF)||'{}');}catch(_){}
    applyPreferences(stored);
    const updateRelay=()=>{$('mp-url').disabled=$('mp-samehost').checked;if($('mp-samehost').checked)$('mp-url').value=websiteRelay();};
    $('mp-samehost').onchange=updateRelay;updateRelay();
    for(const id of ['mp-samehost','mp-room','mp-url','mp-enable'])$(id).addEventListener('change',savePreferences);
    $('multiplayer-open').onclick=()=>$('multiplayer-dialog').showModal();
    $('reset-settings').addEventListener('click',()=>{applyPreferences({});$('mp-key').value='';$('mp-access').value='';sessionStorage.removeItem(KEY);});
  });
})();
