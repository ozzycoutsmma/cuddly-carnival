/* Labels use browser-reported display metrics; no permission or setting changes. */
(function(root){
  'use strict';
  function physicalSize(width,height,ratio=1){const dpr=Number.isFinite(+ratio)&&+ratio>0?+ratio:1;return [Math.round(width*dpr/2)*2,Math.round(height*dpr/2)*2];}
  function kind(value,size){const match=/^(\d+)x(\d+)$/.exec(value);if(!match)return '';const w=+match[1],h=+match[2];return Math.abs(w-size[0])<=2&&Math.abs(h-size[1])<=2?'native':w>size[0]+2||h>size[1]+2?'supersampling':'';}
  function update(){
    const select=document.getElementById('res');if(!select)return;
    const native=physicalSize(screen.width,screen.height,devicePixelRatio),windowSize=physicalSize(innerWidth,innerHeight,devicePixelRatio);
    for(const option of select.options){
      if(option.value==='native'){option.textContent='Native window ('+windowSize.join(' × ')+')';continue;}
      const type=kind(option.value,native);option.textContent=option.value.replace('x',' × ')+(type==='native'?' — native screen':type==='supersampling'?' — supersampling':'');
      option.title=type==='native'?'Browser-reported display size; page zoom can affect this estimate.':type==='supersampling'?'Renders more pixels, then scales down. Uses more GPU time and memory.':'';
    }
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={physicalSize,kind};return;}
  let media;
  function watch(){update();media?.removeEventListener('change',watch);media=matchMedia('(resolution: '+devicePixelRatio+'dppx)');media.addEventListener('change',watch);}
  addEventListener('DOMContentLoaded',watch);addEventListener('resize',update);
})(typeof self!=='undefined'?self:globalThis);
