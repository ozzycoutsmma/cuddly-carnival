/* Low-spec shortcuts share the canonical controls and their existing persisted state. */
(()=>{
  'use strict';
  document.addEventListener('DOMContentLoaded',()=>{
    const pairs=[];
    for(const holder of document.querySelectorAll('[data-graphics-shortcut]')){
      const source=document.getElementById(holder.dataset.graphicsShortcut);
      if(!source)continue;
      const row=source.closest('label').cloneNode(true);
      for(const node of row.querySelectorAll('[id]'))node.removeAttribute('id');
      const input=row.querySelector('select');input.id='low-spec-'+source.id;
      input.addEventListener('change',()=>{source.value=input.value;source.dispatchEvent(new Event('change',{bubbles:true}));});
      holder.replaceWith(row);pairs.push({source,input});
    }
    const sync=()=>{for(const {source,input} of pairs)input.value=source.value;};
    window.addEventListener('gta-launcher-settings',sync);sync();
  });
})();
