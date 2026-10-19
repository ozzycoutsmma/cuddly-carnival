(()=>{
 'use strict';
 document.addEventListener('DOMContentLoaded',()=>{
  GTAKeyboardControls.mount(document.getElementById('launcher-keyboard-settings'));
  GTAUIPreferences.mount(document.getElementById('launcher-ui-appearance'));
  document.getElementById('ui-appearance-open').onclick=()=>document.getElementById('ui-appearance-dialog').showModal();
  const menu=GTATouchControls.createSettings(undefined,document.getElementById('launcher-touch-settings'));
  document.getElementById('performance-open').addEventListener('click',()=>menu.open());
  GTATouchControls.ready().catch(error=>console.error('touch.js module unavailable',error));
 });
})();
