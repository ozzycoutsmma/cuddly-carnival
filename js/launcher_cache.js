/* Deletes only disposable caches owned by this port. Saves are a separate store. */
(function(root) {
  'use strict';
  async function gameIsOpen(Channel = root.BroadcastChannel) {
    if (!Channel) throw new Error('Game-tab detection is unavailable. Close game tabs and use a supported browser.');
    return new Promise(resolve => {
      const channel = new Channel('gta-cache-control'), token = Math.random().toString(36).slice(2);
      let active = false;
      channel.onmessage = e => { if (e.data?.type === 'active' && e.data.token === token) active = true; };
      channel.postMessage({type:'probe',token});
      setTimeout(() => { channel.close(); resolve(active); }, 500);
    });
  }
  async function clearGameCache(env = root) {
    const storage = env.navigator?.storage;
    if (!storage?.getDirectory) throw new Error('Game-cache storage is unavailable in this browser.');
    const directory = await storage.getDirectory();
    let gameData;
    try { gameData = await directory.getDirectoryHandle('gamedata'); }
    catch (e) { if (e.name !== 'NotFoundError') throw e; }
    if (gameData) {
      // Remove the index first so a partial failure never leaves pointers to a
      // missing store. Do not remove the OPFS root or any user-data directory.
      for (const name of ['journal.bin','store.bin']) {
        try { await gameData.removeEntry(name); }
        catch (e) { if (e.name !== 'NotFoundError') throw e; }
      }
    }
    if (env.caches) for (const key of await env.caches.keys()) {
      if (key.startsWith('gamedata')) await env.caches.delete(key);
    }
  }
  async function clearShaderCache(idb = root.indexedDB) {
    if (!idb) throw new Error('Shader-cache storage is unavailable.');
    const db = await new Promise((resolve,reject) => {
      const request = idb.open('gta-pipelines',1);
      request.onupgradeneeded = () => request.result.createObjectStore('recipes');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other game tabs before clearing the shader cache.'));
    });
    try {
      await new Promise((resolve,reject) => {
        const transaction = db.transaction('recipes','readwrite');
        transaction.objectStore('recipes').clear();
        transaction.oncomplete = resolve;
        transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Shader-cache reset failed.'));
      });
    } finally { db.close(); }
  }
  const api = {gameIsOpen,clearGameCache,clearShaderCache};
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GTALauncherCache = api;
  document.addEventListener('DOMContentLoaded',() => {
    const $ = id => document.getElementById(id), dialog = $('cache-dialog');
    $('clear-cache-open').onclick = () => { $('cache-result').textContent = ''; dialog.showModal(); };
    $('cache-cancel').onclick = () => dialog.close();
    $('cache-confirm').onclick = async () => {
      const controls = [$('cache-confirm'),$('cache-cancel'),$('start'),$('clear-cache-open'),$('cache-shaders')];
      const previous = controls.map(e => e.disabled), clearShaders = $('cache-shaders').checked;
      controls.forEach(e => e.disabled = true);
      dialog.oncancel = e => e.preventDefault();
      $('cache-result').textContent = 'Checking game tabs…';
      try {
        if (await gameIsOpen()) throw new Error('Close all game tabs for this site, then try again.');
        $('cache-result').textContent = 'Clearing downloaded game data…';
        await clearGameCache();
        if (clearShaders) await clearShaderCache();
        $('cache-result').textContent = 'Cache cleared. Saves and settings kept. The next launch will rebuild the cache.';
      } catch(e) {
        $('cache-result').textContent = 'Cache reset did not complete: ' + e.message + ' Saves and settings were not removed.';
      } finally { controls.forEach((e,i) => e.disabled = previous[i]); dialog.oncancel = null; }
    };
  });
})(typeof self !== 'undefined' ? self : globalThis);
