/* Portable, allowlisted UI preferences. Access codes, local-launch tokens and mod blobs are excluded. */
(function(root){
  'use strict';
  function validate(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)throw Error('Unsupported launcher configuration');
    const out={version:1};
    if(value.gameViewport&&root.GTAGameViewport)out.gameViewport=root.GTAGameViewport.normalise(value.gameViewport);
    if(value.keyboardControls&&root.GTAKeyboardControls)out.keyboardControls=root.GTAKeyboardControls.normalise(value.keyboardControls);
    if(value.uiAppearance&&root.GTAUIPreferences)out.uiAppearance=root.GTAUIPreferences.normalise(value.uiAppearance);
    if(value.referenceTouch)out.referenceTouch=value.referenceTouch;
    if(value.touchControls)out.touchControls=root.GTATouchControls.normalise(value.touchControls);
    if(value.multiplayer)out.multiplayer=root.GTAMultiplayerLaunch.normalisePreferences(value.multiplayer);
    if(value.mods)out.mods=root.GTAModLaunch.normalisePreferences(value.mods);
    return out;
  }
  function snapshot(){
    return {version:1,gameViewport:root.GTAGameViewport?.load(),keyboardControls:root.GTAKeyboardControls?.load(),uiAppearance:root.GTAUIPreferences?.load(),referenceTouch:root.GTATouchControls.snapshotReference(),touchControls:root.GTATouchControls.load(),multiplayer:root.GTAMultiplayerLaunch.currentPreferences(),mods:root.GTAModLaunch.currentPreferences()};
  }
  async function apply(value){
    const config=validate(value);
    if(config.gameViewport)root.GTAGameViewport.save(config.gameViewport);
    if(config.keyboardControls)root.GTAKeyboardControls.save(config.keyboardControls);
    if(config.uiAppearance)root.GTAUIPreferences.save(config.uiAppearance);
    if(config.referenceTouch)await root.GTATouchControls.saveReference(config.referenceTouch);
    if(config.touchControls&&!root.GTATouchControls.save(config.touchControls))throw Error('Browser could not save touch preferences');
    if(config.multiplayer)root.GTAMultiplayerLaunch.applyPreferences(config.multiplayer);
    if(config.mods)await root.GTAModLaunch.applyPreferences(config.mods);
    root.dispatchEvent(new Event('gta-launcher-config'));
  }
  root.GTALauncherConfig={validate,snapshot,apply};
})(typeof self!=='undefined'?self:globalThis);
