/* Physical keyboard remapping, separate from touch.js profiles and text input. */
(function(root){
 'use strict';
 const KEY='gta5-keyboard-controls-v1';
 const actions={KeyW:'Forward / accelerate',KeyS:'Back / brake',KeyA:'Left',KeyD:'Right',Space:'Jump / handbrake',ShiftLeft:'Sprint',ControlLeft:'Left Ctrl',AltLeft:'Left Alt',KeyF:'Enter / exit vehicle',KeyR:'Reload',KeyQ:'Cover',KeyE:'Interact / horn',Tab:'Weapon wheel',KeyC:'Look behind',KeyM:'Interaction menu',KeyH:'Headlights',ArrowUp:'Up / phone',ArrowDown:'Down',ArrowLeft:'Left arrow',ArrowRight:'Right arrow',Escape:'Pause / back',Enter:'Confirm',Backspace:'Backspace',Numpad8:'Aircraft pitch forward',Numpad2:'Aircraft pitch back',Numpad4:'Aircraft roll left',Numpad6:'Aircraft roll right',Numpad7:'Aircraft target left',Numpad9:'Aircraft target right'};
 const valid=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad(?:[0-9]|Enter|Add|Subtract|Multiply|Divide|Decimal)|F(?:[1-9]|1[0-9]|2[0-4])|Arrow(?:Up|Down|Left|Right)|Space|Tab|Enter|Escape|Backspace|Shift(?:Left|Right)|Control(?:Left|Right)|Alt(?:Left|Right)|CapsLock|Insert|Delete|Home|End|PageUp|PageDown|Semicolon|Equal|Comma|Minus|Period|Slash|Backquote|BracketLeft|BracketRight|Backslash|Quote|IntlBackslash)$/.test(code)&&!['F5','F11','F12'].includes(code);
 function normalise(raw){const out={version:1,bindings:{}};for(const target of Object.keys(actions)){const value=raw?.bindings?.[target];if(value===null||valid(value)&&value!==target)out.bindings[target]=value;}return out;}
 let session;
 function load(){if(session)return normalise(session);try{session=normalise(JSON.parse(root.localStorage.getItem(KEY)||'{}'));}catch(_){session=normalise();}return normalise(session);}
 function save(raw){session=normalise(raw);let stored=true;try{root.localStorage.setItem(KEY,JSON.stringify(session));}catch(_){stored=false;}root.dispatchEvent?.(new Event('keyboard-controls-change'));return stored;}
 function resolve(code,raw=load()){
   const settings=normalise(raw),mapped=Object.entries(settings.bindings).filter(([,physical])=>physical===code).map(([target])=>target);
   if(mapped.length)return mapped;
   return Object.hasOwn(settings.bindings,code)?[]:[code];
 }
 const label=code=>code===null?'Unbound':code.replace(/^Key/,'').replace(/^Digit/,'').replace(/^Numpad/,'Num ');
 function mount(container){
   let pending;
   const note=document.createElement('p');note.className='detail';note.textContent='Click a binding, then press a key. These map physical keys to GTA’s default keys; touch.js has its own bindings. F5/F11/F12 and browser shortcuts remain reserved.';
   const status=document.createElement('p');status.setAttribute('role','status');
   const grid=document.createElement('div');grid.className='settings-grid';
   const buttons=new Map();
   function render(){const value=load();for(const [target,button]of buttons)button.textContent=target===pending?'Press a key…':label(Object.hasOwn(value.bindings,target)?value.bindings[target]:target);}
   for(const [target,name]of Object.entries(actions)){
     const row=document.createElement('div'),text=document.createElement('label'),button=document.createElement('button'),clear=document.createElement('button');
     button.type=clear.type='button';button.id='keyboard-bind-'+target;text.htmlFor=button.id;text.textContent=name;button.setAttribute('aria-label',name+' key binding');
     button.onclick=()=>{pending=target;render();};clear.textContent='Unbind';clear.setAttribute('aria-label','Unbind '+name);clear.onclick=()=>{const value=load();value.bindings[target]=null;save(value);render();};
     row.append(text,button,clear);grid.append(row);buttons.set(target,button);
   }
   document.addEventListener('keydown',event=>{
     if(!pending)return;
     if(!container.closest('dialog')?.open){pending=null;render();return;}
     event.preventDefault();event.stopImmediatePropagation();
     if(!valid(event.code)){status.textContent='That key is reserved or unsupported. Press another key.';return;}
     const value=load(),conflict=Object.keys(actions).find(target=>target!==pending&&(Object.hasOwn(value.bindings,target)?value.bindings[target]:target)===event.code);
     if(conflict){status.textContent='Already assigned to '+actions[conflict]+'. Unbind it first or choose another key.';return;}
     value.bindings[pending]=event.code;pending=null;status.textContent=save(value)?'Keyboard binding saved.':'Applied for this page; browser storage is unavailable.';render();
   },true);
   const reset=document.createElement('button');reset.type='button';reset.textContent='Reset keyboard bindings';reset.onclick=()=>{pending=null;save({});status.textContent='Default keyboard bindings restored.';render();};
   root.addEventListener?.('keyboard-controls-change',render);container.append(note,grid,reset,status);render();
 }
 const api={normalise,load,save,resolve,mount};root.GTAKeyboardControls=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
