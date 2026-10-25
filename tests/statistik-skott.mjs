// Statistik som kräver skott (v0.3.0): snitt per skottnummer, tappade poäng, svitar.
import { createRequire } from 'module';
import { skapaDb, koppla } from './attrapp.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.APP ?? 'http://localhost:8766/';
const db = skapaDb();
// Ge alla serier skott: kända mönster så att resultaten går att räkna för hand
let r = 3; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
for (const s of db.serie) {
  for (let i = 1; i <= 10; i++) db.skott.push({ serie_id: s.id, nr: i, varde: Math.round((8.6 + rnd() * 2.3 + (i === 1 ? -0.5 : 0)) * 10) / 10 });
  s.total = null; s.stjarnor = null;
}
// Anna 2026-10-20: serie 1 slutar med 3 tior, serie 2 börjar med 4 tior → svit 7 över seriegränsen
const s1 = db.serie.find((s) => s.skytt_id === 1 && s.datum === '2026-10-20' && s.nr === 1);
const s2 = db.serie.find((s) => s.skytt_id === 1 && s.datum === '2026-10-20' && s.nr === 2);
db.skott = db.skott.filter((k) => k.serie_id !== s1.id && k.serie_id !== s2.id);
[9.1, 9.5, 8.0, 9.9, 9.2, 9.6, 9.8, 10.0, 10.5, 10.9].forEach((v, i) => db.skott.push({ serie_id: s1.id, nr: i + 1, varde: v }));
[10.1, 10.2, 10.3, 10.4, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0].forEach((v, i) => db.skott.push({ serie_id: s2.id, nr: i + 1, varde: v }));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
let fel = 0;
p.on('pageerror', (e) => { fel++; console.log('SIDFEL', e.message); });
await koppla(p, db, []);
const kolla = (namn, ok, extra = '') => { if (!ok) fel++; console.log(ok ? 'OK  ' : 'FEL ', namn, extra); };
await p.goto(URL); await p.waitForTimeout(300);
await p.fill('#kod', 'kod123'); await p.click('button[type=submit]'); await p.waitForTimeout(500);
await p.goto(URL + '#/statistik'); await p.waitForTimeout(700);
await p.click('#fgren button:has-text("Luftgevär")'); await p.waitForTimeout(300);
const txt = (await p.textContent('#innehall')).replace(/\s+/g, ' ');
kolla('rubriker', ['Snitt per skottnummer', 'Tappade poäng', 'Svitar'].every((t) => txt.includes(t)));
kolla('tre paneler per skottnummer', (await p.$$('.card:has(h2:text("Snitt per skottnummer")) .panel')).length === 3);
kolla('svagast skott 1 (inbyggt sämre)', (await p.textContent('.card:has(h2:text("Snitt per skottnummer"))')).includes('svagast skott 1'));
const svit = await p.$eval('.card:has(h2:text("Svitar")) tbody', (t) => [...t.rows].map((r) => [...r.cells].map((c) => c.innerText.replace(/\s+/g, ' ')).join(' | ')));
console.log(svit.join('\n'));
kolla('Annas tiosvit 7 över seriegränsen', svit.some((r) => r.startsWith('Anna') && r.includes('7 2026-10-20')));
kolla('Annas stjärnsvit minst 3', svit.some((r) => r.startsWith('Anna') && parseInt(r.split('|')[2]) >= 3));
const tapp = await p.$eval('.card:has(h2:text("Tappade poäng")) tbody', (t) => [...t.rows].map((r) => r.innerText.replace(/\s+/g, ' ')));
console.log(tapp.join('\n'));
kolla('tappade poäng har tre skyttar', tapp.length === 3);
await p.hover('.card:has(h2:text("Snitt per skottnummer")) .traff >> nth=0'); await p.waitForTimeout(150);
kolla('tooltip skott 1', (await p.textContent('#tip')).includes('Skott 1'));
await p.screenshot({ path: 's1-skott.png', fullPage: true });
const bredd = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
kolla('ingen sidled-skroll', bredd);
console.log('fel:', fel); await b.close(); process.exit(fel ? 1 : 0);
