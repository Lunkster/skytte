// Router, inloggning och grunddata (skyttar, grenar, guldnivåer).
import { api, login, logout, isLoggedIn, esc } from './lib.js?v=0.4.0';
import { renderMata, tomFlash } from './mata.js?v=0.4.0';
import { renderSerier } from './serier.js?v=0.4.0';
import { renderStatistik } from './statistik.js?v=0.4.0';

const app = document.getElementById('app');
let grund = null;

export async function grunddata(fresh = false) {
  if (grund && !fresh) return grund;
  const [skyttar, grenar, guld] = await Promise.all([
    api('skytt?select=*&order=ordning,namn'),
    api('gren?select=*&order=ordning,namn'),
    api('guldniva?select=*&order=grans'),
  ]);
  guld.sort((a, b) => a.gren_id - b.gren_id || Number(a.grans) - Number(b.grans));   // numeriskt, lägst först
  grund = { skyttar, grenar, guld };
  return grund;
}

async function route() {
  const [vy, ...arg] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.route === (vy || 'mata')));
  document.getElementById('loggaut').hidden = !isLoggedIn();
  if (vy === 'loggaut') { logout(); location.hash = '#/'; return; }
  if (!isLoggedIn()) return renderLogin();
  try {
    const g = await grunddata();
    if (vy === 'serier') return await renderSerier(app, g, tomFlash());
    if (vy === 'statistik') return await renderStatistik(app, g);
    if (vy === 'serie' && arg[0]) return await renderMata(app, g, Number(arg[0]), arg[1] ?? '');
    return await renderMata(app, g);
  } catch (e) {
    if (e.status === 401) return renderLogin('Logga in igen.');
    app.innerHTML = `<div class="card fel"><h2>Något gick fel</h2><p>${esc(e.message)}</p>
      <p><button class="btn" onclick="location.reload()">Ladda om</button></p></div>`;
  }
}

function renderLogin(msg = '') {
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.remove('active'));
  app.innerHTML = `
    <form class="card login" id="loginform">
      <h1>Logga in</h1>
      <p class="muted">Familjens kod för skytteloggen.</p>
      <label for="kod">Kod</label>
      <input id="kod" type="password" autocomplete="current-password" required>
      <button class="btn primar" type="submit">Logga in</button>
      <p id="loginmsg" class="msg">${esc(msg)}</p>
    </form>`;
  const f = document.getElementById('loginform');
  f.kod.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = document.getElementById('loginmsg');
    m.textContent = 'Loggar in …';
    if (await login(f.kod.value)) { grund = null; route(); } else m.textContent = 'Fel kod – försök igen.';
  });
}

window.addEventListener('hashchange', route);
route();
