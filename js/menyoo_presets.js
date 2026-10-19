/* Bounded, data-only upstream Menyoo XML presets. Native C++ performs all game actions. */
(function(root){'use strict';
 const KEY='gta5.menyoo.presets.v1',MAX_BYTES=524288,allowed=new Set([16,120,121,122,123,80,81,83,84,86,87,88,89,91,101,102,151,152,153]);
 const fail=m=>{throw Error(m);};
 function validate(p){
  if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!['vehicle','outfit','scene'].includes(p.kind)||!Array.isArray(p.steps)||!p.steps.length||p.steps.length>512)fail('Invalid Menyoo preset');
  const steps=p.steps.map(s=>{if(!s||!allowed.has(s.code)||!Array.isArray(s.args)||s.args.length!==3||!s.args.every(x=>Number.isInteger(x)&&Math.abs(x)<=100000)||!Array.isArray(s.xyz)||s.xyz.length!==3||!s.xyz.every(x=>Number.isFinite(x)&&Math.abs(x)<=100000)||typeof s.text!=='string'||s.text.length>126||/[^\x20-\x7e]/.test(s.text))fail('Invalid preset operation');return {code:s.code,args:s.args.slice(),xyz:s.xyz.slice(),text:s.text};});
  const count=steps.filter(s=>s.code===120).length;if(count>32)fail('A preset can contain at most 32 entities');
  const parents=new Map();let spawned=0,attaching=false;
  for(let i=0;i<steps.length;i++){const s=steps[i];if(s.code===120){if(attaching)fail('Attachments must follow all spawns');spawned++;}if(s.code===152){attaching=true;if(!['scene','vehicle'].includes(p.kind)||s.xyz.some(v=>Math.abs(v)>360)||steps[i+1]?.code!==153)fail('Invalid attachment rotation');}if(s.code===153){if(!['scene','vehicle'].includes(p.kind)||steps[i-1]?.code!==152||s.args[0]<0||s.args[0]>=spawned||s.args[1]<0||s.args[1]>=spawned||s.args[0]===s.args[1]||s.args[2]<0||s.args[2]>1024||s.xyz.some(v=>Math.abs(v)>100)||parents.has(s.args[0]))fail('Invalid scene attachment');parents.set(s.args[0],s.args[1]);}}
  for(const start of parents.keys()){const seen=new Set();let n=start;while(parents.has(n)){if(seen.has(n))fail('Attachment cycle');seen.add(n);n=parents.get(n);}}

  return {name:p.name.trim(),kind:p.kind,steps,warnings:(Array.isArray(p.warnings)?p.warnings:[]).slice(0,64).map(x=>String(x).slice(0,160))};
 }
 function list(storage=root.localStorage){const raw=storage.getItem(KEY)||'[]';if(raw.length>MAX_BYTES)fail('Preset library exceeds 512 KiB');const rows=JSON.parse(raw);if(!Array.isArray(rows)||rows.length>64)fail('Invalid preset library');return rows.map(validate);}
 function save(p,storage=root.localStorage){p=validate(p);const rows=list(storage);if(rows.length>=64)fail('Keep at most 64 presets');rows.push(p);const raw=JSON.stringify(rows);if(raw.length>MAX_BYTES)fail('Preset library exceeds 512 KiB');storage.setItem(KEY,raw);return rows.length-1;}
 function remove(index,storage=root.localStorage){const rows=list(storage);if(!Number.isInteger(index)||index<0||index>=rows.length)fail('Select a preset');rows.splice(index,1);storage.setItem(KEY,JSON.stringify(rows));}
 function parse(xml,name='Imported preset'){
  if(typeof xml!=='string'||xml.length>MAX_BYTES)fail('XML exceeds 512 KiB');if(/<!DOCTYPE|<!ENTITY/i.test(xml))fail('DTD and external entities are unsupported');
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)fail('Malformed XML');if(doc.getElementsByTagName('*').length>8192)fail('XML has too many elements');
  const steps=[],warnings=new Set(),seen=new Set(),child=(n,k)=>[...(n?.children||[])].find(x=>x.tagName===k),value=n=>n?.textContent.trim()||'',get=(n,k)=>value(child(n,k));
  const mark=n=>{if(n)seen.add(n);return n;},read=(n,k)=>value(mark(child(n,k)));
  const num=(v,lo,hi)=>{const n=Number(v);if(v===''||!Number.isFinite(n)||n<lo||n>hi)fail('Invalid numeric value: '+v);return n;},integer=(v,lo,hi)=>{const n=num(v,lo,hi);if(!Number.isInteger(n))fail('Expected integer: '+v);return n;},bool=v=>{if(!/^(true|false|0|1)$/i.test(v))fail('Invalid boolean: '+v);return /^(true|1)$/i.test(v);};
  const add=(code,args=[0,0,0],xyz=[0,0,0],text='')=>{steps.push({code,args,xyz,text});if(steps.length>512)fail('Preset exceeds 512 operations');};
  const model=n=>{let s=read(n,'ModelHash')||read(n,'HashName');if(/^-?\d+$/.test(s)){const h=num(s,-2147483648,4294967295)>>>0;s='0x'+h.toString(16);}if(!/^(?:0x[0-9a-f]{1,8}|[a-z][a-z0-9_]{0,63})$/i.test(s))fail('Invalid or missing model hash');return s;};
  function clothing(n){const props=child(n,'PedProperties');if(!props)return;for(const [tag,code,max] of [['PedComps',101,11],['PedProps',102,7]]){const group=child(props,tag);for(const row of group?.children||[]){mark(row);if(!/^_\d+$/.test(row.tagName))fail('Unsupported clothing slot');const slot=integer(row.tagName.slice(1),0,max),pair=value(row).split(',');if(pair.length!==2)fail('Expected drawable,texture');const drawable=integer(pair[0].trim(),code===102?-1:0,4095),texture=integer(pair[1].trim(),-1,255);add(code,[slot,drawable,Math.max(0,texture)]);}}}
  function vehicle(n){const props=child(n,'VehicleProperties');if(!props)return;
   const colours=child(props,'Colours');if(colours){const a=read(colours,'Primary'),b=read(colours,'Secondary');if(a!==''&&b!=='')add(16,[integer(a,0,159),integer(b,0,159),0]);for(const [tag,which] of [['IsPrimaryColourCustom',0],['IsSecondaryColourCustom',1]]){const custom=read(colours,tag);if(custom&&bool(custom))add(86,[which,0,0],['r','g','b'].map(c=>integer(read(colours,'Cust'+(which+1)+'_'+c),0,255)));}}
   for(const [tag,code,lo,hi] of [['WheelType',84,0,7],['WindowTint',88,-1,6],['Livery',83,-1,255]]){const v=read(props,tag);if(v!=='')add(code,[integer(v,lo,hi),0,0]);}
   const plate=read(props,'NumberPlateText');if(plate){if(plate.length>8||/[^\x20-\x7e]/.test(plate))fail('Plate text must contain at most eight ASCII characters');add(87,[0,0,0],[0,0,0],plate);}
   for(const row of child(props,'Mods')?.children||[]){mark(row);if(!/^_\d+$/.test(row.tagName))fail('Invalid vehicle mod slot');const slot=integer(row.tagName.slice(1),0,49),v=value(row);if(slot>=17&&slot<=22){if([18,20,22].includes(slot))add(81,[slot,+bool(v),0]);else warnings.add('Toggle mod slot '+slot+' is unsupported');}else{const pair=v.split(',');add(80,[slot,integer(pair[0].trim(),-1,4095),pair[1]?+bool(pair[1].trim()):0]);}}
   const bullet=read(props,'BulletProofTyres');if(bullet!=='')add(91,[0,+bool(bullet),0]);
  }
  // Colour operation shares the normal native trainer command.

  const top=doc.documentElement;let kind,placements=[];
  if(top.tagName==='Vehicle'){kind='vehicle';add(120,[3,0,0],[0,0,0],model(top));vehicle(top);const extras=[...(child(top,'SpoonerAttachments')?.children||[])];if(extras.length>31)fail('Vehicle assembly exceeds 32 entities');placements=[top,...extras];for(const n of extras){if(n.tagName!=='Attachment'||!bool(child(n,'Attachment')?.getAttribute('isAttached')||'false'))fail('Vehicle assembly entities must be attached');const type=integer(read(n,'Type'),1,3);add(120,[{1:2,2:3,3:1}[type],0,0],[0,0,0],model(n));if(type===2)vehicle(n);if(type===1)clothing(n);}}

  else if(top.tagName==='OutfitPedData'){kind='outfit';add(151,[0,0,0],[0,0,0],model(top));clothing(top);if(steps.length===1)fail('Outfit contains no supported clothing components or props');}
  else if(top.tagName==='SpoonerPlacements'){kind='scene';placements=[...top.children].filter(n=>n.tagName==='Placement');if(!placements.length||placements.length>32)fail('Scene needs 1-32 Placement entities');for(const n of placements){const type=integer(read(n,'Type'),1,3),mapped={1:2,2:3,3:1}[type];add(120,[mapped,0,0],[0,0,0],model(n));const pos=child(n,'PositionRotation');if(!pos)fail('Scene entity has no PositionRotation');add(121,[0,0,0],['X','Y','Z'].map((k,i)=>num(read(pos,k),i===2?-1000:-100000,i===2?5000:100000)));add(122,[0,0,0],['Pitch','Roll','Yaw'].map(k=>num(read(pos,k)||'0',-360,360)));const frozen=read(n,'FrozenPos'),visible=read(n,'IsVisible'),collision=read(n,'IsCollisionProof'),god=read(n,'IsInvincible');add(123,[(frozen&&bool(frozen)?1:0)|(collision&&bool(collision)?0:2)|(visible===''||bool(visible)?4:0)|(god&&bool(god)?8:0),0,0]);if(type===2)vehicle(n);if(type===1)clothing(n);}}
  else fail('Expected Menyoo Vehicle, OutfitPedData or SpoonerPlacements XML');
  const attachments=[...doc.getElementsByTagName('Attachment')].filter(n=>bool(n.getAttribute('isAttached')||'false'));
  if(attachments.length){if(!['scene','vehicle'].includes(kind))fail('Attachments require a scene or vehicle assembly');const handles=new Map();for(let i=0;i<placements.length;i++){const h=read(placements[i],'InitialHandle');if(h){integer(h,1,2147483647);if(handles.has(h))fail('Duplicate InitialHandle');handles.set(h,i);}}for(const a of attachments){const entity=placements.indexOf(a.parentElement),target=read(a,'AttachedTo');if(entity<0||!handles.has(target))fail('Attachment target must be another entity in this scene');add(152,[0,0,0],['Pitch','Roll','Yaw'].map(k=>num(read(a,k)||'0',-360,360)));add(153,[entity,handles.get(target),integer(read(a,'BoneIndex')||'0',0,1024)],['X','Y','Z'].map(k=>num(read(a,k)||'0',-100,100)));}}

  for(const n of doc.getElementsByTagName('*'))if(!n.children.length&&!seen.has(n)&&value(n)&&!['InitialHandle','HashName'].includes(n.tagName))warnings.add('Not applied: '+n.parentElement?.tagName+'/'+n.tagName);
  return validate({name:String(name).replace(/\.xml$/i,'').trim().slice(0,80),kind,steps,warnings:[...warnings]});
 }
 root.MenyooPresets={validate,list,save,remove,parse};
})(typeof self!=='undefined'?self:globalThis);
