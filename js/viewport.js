/* Shared canvas presentation; independent portrait/landscape preferences. */
(()=>{
 'use strict';
 const KEY='gta5-game-viewport-v1';
 const clamp=(v,lo,hi,f)=>Number.isFinite(+v)?Math.min(hi,Math.max(lo,+v)):f;
 function normalise(raw){
  const out={};
  for(const orientation of ['portrait','landscape']){
   const v=raw?.[orientation]||{};
   out[orientation]={mode:['full','fit','custom'].includes(v.mode)?v.mode:'full',scale:clamp(v.scale,25,100,75),x:clamp(v.x,0,100,50),y:clamp(v.y,0,100,0)};
  }
  return out;
 }
 function load(){try{return normalise(JSON.parse(localStorage.getItem(KEY)));}catch(_){return normalise();}}
 const orientation=()=>innerHeight>innerWidth?'portrait':'landscape';
 function rect(width,height,v){
  if(v.mode==='full')return {left:0,top:0,width,height};
  const scale=v.mode==='custom'?v.scale/100:1;
  const w=Math.min(width,height*16/9)*scale,h=w*9/16;
  return {left:(width-w)*v.x/100,top:(height-h)*v.y/100,width:w,height:h};
 }
 function apply(){
  const el=document.getElementById('viewport-preview')||document.getElementById('canvas');
  if(!el)return;
  const r=rect(innerWidth,innerHeight,load()[orientation()]);
  for(const key of ['left','top','width','height'])el.style[key]=r[key]+'px';
  dispatchEvent(new Event('touchviewportchange'));
 }
 function save(value){const v=normalise(value);localStorage.setItem(KEY,JSON.stringify(v));apply();return v;}
 window.GTAGameViewport={normalise,load,save,apply,rect,orientation};
 addEventListener('resize',apply);
 addEventListener('storage',e=>{if(e.key===KEY)apply();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
