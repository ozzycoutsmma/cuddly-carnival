/* Pre-launch engine settings. Apply after custom args; never edit SGTA saves. */
(function (root) {
  'use strict';
  const choices = {
    texturequality: ['auto','0','1','2'], reflectionquality: ['auto','0','1','2','3'],
    waterquality: ['auto','0','1'], particlequality: ['auto','0','1','2'],
    grassquality: ['auto','0','1','2','3'], anisotropic: ['auto','0','2','4','8','16'],
    lodscale: ['auto','0','0.25','0.5','0.75','1'],
    pedlod: ['auto','0','0.25','0.5','0.75','1'], vehiclelod: ['auto','0','0.25','0.5','0.75','1'],
    density: ['auto','0','0.25','0.5','0.75','1'],
    pedvariety: ['auto','0','0.25','0.5','0.75','1'], vehiclevariety: ['auto','0','0.25','0.5','0.75','1'],
    postfx: ['auto','0','1','2','3'], motionblur: ['auto','0','0.25','0.5','1'], dof: ['auto','0','1'],
    shadowquality: ['auto','0','1','2'], softshadows: ['auto','0','1','2','3','4','5'], ssao: ['auto','0','1','2'],
    drawdistance: ['auto','10','25','50','100','200','500','1000','2000','5000'],
    fogvolumes: ['auto','0','1'], particleshadows: ['auto','0','1'], longshadows: ['auto','0','1'],
    flightstreaming: ['auto','0','1'], distantlights: ['auto','0']
  };
  const flags = {texturequality:'textureQuality',reflectionquality:'reflectionQuality',waterquality:'waterQuality',particlequality:'particleQuality',grassquality:'grassQuality',anisotropic:'anisotropicQualityLevel',lodscale:'lodScale',pedlod:'pedLodBias',vehiclelod:'vehicleLodBias',density:'cityDensity',pedvariety:'pedVariety',vehiclevariety:'vehicleVariety',postfx:'postFX',motionblur:'MotionBlurStrength',dof:'noInGameDOF',shadowquality:'shadowQuality',softshadows:'shadowSoftness',ssao:'SSAO'};
  // SettingsManager.cpp assigns m_DoF = (noInGameDOF == 1), despite the flag name.
  function normalise(raw) {
    const out = {};
    for (const key of Object.keys(choices)) out[key] = choices[key].includes(String(raw?.[key])) ? String(raw[key]) : 'auto';
    return out;
  }
  function engineArgs(search) {
    const q = new URLSearchParams(search), settings = normalise(Object.fromEntries(q));
    const args=Object.keys(flags).filter(key => settings[key] !== 'auto').map(key => '-' + flags[key] + '=' + settings[key]);
    for(const [key,flag] of Object.entries({drawdistance:'farclip',fogvolumes:'fogVolumes',particleshadows:'particleShadows',longshadows:'shadowLongShadows',flightstreaming:'HDStreamingInFlight'}))if(settings[key]!=='auto')args.push('-'+flag+'='+settings[key]);
    if(settings.distantlights==='0')args.push('-nolodlights');
    return args;
  }
  function shadowArg(search){const q=new URLSearchParams(search),quality=normalise(Object.fromEntries(q)).shadowquality;return '-shadowQuality='+(q.get('shadows')==='0'?-1:quality==='auto'?'0':quality);}
  function preset(name) {
    const reset={fps:'60',scale:'1',low:'auto',res:'native',shadows:true,fxaa:'1',safeuploads:'copy',...normalise({})};
    if(name==='default')return reset;
    // Stock minimum quality without the low-spec preset's memory, distance or shadow cuts.
    if(name==='low-normal'){const value={...reset,low:'0',fxaa:'0',texturequality:'0',reflectionquality:'0',waterquality:'0',particlequality:'0',grassquality:'0',anisotropic:'0',lodscale:'0',density:'0',pedvariety:'0',vehiclevariety:'0',postfx:'0',motionblur:'0',dof:'0',shadowquality:'0',softshadows:'0',ssao:'0'};delete value.fps;delete value.res;return value;}
    if(name==='low'){const value={...reset,scale:'0.75',low:'1',shadows:false,fxaa:'0',texturequality:'0',reflectionquality:'0',waterquality:'0',particlequality:'0',grassquality:'0',anisotropic:'0',lodscale:'0.25',pedlod:'0',vehiclelod:'0',density:'0.25',pedvariety:'0',vehiclevariety:'0',postfx:'0',motionblur:'0',dof:'0',shadowquality:'0',softshadows:'0',ssao:'0',drawdistance:'200',fogvolumes:'0',particleshadows:'0',longshadows:'0',flightstreaming:'0',distantlights:'0'};delete value.fps;return value;}
    if(name==='max')return {...normalise({}),shadows:true,fxaa:'1',safeuploads:'copy',texturequality:'2',reflectionquality:'3',waterquality:'1',particlequality:'2',grassquality:'3',anisotropic:'16',lodscale:'1',pedlod:'1',vehiclelod:'1',density:'1',pedvariety:'1',vehiclevariety:'1',postfx:'3',motionblur:'1',dof:'1',shadowquality:'2',softshadows:'3',ssao:'2',fogvolumes:'1',particleshadows:'1',longshadows:'1',flightstreaming:'1'};
    throw Error('Unknown graphics preset');
  }
  root.GTAGraphicsSettings = { choices, normalise, engineArgs, shadowArg, preset };
  if (typeof module !== 'undefined') module.exports = root.GTAGraphicsSettings;
})(typeof self !== 'undefined' ? self : globalThis);
