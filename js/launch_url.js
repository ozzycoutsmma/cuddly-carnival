/* Portable versioned settings token. Keep key order stable; append new keys only. */
(function(root){
 'use strict';
 const defaults={fps:'60',scale:'1',low:'auto',language:'system',mousegain:'1',controller:'auto',granular:'0',safeuploads:'copy',fxaa:'1',shadows:'1',cores:'auto',bcfallback:'auto',bghistory:'0',pipelast:'0',cbtemplate:'0',cbsegments:'0',texturequality:'auto',reflectionquality:'auto',waterquality:'auto',particlequality:'auto',grassquality:'auto',anisotropic:'auto',lodscale:'auto',pedlod:'auto',vehiclelod:'auto',density:'auto',pedvariety:'auto',vehiclevariety:'auto',postfx:'auto',motionblur:'auto',dof:'auto',shadowquality:'auto',softshadows:'auto',ssao:'auto',drawdistance:'auto',fogvolumes:'auto',particleshadows:'auto',longshadows:'auto',flightstreaming:'auto',distantlights:'auto'};
 const keys=[...Object.keys(defaults),'res'];
 function expand(search){
  const q=new URLSearchParams(search),token=q.get('cfg');if(!token)return q;
  q.delete('cfg');const parts=token.split('_');if(parts.shift()!=='1'||parts.length>keys.length)return q;
  const values={...defaults},seen=new Set();
  for(const part of parts){const m=/^([0-9a-z]+)-([a-zA-Z0-9.]+)$/.exec(part);if(!m)return q;const i=parseInt(m[1],36);if(i>=keys.length||seen.has(i)||m[2].length>32)return q;seen.add(i);values[keys[i]]=m[2];}
  for(const [key,value] of Object.entries(values))if(!q.has(key))q.set(key,value);
  return q;
 }
 function compact(search){
  const q=expand(search),parts=['1'];
  for(let i=0;i<keys.length;i++){const key=keys[i],value=q.get(key);if(value===null)continue;if(!/^[a-zA-Z0-9.]{1,32}$/.test(value))continue;q.delete(key);if(value!==defaults[key])parts.push(i.toString(36)+'-'+value);}
  q.set('cfg',parts.join('_'));return q;
 }
 const api={expand,compact};root.GTALaunchUrl=api;if(typeof module!=='undefined')module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
