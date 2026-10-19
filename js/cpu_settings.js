/* Browser-reported logical cores; engine worker-pool sizing, not CPU affinity. */
(function(root){
 'use strict';
 function detected(value=root.navigator?.hardwareConcurrency){return Number.isSafeInteger(value)&&value>0?value:null;}
 function normalise(value){const s=String(value??'auto');return /^[1-9]\d{0,2}$/.test(s)&&+s<=256?s:'auto';}
 function selection(value,reported=detected()){const s=normalise(value);return s==='auto'?s:String(Math.min(+s,reported||256));}
 function resolve(value,lowMemory,reported=detected()){const s=selection(value,reported);if(s!=='auto')return +s;const n=detected(reported);if(!n)return 2;return lowMemory&&n>8?6:lowMemory&&n>4?4:lowMemory&&n===4?2:Math.max(1,Math.floor(n*0.9));}
 const api={detected,normalise,selection,resolve};root.GTACpuSettings=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
