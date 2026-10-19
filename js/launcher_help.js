/* Read-only help. No GPU probes, game startup, storage cleanup or automatic upload. */
(()=>{
  'use strict';
  addEventListener('DOMContentLoaded',()=>{
    const $=id=>document.getElementById(id);
    let loaded=false,loading=null;
    const helpSections=new Map();
    const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const setupInfo=()=>[
      'GrandV web launcher — basic setup',
      'Secure context: '+(window.isSecureContext?'yes':'no'),
      'Cross-origin isolated: '+(window.crossOriginIsolated?'yes':'no'),
      'WebGPU API exposed: '+('gpu' in navigator?'yes':'no'),
      'SharedArrayBuffer exposed: '+(typeof SharedArrayBuffer!=='undefined'?'yes':'no'),
      'Gamepad API exposed: '+(typeof navigator.getGamepads==='function'?'yes':'no'),
      'Mode: '+(window.GTALauncherSettings?.currentSettings?.().mode||'unknown'),
      'API checks do not verify driver/GPU or game compatibility.'
    ].join('\n');
    async function loadHelp(){
      if(loaded)return;
      if(loading)return loading;
      loading=(async()=>{
      try{
        const response=await fetch('troubleshooting.json?v=grandv-help-20261013b');
        if(!response.ok)throw new Error('Help download failed');
        const guide=await response.json(),fragment=document.createDocumentFragment();
        if(!Array.isArray(guide.web)||!guide.web.length)throw new Error('Help file is incomplete');
        const sections=[...guide.web];
        // Browser-only clients also need the OS trust guide, without a desktop app.
        sections.splice(sections.length-1,0,...(guide.server||[]).filter(section=>
          /^(Windows: trust|macOS: trust|Linux \/ Chromebook: trust)/.test(section.title)));
        sections.forEach((section,index)=>{
          const details=document.createElement('details'),title=document.createElement('summary'),list=document.createElement('ol');
          details.open=index===0;title.textContent=section.title;details.append(title);
          helpSections.set(section.title,details);
          if(isIOS&&section.ios){
            const heading=document.createElement('h3'),iosSteps=document.createElement('ol'),links=document.createElement('p');
            heading.textContent=section.ios.title;
            for(const step of section.ios.steps||[]){const li=document.createElement('li');li.textContent=step;iosSteps.append(li);}
            for(const source of section.ios.links||[]){
              if(!source.url?.startsWith('https://'))continue;
              const link=document.createElement('a');link.href=source.url;link.textContent=source.title;link.target='_blank';link.rel='noopener noreferrer';links.append(link,document.createElement('br'));
            }
            details.append(heading,iosSteps,links);
          }
          for(const step of section.steps){const li=document.createElement('li');li.textContent=step;list.append(li);}
          details.append(list);fragment.append(details);
        });
        $('help-sections').replaceChildren(fragment);
        const sources=document.createDocumentFragment();
        for(const source of guide.sources||[]){
          if(!source.url.startsWith('https://'))continue;
          const link=document.createElement('a');link.href=source.url;link.textContent=source.title;link.target='_blank';link.rel='noopener noreferrer';sources.append(link,document.createElement('br'));
        }
        $('help-sources').replaceChildren(sources);loaded=true;
      }catch(error){$('help-sections').textContent='Help could not be loaded. Close this menu and reopen it to retry. Check that the host has the updated troubleshooting.json file.';}
      finally{loading=null;}
      })();
      return loading;
    }
    async function openHelp(sectionTitle=''){
      $('help-info').value=setupInfo();$('help-copy-status').textContent='';
      if(!$('troubleshooting-dialog').open)$('troubleshooting-dialog').showModal();
      await loadHelp();
      const section=helpSections.get(sectionTitle);
      if(section){
        for(const details of helpSections.values())details.open=details===section;
        section.scrollIntoView({block:'nearest'});
      }
    }
    window.GTALauncherHelp={open:openHelp};
    $('troubleshooting-open').onclick=()=>openHelp();
    $('help-copy').onclick=async()=>{
      try{await navigator.clipboard.writeText($('help-info').value);$('help-copy-status').textContent='Copied. Paste it into your bug report.';}
      catch(error){$('help-info').focus();$('help-info').select();$('help-copy-status').textContent='Text selected. Press Ctrl+C (⌘C on Mac) to copy.';}
    };
  });
})();
