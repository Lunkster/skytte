// Komplettera serier inmatade som total med skotten från utskriften (v0.2.0).
// Kör: (cd .. && python3 -m http.server 8766 &) ; node komplettera.mjs
import { createRequire } from 'module';
import { skapaDb, koppla } from './attrapp.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.APP ?? 'http://localhost:8766/';
const db = skapaDb(), log = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
let fel = 0; const dialoger = [];
p.on('pageerror', (e) => { fel++; console.log('SIDFEL', e.message); });
p.on('dialog', (d) => { dialoger.push(d.message()); d.accept(); });
await koppla(p, db, log);
const kolla = (namn, ok, extra = '') => { if (!ok) fel++; console.log(ok ? 'OK  ' : 'FEL ', namn, extra); };
const vanta = (ms = 300) => p.waitForTimeout(ms);
// Skott som summerar till en total: lika fördelat, resten på sista skottet
const skottFor = (total) => { const v = Array(9).fill(Math.floor(total) / 10 > 10.9 ? 10.9 : Math.round(total) / 10); const rest = Math.round((total - v.reduce((a, x) => a + x, 0)) * 10) / 10; return [...v, rest].map((x) => x.toFixed(1).replace('.', ',')); };

await p.goto(URL); await vanta();
await p.fill('#kod', 'kod123'); await p.click('button[type=submit]'); await vanta(500);

// Serielistan: filtret Bara serier utan skott
await p.goto(URL + '#/serier'); await vanta(500);
await p.click('#fskytt button:has-text("Anna")'); await vanta(100);
await p.check('#futan'); await vanta(200);
kolla('antal utan skott', (await p.textContent('#antalutan')).includes('(12 av 12)'), await p.textContent('#antalutan'));
await p.screenshot({ path: 'k1-utan.png', fullPage: true });

// Öppna senaste serien (2026-10-20 nr 1) – länken går direkt till skottläget
const forsta = db.serie.find((s) => s.skytt_id === 1 && s.datum === '2026-10-20' && s.nr === 1);
await p.click(`a[href="#/serie/${forsta.id}/skott"]`); await vanta(500);
kolla('skottläge direkt', await p.$eval('#satt button[data-satt=skott]', (e) => e.classList.contains('vald')));
kolla('info om inmatad total', (await p.textContent('#kompl')).includes('Kompletterar'), await p.textContent('#kompl'));
kolla('knappen heter Spara och nästa', (await p.textContent('#spara')).includes('nästa'));
const sk1 = skottFor(forsta.total);
for (let i = 0; i < 10; i++) await p.fill(`.skottrutnat input[data-i="${i}"]`, sk1[i]);
await vanta(100);
kolla('stämmer-markering', (await p.textContent('#summa')).includes('Stämmer med'), (await p.textContent('#summa')).replace(/\s+/g, ' '));
await p.screenshot({ path: 'k2-stammer.png', fullPage: true });
await p.click('#spara'); await vanta(700);
kolla('skott sparade, total borttagen', forsta.total === null && db.skott.filter((k) => k.serie_id === forsta.id).length === 10);
const andra = db.serie.find((s) => s.skytt_id === 1 && s.datum === '2026-10-20' && s.nr === 2);
kolla('vidare till nästa serie', (await p.evaluate(() => location.hash)) === `#/serie/${andra.id}/skott`, await p.evaluate(() => location.hash));
kolla('meddelande om nästa', (await p.textContent('p.msg.info')).includes('Nästa: 2026-10-20 serie 2'), await p.textContent('p.msg.info'));

// Avvikande skott → varning och fråga
for (let i = 0; i < 10; i++) await p.fill(`.skottrutnat input[data-i="${i}"]`, '9,0');
await vanta(100);
kolla('avvikelse visas', (await p.textContent('#summa')).includes('Stämmer inte'), (await p.textContent('#summa')).replace(/\s+/g, ' '));
await p.screenshot({ path: 'k3-avviker.png', fullPage: true });
await p.click('#spara'); await vanta(700);
kolla('fråga vid avvikelse', dialoger.some((d) => d.includes('Spara skotten ändå')), dialoger.join(' | '));

// Vanlig ändring av en total-serie: knappen Komplettera med skott
const aldre = db.serie.find((s) => s.skytt_id === 1 && s.datum === '2026-04-07' && s.nr === 1);
await p.goto(URL + `#/serie/${aldre.id}`); await vanta(500);
kolla('total-läge med knapp', !!(await p.$('#komplknapp')) && (await p.textContent('#spara')) === 'Spara ändringar');
await p.screenshot({ path: 'k4-knapp.png', fullPage: true });
await p.click('#komplknapp'); await vanta(200);
kolla('knappen byter till skott', await p.$eval('#satt button[data-satt=skott]', (e) => e.classList.contains('vald')) && (await p.textContent('#spara')).includes('nästa'));

// Serielistan efteråt
await p.goto(URL + '#/serier'); await vanta(500);
kolla('färre utan skott', (await p.textContent('#antalutan')).includes('(10 av 12)'), await p.textContent('#antalutan'));
await p.uncheck('#futan'); await vanta(200);
kolla('serier med skott markerade', (await p.$$('.seriechip.harskott')).length === 2);
await p.screenshot({ path: 'k5-lista.png', fullPage: true });
console.log('fel:', fel);
await b.close();
process.exit(fel ? 1 : 0);
