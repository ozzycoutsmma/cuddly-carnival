(()=>{'use strict';document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id),status=$('save-profile-status');
 function refresh(){const select=$('save-profile-select');select.replaceChildren();for(const p of [{id:'default',name:'Default — existing saves'},...GTASaveProfiles.list()]){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}select.value=GTASaveProfiles.selected();$('save-profile-current').textContent=select.options[select.selectedIndex]?.textContent||'Unavailable';}
 try{refresh();}catch(e){status.textContent=e.message;}
 $('save-profile-select').onchange=()=>{try{GTASaveProfiles.select($('save-profile-select').value);refresh();status.textContent='Save profile selected. Restart the game to change profile.';}catch(e){status.textContent=e.message;}};
 $('save-profile-create').onclick=()=>{try{const p=GTASaveProfiles.create($('save-profile-name').value);GTASaveProfiles.select(p.id);refresh();status.textContent='Created '+p.name+' with empty, separate Story and Sandbox saves.';}catch(e){status.textContent=e.message;}};
 $('save-profile-rename').onclick=()=>{try{GTASaveProfiles.rename(GTASaveProfiles.selected(),$('save-profile-name').value);refresh();status.textContent='Profile renamed; save identities preserved.';}catch(e){status.textContent=e.message;}};
 window.addEventListener('gta-save-profile',()=>{try{refresh();}catch(e){status.textContent=e.message;}});
});})();
