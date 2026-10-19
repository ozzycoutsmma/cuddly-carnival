/* Production adapter for supplied touch.js. Legacy layouts remain archived. */
(function(root){
 'use strict';
 const STORE='gta5-touch-js-v1',PROFILE_KEY=STORE+'-profile',MODE_KEY=STORE+'-mode',LEGACY='gta5-touch-controls-v1';
 const ids=['yaya','araba','motosiklet','helikopter','ucak','tekne','gamepad'];
 const VK=(()=>{const VK = {
	Backspace: 0x08, Tab: 0x09, Enter: 0x0D, NumpadEnter: 0xFD, Pause: 0x13, CapsLock: 0x14, Escape: 0x1B, Space: 0x20, PageUp: 0x21, PageDown: 0x22,
	End: 0x23, Home: 0x24, ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28, PrintScreen: 0x2C, Insert: 0x2D, Delete: 0x2E,
	MetaLeft: 0x5B, MetaRight: 0x5C, ContextMenu: 0x5D, NumpadMultiply: 0x6A, NumpadAdd: 0x6B, NumpadSubtract: 0x6D, NumpadDecimal: 0x6E, NumpadDivide: 0x6F,
	NumLock: 0x90, ScrollLock: 0x91, ShiftLeft: 0xA0, ShiftRight: 0xA1, ControlLeft: 0xA2, ControlRight: 0xA3, AltLeft: 0xA4, AltRight: 0xA5,
	Semicolon: 0xBA, Equal: 0xBB, Comma: 0xBC, Minus: 0xBD, Period: 0xBE, Slash: 0xBF, Backquote: 0xC0, BracketLeft: 0xDB, Backslash: 0xDC, BracketRight: 0xDD,
	Quote: 0xDE, IntlBackslash: 0xE2,
};
for (let i = 0; i < 10; i++) { VK['Digit' + i] = 0x30 + i; VK['Numpad' + i] = 0x60 + i; }
for (let i = 0; i < 26; i++) VK['Key' + String.fromCharCode(65 + i)] = 0x41 + i;
for (let i = 1; i <= 24; i++) VK['F' + i] = 0x6F + i;
return VK;})();
 let modulePromise,reference,launcherControls,sessionMode;
 const plain=v=>v&&typeof v==='object'&&!Array.isArray(v)?JSON.parse(JSON.stringify(v)):{};
 function load(){try{return plain(JSON.parse(localStorage.getItem(LEGACY)||'{}'));}catch(_){return {};}}
 function save(value){try{localStorage.setItem(LEGACY,JSON.stringify(plain(value)));return true;}catch(_){return false;}}
 function getMode(){if(sessionMode)return sessionMode;try{const mode=localStorage.getItem(MODE_KEY);sessionMode=['auto','on','off'].includes(mode)?mode:'auto';}catch(_){sessionMode='auto';}return sessionMode;}
 const enabled=()=>getMode()==='on'||getMode()==='auto'&&(navigator.maxTouchPoints>0||root.matchMedia?.('(pointer: coarse)').matches);
 function setMode(mode){sessionMode=['auto','on','off'].includes(mode)?mode:'auto';try{localStorage.setItem(MODE_KEY,sessionMode);}catch(_){}root.dispatchEvent(new Event('touch-js-mode'));}
 function ready(){if(!modulePromise)modulePromise=import('/touch_art/touch.js?v=mobile-menu-gesture-v5').then(m=>{reference=m;return m;});return modulePromise;}
 function snapshotReference(){
   const profiles={};for(const id of ids){try{const raw=JSON.parse(localStorage.getItem(STORE+':'+id)||'null');if(raw)profiles[id]=raw;}catch(_){}}
   let activeProfile='yaya';try{activeProfile=localStorage.getItem(PROFILE_KEY)||'yaya';}catch(_){}
   const raw={app:'gta5-touch',version:18,profiles,activeProfile,mode:getMode()};
   return reference?reference.normaliseTouchBundle(raw,VK):raw;
 }
 async function saveReference(value){
   const m=await ready(),bundle=m.normaliseTouchBundle(value,VK);
   for(const [id,profile] of Object.entries(bundle.profiles))localStorage.setItem(STORE+':'+id,JSON.stringify({...profile,savedAt:Date.now()}));
   localStorage.setItem(PROFILE_KEY,bundle.activeProfile);setMode(bundle.mode);
   launcherControls?.applyBundle(bundle);root.dispatchEvent(new Event('touch-js-settings'));
 }
 function fromTouchMouse(e){return !!e.sourceCapabilities?.firesTouchEvents||!!e.target?.closest?.('#pad,.tc-ui,#tc-box,#tc-rotate,#tc-xclose');}
 function mount({release=()=>{}}={}){
   let controls,install;
   const bar=document.createElement('div');bar.id='touch-toolbar';
   const toggle=document.createElement('button'),settings=document.createElement('button');toggle.type=settings.type='button';settings.textContent='Touch settings';
   const refresh=()=>{const on=enabled();toggle.textContent='Touch: '+(on?'On':'Off');toggle.setAttribute('aria-pressed',String(on));controls?.setEnabled(on);};
   toggle.onclick=()=>{release();setMode(enabled()?'off':'on');};settings.onclick=()=>controls?.openPanel();bar.append(toggle,settings);(root.GTAGameUI?.mount()||document.body).append(bar);
   root.addEventListener('touch-js-mode',refresh);refresh();
   root.addEventListener('pagehide',()=>{controls?.releaseAll();release();},{once:true});
   return {sample:()=>null,isSettingsOpen:()=>!!controls?.isSettingsOpen(),release:()=>controls?.releaseAll(),
     bind(input){if(!install)install=ready().then(m=>m.installTouchControls(input)).then(value=>{controls=value;refresh();return value;}).catch(error=>{toggle.textContent='Touch failed';console.error('touch.js initialization failed',error);throw error;});return install;},
     openSettings:()=>controls?.openPanel()};
 }
 async function prepareLauncher(){
   if(!launcherControls){const buffer=new (root.SharedArrayBuffer||ArrayBuffer)(296);launcherControls=await (await ready()).installTouchControls({keys:new Uint8Array(buffer,0,256),w:new Int32Array(buffer,256,10),VK,settingsOnly:true});launcherControls.setEnabled(false);}
   return launcherControls;
 }
 function createSettings(_,container){
   const row=document.createElement('label');row.textContent='Touch controls ';const select=document.createElement('select');
   for(const [value,label] of [['auto','Auto (touch devices)'],['on','On'],['off','Off']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=getMode();select.onchange=()=>setMode(select.value);row.append(select);
   const button=document.createElement('button');button.type='button';button.textContent='Edit touch.js controls';
   const note=document.createElement('p');note.className='detail';note.textContent='Uses the same touch.js profiles, buttons and editor as the game. Previous controller layouts are retained separately.';
   button.textContent='Touch controls & viewport setup';
   note.textContent='Opens a blank setup page for touch profiles, button layout and game viewport.';
   button.onclick=()=>{const url=new URL('/touch_art/setup.html',location.origin);url.searchParams.set('return',location.pathname+location.search+location.hash);location.assign(url.href);};
   container.append(row,button,note);return {open(){select.value=getMode();},prepare:prepareLauncher};
 }
   function capabilityError(){
    try{
      // Binary validation proves memory64; the JS constructor alone can ignore unknown options.
      const bytes=new Uint8Array([0,97,115,109,1,0,0,0,5,4,1,7,1,1]);
      if(!root.WebAssembly?.validate(bytes))return 'This browser lacks shared 64-bit WebAssembly memory required by this build.';
      new root.WebAssembly.Memory({initial:1n,maximum:1n,shared:true,address:'i64'});
      return '';
    }catch(_){return 'This browser cannot create the shared 64-bit WebAssembly memory required by this build.';}
  }
  async function checkDevice(){
    const rows=[],add=(name,ok,detail)=>rows.push({name,ok,detail});
    add('Secure connection',!!root.isSecureContext,'Use HTTPS, or localhost on the host PC.');
    add('Isolated shared memory',!!root.crossOriginIsolated&&typeof root.SharedArrayBuffer!=='undefined','The host must send COOP/COEP headers.');
    const wasm=capabilityError();add('Shared memory64',!wasm,wasm||'Small feature probe passed; full game memory capacity is not tested.');
    if(!root.navigator?.gpu){add('WebGPU',false,'No WebGPU API is available in this browser.');return rows;}
    try{
      const adapter=await Promise.race([root.navigator.gpu.requestAdapter({powerPreference:'high-performance'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Adapter check timed out')),5000))]);
      add('WebGPU adapter',!!adapter,adapter?'Adapter available.':'No compatible GPU adapter.');
      if(adapter){
        add('BC texture compression',adapter.features.has('texture-compression-bc'),'This build currently needs BC textures; devices without BC need a decoder fallback.');
        add('Clip distances',adapter.features.has('clip-distances'),'Devices without native clip distances use fragment-based clipping automatically.');
      }
    }catch(error){add('WebGPU adapter',false,error.message);}
    return rows;
  }

 function viewportSize(){const r=document.getElementById('canvas')?.getBoundingClientRect();return r?.width&&r?.height?[r.width,r.height]:[root.innerWidth,root.innerHeight];}
 root.GTATouchControls={mount,createSettings,viewportSize,fromTouchMouse,capabilityError,checkDevice,load,save,normalise:plain,prepareLauncher,ready,snapshotReference,saveReference,getMode};
})(typeof self!=='undefined'?self:globalThis);
