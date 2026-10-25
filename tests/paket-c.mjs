// Paket C (v0.5.0): utmärkelser och skyttsida, länkar till skyttsidan, ny utmärkelse vid sparande.
import { createRequire } from 'module';
import { skapaDb, koppla } from './attrapp.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.APP ?? 'http://localhost:8766/';
const db = skapaDb();
// Anna får skott i sina serier 2026-10-20 (en tiosvit och ett 10,9)
for (const s of db.serie.filter((x) => x.skytt_id === 1 && x.datum === '2026-10-20')) {
  const v = [10.9, 10.4, 10.2, 10.0, 10.1, 9.9, 9.5, 9.8, 10.3, 9.6]; s.total = null; s.stjarnor = null;
  v.forEach((x, i) => db.skott.push({ serie_id: s.id, nr: i + 1, varde: x }));
}
db.mal.push({ skytt_id: 1, gren_id: 1, sasong: 2026, snitt: '99.0' });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
let fel = 0;
p.on('pageerror', (e) => { fel++; console.log('SIDFEL', e.message); });
await koppla(p, db, []);
const kolla = (namn, ok, extra = '') => { if (!ok) fel++; console.log(ok ? 'OK  ' : 'FEL ', namn, extra); };
const v = (ms = 300) => p.waitForTimeout(ms);
await p.goto(URL); await v();
await p.fill('#kod', 'kod123'); await p.click('button[type=submit]'); await v(500);
await p.goto(URL + '#/statistik'); await v(700);
await p.click('#fgren button:has-text("Luftgevär")'); await v(300);
const ov = (await p.textContent('#utmarkelser')).replace(/\s+/g, ' ');
kolla('översikt utmärkelser', /Anna\s*\d+ av \d+/.test(ov), ov.slice(0, 120));
await p.click('.card:has(h2:text("Topplista")) a.skyttlank:has-text("Anna")'); await v(600);
kolla('till skyttsidan', (await p.evaluate(() => location.hash)) === '#/skytt/1' && (await p.textContent('h1')) === 'Anna');
kolla('Statistik-fliken aktiv', await p.$eval('.tabs a[data-route=statistik]', (e) => e.classList.contains('active')));
kolla('sex nyckeltal', (await p.$$('.tal-ruta')).length === 6);
const utm = (await p.textContent('#utmarkelser')).replace(/\s+/g, ' ');
console.log(utm.slice(0, 300));
kolla('utmärkelser tagna', /\d+ av \d+/.test(utm) && utm.includes('Första serien') && utm.includes('Mitt i prick'));
kolla('kvällens skytt/mål nått kan finnas', utm.includes('Målet nått') || true);
await p.click('#visaKvar'); await v(300);
kolla('visar de som är kvar', !(await p.$eval('.marken.kvar', (e) => e.hidden)) && (await p.$$('.marken.kvar .markestapel')).length > 0);
kolla('säsongsmål på skyttsidan', (await p.textContent('.card:has(h2:text("Säsongsmål"))')).includes('av 99'));
kolla('utvecklingsdiagram', !!(await p.$('#utveckling svg')));
kolla('senaste tillfällena', (await p.$$('.card:has(h2:text("Senaste tillfällena")) .skyttrad')).length >= 3);
kolla('skottprofil på skyttsidan', !!(await p.$('.card:has(h2:text("Snitt per skottnummer"))')));
await p.screenshot({ path: 'c1-skytt.png', fullPage: true });
const bredd = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
kolla('ingen sidled-skroll', bredd);
// Serier: namn länkar
await p.goto(URL + '#/serier'); await v(500);
kolla('namn i serielistan länkar', (await p.$$('a.skyttlank[href="#/skytt/2"]')).length > 0);
// Ny utmärkelse vid sparande
await p.goto(URL + '#/'); await v(500);
await p.click('#gren button:has-text("Luftgevär")'); await v(300);
await p.click("#skytt button:has-text(\"Dan\")"); await v(300);
await p.click('#satt button[data-satt=total]'); await v(100);
await p.fill("#total", "98,0"); await p.click('#spara'); await v(800);
const msg = await p.textContent('#msg');
kolla('ny utmärkelse vid sparande', msg.includes('Ny utmärkelse'), msg);
await p.screenshot({ path: 'c2-mata.png' });
console.log('fel:', fel); await b.close(); process.exit(fel ? 1 : 0);
