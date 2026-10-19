/* One close control, outside the scrolling content, for each settings menu. */
(function(root){
  'use strict';
  const installed=new WeakMap();
  function coordinates(rect,width){const size=48,gap=10,beside=rect.right+gap+size<=width-8;return {left:Math.round(beside?rect.right+gap:Math.max(8,Math.min(width-size-8,rect.right-size))),top:Math.round(beside?Math.max(8,rect.top):Math.max(8,rect.top-size-gap))};}
  function position(dialog,button){if(!dialog.open)return;const at=coordinates(dialog.getBoundingClientRect(),innerWidth);button.style.left=at.left+'px';button.style.top=at.top+'px';}
  function install(dialog){
    // Native showModal() otherwise focuses the first input (and mobile pickers).
    const entry=dialog.querySelector('h1,h2,h3')||dialog;
    entry.tabIndex=-1;entry.setAttribute('autofocus','');
    if(installed.has(dialog))return;
    const button=dialog.querySelector('[data-settings-close][aria-label],#donate-close,#cache-cancel,[data-close]');
    if(!button)return;
    button.classList.add('dialog-close-dock');button.textContent='×';button.type='button';
    const label=document.createElement('span');label.className='dialog-close-label';label.textContent='Close';button.append(label);
    if(!button.getAttribute('aria-label'))button.setAttribute('aria-label','Close menu');
    dialog.dataset.dialogDock='';dialog.append(button);installed.set(dialog,button);
    const update=()=>requestAnimationFrame(()=>position(dialog,button));
    new MutationObserver(update).observe(dialog,{attributes:true,attributeFilter:['open']});
    dialog.addEventListener('scroll',update,{passive:true});update();
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={coordinates};return;}
  root.GTADialogDock={install};
  addEventListener('DOMContentLoaded',()=>document.querySelectorAll('dialog').forEach(install));
  addEventListener('resize',()=>document.querySelectorAll('dialog[open][data-dialog-dock]').forEach(dialog=>position(dialog,installed.get(dialog))));
})(typeof self!=='undefined'?self:globalThis);
