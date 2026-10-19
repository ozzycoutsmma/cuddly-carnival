// Capability is issued only by launch.py; normal website/LAN pages expose no controls.
(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('local-launch');
  if (location.hostname !== 'localhost' || !token || !/^[\w-]{40,}$/.test(token)) return;
  const panel = document.createElement('section');
  panel.className = 'panel local-server';
  panel.innerHTML = '<h2>Local server</h2><p>Export your saves before changing ports. Browser saves and settings belong to the current port; changing it opens a separate browser storage profile. Stop the game before applying.</p><form><label for="local-port">Port</label> <input id="local-port" type="number" min="1024" max="65535" required> <button type="submit">Apply port</button></form><p role="status" aria-live="polite"></p>';
  document.querySelector('main').append(panel);
  const form = panel.querySelector('form');
  const input = panel.querySelector('input');
  const button = panel.querySelector('button');
  const status = panel.querySelector('[role=status]');
  input.value = location.port || '80';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Applying port…';
    try {
      const response = await fetch('/__local/port', {method:'POST', headers:{'Content-Type':'application/json','X-Launcher-Token':token}, body:JSON.stringify({port:Number(input.value)})});
      if (!response.ok) throw new Error('Port unavailable or launcher request rejected. Current server remains running.');
      const result = await response.json();
      status.textContent = 'Opening the new local address…';
      setTimeout(() => location.assign(result.url), 1000);
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
})();
