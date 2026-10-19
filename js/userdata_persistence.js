/* Shared production save code: engine workers, startup restore and launcher. */
'use strict';
(function (root) {
  const LIMIT = 64 * 1024 * 1024, FILE_LIMIT = 32 * 1024 * 1024, MAX_FILES = 512;
  const warnings = [];
  let queue = Promise.resolve();
  const checkedProfile = (p) => { if (!/^[0-9a-f]{32}$/.test(p || '')) throw new Error('Invalid save profile'); return p; };
  function path(value) {
    if (typeof value !== 'string') throw new Error('Invalid save path');
    const p = value.replace(/\\/g, '/');
    if (!p.startsWith('/userdata/') || p.length > 1024 || !p.slice(10) || p.split('/').slice(2).some((s) => !s || s === '.' || s === '..' || /[<>:"|?*\x00-\x1f]/.test(s) || /[. ]$/.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s))) throw new Error('Invalid save path');
    return p;
  }
  const validPath = (p) => { try { return path(p) === p; } catch (_) { return false; } };
  const key = (p, f) => checkedProfile(p) + '\0' + f;
  const b64 = (data) => { let s = ''; for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000)); return btoa(s); };
  function unb64(s) { if (typeof s !== 'string' || s.length > Math.ceil(FILE_LIMIT / 3) * 4 + 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) throw new Error('Invalid save encoding'); const d = Uint8Array.from(atob(s), (x) => x.charCodeAt(0)); if (d.length > FILE_LIMIT) throw new Error('Save file exceeds 32 MiB'); return d; }
  function record(row) {
    if (!row || !Number.isFinite(row.mtime) || row.mtime < 0) throw new Error('Invalid save metadata');
    if (row.deleted === true) return { deleted: true, mtime: row.mtime };
    const data = row.data instanceof Uint8Array ? row.data : row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : null;
    if (!data || data.length > FILE_LIMIT) throw new Error('Invalid save bytes');
    return { data, mtime: row.mtime, ...(row.fsPath ? { fsPath: row.fsPath } : {}) };
  }
  function scope(mode = 'story') { if (mode === 'story') return 'story'; if (mode === 'sandbox' || mode === 'env_test') return 'sandbox'; throw new Error('Invalid save scope'); }
  function profile(storage = localStorage, mode = 'story') {
    const sandbox = scope(mode) === 'sandbox', story = sandbox ? profile(storage,'story') : null;
    const name = sandbox ? 'gta5.userdata.sandbox.profile.v1' : 'gta5.userdata.profile.v2';
    let p = storage.getItem(name);
    if (!/^[0-9a-f]{32}$/.test(p || '') || sandbox && p === story) {
      p = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
      if (p === story) p = (parseInt(p[0],16)^1).toString(16) + p.slice(1);
      storage.setItem(name,p);
    }
    return p;
  }
  function open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('Browser save storage unavailable'));
      const r = indexedDB.open('gta5-userdata', 2); let finished = false;
      const timer = setTimeout(() => fail(new Error('Browser save storage did not open')), 8000);
      function fail(e) { if (finished) return; finished = true; clearTimeout(timer); reject(e); }
      r.onblocked = () => fail(new Error('Close other game tabs to upgrade save storage'));
      r.onerror = () => fail(r.error);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files'); };
      r.onsuccess = () => { if (finished) { r.result.close(); return; } finished = true; clearTimeout(timer); r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    });
  }
  function read(db, prefix) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Browser save storage unavailable'));
      const rows = new Map(); let tx;
      try { tx = db.transaction('files', 'readonly'); } catch (e) { reject(e); return; }
      tx.onabort = () => reject(tx.error || new Error('Save read aborted'));
      tx.onerror = () => reject(tx.error);
      const r = tx.objectStore('files').openCursor();
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const c = r.result; if (!c) return;
        const k = String(c.key);
        if (k.startsWith(prefix)) {
          try { const original = prefix === '/userdata/' ? k : k.slice(prefix.length); const f = path(original); const value = record(c.value); if (original !== f) value.fsPath = original; rows.set(f, value); }
          catch (e) { reject(e); tx.abort(); return; }
        }
        c.continue();
      };
      tx.oncomplete = () => resolve(rows);
    });
  }
  async function http(url, options = {}, fetcher = fetch) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try { const r = await fetcher(url, { ...options, signal: controller.signal }); if (!r.ok) throw new Error('Disk save storage HTTP ' + r.status); return r; } finally { clearTimeout(timer); }
  }
  async function restore(db, p, fetcher = fetch, mode = 'story', legacy = true) {
    checkedProfile(p); const saveScope = scope(mode), rows = new Map(), errors = []; let succeeded = 0;
    try { if (saveScope === 'story' && legacy) for (const [f,v] of await read(db, '/userdata/')) rows.set(f,v); const own = await read(db, key(p, '')); for (const [f,v] of own) rows.set(f,v); succeeded++; } catch (e) { errors.push(String(e)); }
    try {
      const remote = await (await http('/userdata/' + p, { cache: 'no-store' }, fetcher)).json();
      if (!Array.isArray(remote.files) || !Array.isArray(remote.tombstones || [])) throw new Error('Invalid disk save manifest');
      for (const r of [...remote.files, ...(remote.tombstones || []).map((t) => ({ ...t, deleted: true }))]) {
        const f = path(r.path), v = record(r.deleted ? r : { ...r, data: unb64(r.data) }), old = rows.get(f);
        if (!old || v.mtime > old.mtime || (v.mtime === old.mtime && v.deleted && !old.deleted)) rows.set(f,v);
      }
      succeeded++;
    } catch (e) { errors.push(String(e)); }
    if (!succeeded) throw new Error('Cannot read either save store: ' + errors.join('; '));
    let total = 0; for (const r of rows.values()) total += r.data ? r.data.length : 0;
    if (rows.size > MAX_FILES || total > LIMIT) throw new Error('Save profile exceeds 64 MiB or 512 files');
    rows.storageWarnings = errors; return rows;
  }
  function putRows(db, p, rows, backupRows, token) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Browser save storage unavailable'));
      let tx, timer, finished = false;
      const finish = (error) => { if (finished) return; finished = true; clearTimeout(timer); error ? reject(error) : resolve(); };
      const fail = (error) => { finish(error); try { if (tx) tx.abort(); } catch (_) {} };
      try {
        tx = db.transaction('files', 'readwrite');
        tx.oncomplete = () => finish();
        tx.onabort = tx.onerror = () => finish(tx.error || new Error('Save write aborted'));
        // Leave headroom before the engine's existing 10-second acknowledgement limit.
        timer = setTimeout(() => fail(new Error('Browser save write timed out after 8 seconds')), 8000);
        const s = tx.objectStore('files');
        if (backupRows) for (const [f,v] of backupRows) s.put(v, token + f);
        for (const [f,v] of rows) s.put(v, key(p,f));
      } catch (e) { fail(e); }
    });
  }
  async function mirror(p, f, value, fetcher = fetch) {
    const encoded = btoa(unescape(encodeURIComponent(f))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    await http('/userdata/' + checkedProfile(p) + '/' + encoded, value.deleted ? { method:'DELETE', headers:{'X-Userdata-Mtime':String(value.mtime)} } : { method:'PUT', headers:{'Content-Type':'application/octet-stream','X-Userdata-Mtime':String(value.mtime)}, body:value.data }, fetcher);
  }
  async function commit(db,p,original,value,fetcher) {
    const f = path(original), v = value ? record(value) : {deleted:true,mtime:Date.now()}; if (original !== f) v.fsPath = original;
    const errors=[]; let browser=false,disk=false;
    // Independent backends: a hung browser transaction must not delay disk storage.
    // The outer queue still preserves write/delete ordering for both stores.
    const results = await Promise.allSettled([putRows(db,p,new Map([[f,v]])), mirror(p,f,v,fetcher)]);
    browser = results[0].status === 'fulfilled'; disk = results[1].status === 'fulfilled';
    for (const result of results) if (result.status === 'rejected') errors.push(String(result.reason));
    if (!browser && !disk) throw new Error(errors.join('; '));
    return { browser,disk,errors };
  }
  function write(db,p,f,v,fetcher = fetch) { const job = queue.catch(() => {}).then(() => commit(db,p,f,v,fetcher)); queue=job; return job; }
  const flush = () => queue;
  async function exportProfile(db,p,includeProfile=false,fetcher=fetch,mode='story',legacy=true) { const saveScope=scope(mode), rows=await restore(db,p,fetcher,saveScope,legacy), files=[]; for(const [f,v] of rows) files.push({path:f,data:v.data?b64(v.data):null,mtime:v.mtime,deleted:!!v.deleted,...(v.fsPath?{fsPath:v.fsPath}:{})}); return {formatVersion:1,saveScope,...(includeProfile?{profile:p}:{}),files}; }
  function stage(bundle) {
    if (!bundle || bundle.formatVersion!==1 || !Array.isArray(bundle.files) || bundle.files.length>MAX_FILES) throw new Error('Unsupported save export');
    const rows=new Map(); let total=0;
    for(const r of bundle.files) { const f=path(r && r.path); if(rows.has(f) || typeof r.deleted!=='boolean' || !Number.isFinite(r.mtime) || r.mtime<0) throw new Error('Invalid or duplicate save entry'); const v=record(r.deleted?r:{...r,data:unb64(r.data)}); if(r.fsPath && path(r.fsPath)!==f) throw new Error('Invalid original save path'); total+=v.data?v.data.length:0; if(total>LIMIT) throw new Error('Import exceeds 64 MiB'); rows.set(f,v); }
    return rows;
  }
  async function importBundle(db,p,bundle,mode='story',legacy=true) {
    const saveScope=scope(mode);
    if (bundle?.saveScope === undefined ? saveScope !== 'story' : bundle.saveScope !== saveScope) throw new Error('Save scope mismatch: import '+saveScope+' saves here. Older untagged backups belong to Story.');
    const rows=stage(bundle), old=await restore(db,p,fetch,saveScope,legacy), now=Math.max(Date.now(),...Array.from(old.values(),(r)=>r.mtime+1)), token='backup\0'+checkedProfile(p)+'\0'+Date.now()+'-'+Math.random().toString(16).slice(2)+'\0';
    for(const v of rows.values()) v.mtime=now;
    await putRows(db,p,rows,old,token); warnings.length=0;
    for(const [f,v] of rows) try { await mirror(p,f,v); } catch(e) { warnings.push(String(e)); }
    return token;
  }
  async function rollbackImport(db,p,token,mode='story',legacy=true) {
    if(typeof token!=='string' || !token.startsWith('backup\0'+checkedProfile(p)+'\0')) throw new Error('Invalid import backup');
    const old=await read(db,token), current=await restore(db,p,fetch,scope(mode),legacy), rows=new Map(), now=Math.max(Date.now(),...Array.from(current.values(),(r)=>r.mtime+1));
    for(const f of new Set([...current.keys(),...old.keys()])) rows.set(f,old.has(f)?{...old.get(f),mtime:now}:{deleted:true,mtime:now});
    await putRows(db,p,rows); warnings.length=0;
    for(const [f,v] of rows) try { await mirror(p,f,v); } catch(e) { warnings.push(String(e)); }
  }
  root.GTAUserdataPersistence={path,validPath,scope,profile,open,read,restore,write,flush,exportProfile,importBundle,rollbackImport,stage,warnings};
})(typeof self!=='undefined'?self:globalThis);
