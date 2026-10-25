// Hela flödet: inloggning, serietotal, skott för skott (10 m och 50 m), kommentar, krock, ändra, ta bort, serier, statistik.
// Kör: (cd .. && python3 -m http.server 8766 &) ; node flode.mjs
import { createRequire } from 'module';
import { skapaDb, koppla } from './attrapp.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const URL = process.env.APP ?? 'http://localhost:8766/';
const db = skapaDb(), log = [];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
let fel = 0;
p.on('pageerror', (e) => { fel++; console.log('SIDFEL', e.message); });
p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('supabase')) console.log('HTTP', r.status(), r.url()); });
p.on('dialog', (d) => d.accept());
await koppla(p, db, log);
const kolla = (namn, ok, extra = '') => { if (!ok) fel++; console.log(ok ? 'OK  ' : 'FEL ', namn, extra); };
const vanta = (ms = 300) => p.waitForTimeout(ms);

await p.goto(URL); await vanta();
await p.screenshot({ path: 'f1-login.png' });
await p.fill('#kod', 'fel'); await p.click('button[type=submit]'); await vanta();
kolla('fel kod', (await p.textContent('#loginmsg')).includes('Fel kod'));
await p.fill('#kod', 'kod123'); await p.click('button[type=submit]'); await vanta(600);
kolla('inmatningen visas', (await p.textContent('h1')) === 'Mata in');

// Serietotal
await p.click('#skytt button:has-text("Anna")'); await vanta();
kolla('serienummer 1 i dag', (await p.textContent('#nr')) === '1');
await p.click('#satt button[data-satt=total]'); await vanta(100);
await p.fill('#total', '101,5');
for (let i = 0; i < 3; i++) await p.click('[data-stj="1"]');
kolla('summa total', (await p.textContent('#summa')).includes('101,5') && (await p.textContent('#summa')).includes('GULD ☆'), await p.textContent('#summa'));
await p.screenshot({ path: 'f2-total.png', fullPage: true });
await p.click('#spara'); await vanta(500);
kolla('total sparad', db.serie.some((s) => s.skytt_id === 1 && s.total === 101.5 && s.stjarnor === 3), await p.textContent('#msg'));
kolla('nästa nr 2', (await p.textContent('#nr')) === '2');

// Skott för skott, 10 m
await p.click('#satt button[data-satt=skott]'); await vanta(100);
const skott = ['104', '9,8', '10.6', '98', '103', '100', '9.9', '107', '101', '96'];
for (const s of skott) await p.keyboard.type(s.length ? s : '');
// sista rutan behöver ingen auto-hoppning
await vanta(100);
const varden = await p.$$eval('.skottrutnat input', (e) => e.map((x) => x.value));
kolla('auto-hopp och tolkning', JSON.stringify(varden) === JSON.stringify(['10,4','9,8','10,6','9,8','10,3','10,0','9,9','10,7','10,1','96']), JSON.stringify(varden));
await p.screenshot({ path: 'f3-skott10.png', fullPage: true });
kolla('summa 10 m', (await p.textContent('#summa')).includes('101,2') && (await p.textContent('#summa')).includes('★ 4'), (await p.textContent('#summa')).replace(/\s+/g, ' '));
await p.click('#kommentarbox summary'); await p.fill('#kommentar', 'Tröga skott i början.');
await p.click('#spara'); await vanta(600);
const idag = await p.inputValue('#datum');
const s2 = db.serie.find((s) => s.skytt_id === 1 && s.nr === 2 && s.datum === idag);
kolla('skottserie sparad', s2 && s2.total === null && db.skott.filter((k) => k.serie_id === s2.id).length === 10);
kolla('kommentar sparad', db.kommentar.some((k) => k.skytt_id === 1 && k.text === 'Tröga skott i början.'));
await p.screenshot({ path: 'f4-sparad.png', fullPage: true });

// Krock: sätt nr 2 igen
await p.click('[data-nr="-1"]'); await vanta(100); await p.click('.skottrutnat input[data-i="0"]');
for (const s of ['100','100','100','100','100','100','100','100','100','100']) await p.keyboard.type(s);
await p.click('#spara'); await vanta(500);
kolla('krock ger tydligt fel', (await p.textContent('#msg')).includes('redan en serie 2'), await p.textContent('#msg'));

// 50 m med knappsats
await p.click('#gren button:has-text("Salongsgevär")'); await vanta(400);
kolla('50 m nr 1', (await p.textContent('#nr')) === '1');
for (const v of ['10', 'X', '9', '8', '7']) await p.click(`#knappsats button:text-is("${v}")`);
kolla('summa 50 m', (await p.textContent('#summa')).includes('44,1') && (await p.textContent('#summa')).includes('★ 1'), (await p.textContent('#summa')).replace(/\s+/g, ' '));
await p.screenshot({ path: 'f5-skott50.png', fullPage: true });
await p.click('#spara'); await vanta(500);
const s3 = db.serie.find((s) => s.gren_id === 2);
kolla('50 m sparad', s3 && db.skott.filter((k) => k.serie_id === s3.id).map((k) => k.varde).join() === '10,10.1,9,8,7');

// Serier och ändra
await p.goto(URL + '#/serier'); await vanta(500);
await p.screenshot({ path: 'f6-serier.png', fullPage: true });
await p.click(`a[href="#/serie/${s2.id}"]`); await vanta(500);
kolla('ändra-läge', (await p.textContent('h1')) === 'Ändra serie');
const v0 = await p.$$eval('.skottrutnat input', (e) => e.map((x) => x.value));
kolla('skott laddade', v0[0] === '10,4', JSON.stringify(v0));
await p.fill('.skottrutnat input[data-i="0"]', '95'); await vanta(100);
await p.screenshot({ path: 'f7-andra.png', fullPage: true });
await p.click('#spara'); await vanta(600);
kolla('ändring sparad', db.skott.find((k) => k.serie_id === s2.id && k.nr === 1)?.varde === 9.5 && (await p.evaluate(() => location.hash)) === '#/serier');
const s1 = db.serie.find((s) => s.skytt_id === 1 && s.nr === 1 && s.datum === idag && s.gren_id === 1);
await p.goto(URL + `#/serie/${s1.id}`); await vanta(500);
await p.click('#tabort'); await vanta(500);
kolla('borttagen', !db.serie.some((s) => s.id === s1.id));

// Statistik
await p.goto(URL + '#/statistik'); await vanta(600); await p.click('#fgren button:has-text("Luftgevär")'); await vanta(300);
await p.screenshot({ path: 'f8-statistik.png', fullPage: true });
const txt = await p.textContent('#innehall');
kolla('statistik har topplista och guld', txt.includes('Topplista') && txt.includes('GULD ☆☆') && txt.includes('Skottfördelning'));
await p.click('#matt button[data-m=stj]'); await vanta(200);
await p.hover('.panel .traff >> nth=0'); await vanta(200);
kolla('tooltip', !(await p.$eval('#tip', (e) => e.hidden)), await p.textContent('#tip'));
await p.screenshot({ path: 'f9-stjarnor.png', fullPage: true });
await p.click('#fgren button:has-text("Salongsgevär")'); await vanta(300);
await p.screenshot({ path: 'f10-stat50.png', fullPage: true });
kolla('50 m utan guldnivåer', (await p.textContent('#innehall')).includes('Inga guldnivåer'));
// Bred skärm
await p.setViewportSize({ width: 1100, height: 900 }); await p.click('#fgren button:has-text("Luftgevär")'); await vanta(300);
await p.screenshot({ path: 'f11-bred.png', fullPage: true });
const bredd = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
kolla('ingen sidled-skroll', bredd);
console.log('skrivningar:', log.length, '· fel:', fel);
await b.close();
process.exit(fel ? 1 : 0);
