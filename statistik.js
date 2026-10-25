// Statistik per gren: topplista, guldnivåer, utveckling per skytt (små diagram) och skottfördelning.
import { api, write, esc, fmt, minns, idag } from './lib.js?v=0.5.0';
import { beraknaUtmarkelser, marke, malNattFor } from './utmarkelser.js?v=0.5.0';
import { kvallensLista, form, formPil, procent, kvallensSkytt, rekordtidslinje, jamnhetOchSerienummer, traningsmangd, sasongsmal, grenarJamforda, sasongFor, sasongNamn, aktuellSasong } from './statistikA.js?v=0.5.0';

const PERIODER = [
  { id: 'allt', namn: 'Allt' },
  { id: 'ar', namn: 'I år' },
  { id: '90', namn: '90 dagar' },
];

export async function renderStatistik(app, g) {
  const grenar = g.grenar;
  let grenId = minns('stat-gren') ?? minns('gren') ?? grenar[0].id;
  if (!grenar.some((x) => x.id === grenId)) grenId = grenar[0].id;
  let period = minns('stat-period') ?? 'allt';
  let matt = minns('stat-matt') ?? 'snitt';

  const [serier, dagar, malData] = await Promise.all([
    api('v_serie?select=id,datum,nr,skytt_id,gren_id,poang,stjarnor,inmatning,skott,ofullstandig&order=datum,nr'),
    api('v_dag?select=datum,skytt_id,gren_id,serier,snitt,basta,samsta,stjarnor&order=datum'),
    api('mal?select=*'),
  ]);
  let mal = malData;
  let sasong = minns('stat-sasong') ?? aktuellSasong();

  app.innerHTML = `
    <h1>Statistik</h1>
    <div class="filter">
      <div class="chips liten" id="fgren"></div>
      <div class="chips liten" id="fperiod"></div>
    </div>
    <nav class="hopp" id="hopp" aria-label="Hoppa till"></nav>
    <div id="innehall"></div>
    <div class="tooltip" id="tip" hidden></div>`;

  function franDatum() {
    if (period === 'ar') return `${idag().slice(0, 4)}-01-01`;
    if (period === '90') { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); }
    return '0000';
  }

  function rita() {
    app.querySelector('#fgren').innerHTML = grenar.map((x) => `<button type="button" data-id="${x.id}" class="${x.id === grenId ? 'vald' : ''}">${esc(x.namn)}</button>`).join('');
    app.querySelector('#fperiod').innerHTML = PERIODER.map((x) => `<button type="button" data-id="${x.id}" class="${x.id === period ? 'vald' : ''}">${esc(x.namn)}</button>`).join('');
    const gren = grenar.find((x) => x.id === grenId);
    const fran = franDatum();
    const ss = serier.filter((s) => s.gren_id === grenId && s.datum >= fran);
    const dd = dagar.filter((d) => d.gren_id === grenId && d.datum >= fran);
    const guld = g.guld.filter((x) => x.gren_id === grenId);
    const d = gren.decimaler ? 1 : 0;
    const el = app.querySelector('#innehall');
    if (!ss.length) { el.innerHTML = `<p class="muted">Inga serier i ${esc(gren.namn)} för perioden.</p>`; return; }

    const rader = g.skyttar.map((sk) => {
      const egna = ss.filter((s) => s.skytt_id === sk.id), dagE = dd.filter((x) => x.skytt_id === sk.id);
      if (!egna.length) return null;
      const p = egna.map((s) => Number(s.poang));
      const sist = dagE[dagE.length - 1];
      const bastaDag = dagE.reduce((a, x) => (!a || Number(x.snitt) > Number(a.snitt) ? x : a), null);
      const bastaSerie = egna.reduce((a, s) => (!a || Number(s.poang) > Number(a.poang) ? s : a), null);
      return {
        sk, egna, dagE, antal: egna.length, tillfallen: dagE.length,
        snitt: p.reduce((a, v) => a + v, 0) / p.length,
        bastaSerie, bastaDag, sist,
        stj: egna.filter((s) => s.stjarnor !== null).reduce((a, s) => a + s.stjarnor, 0) / Math.max(1, egna.filter((s) => s.stjarnor !== null).length),
        guld: guld.map((n) => egna.filter((s) => Number(s.poang) >= Number(n.grans)).length),
      };
    }).filter(Boolean).sort((a, b) => b.snitt - a.snitt);

    const skottSerier = ss.filter((s) => s.inmatning === 'skott');
    const allaGren = serier.filter((s) => s.gren_id === grenId);
    const dagarGren = dagar.filter((x) => x.gren_id === grenId);
    rader.forEach((r) => { r.form = form(r.dagE, r.snitt); });
    const sasonger = [...new Set([aktuellSasong(), ...allaGren.map((x) => sasongFor(x.datum))])].sort((a, b) => b - a);
    if (!sasonger.includes(sasong)) sasong = sasonger[0];

    el.innerHTML = `
      <section class="card">
        <h2>Topplista</h2>
        <div class="tabellwrap"><table class="tabell">
          <thead><tr><th>Skytt</th><th class="tal">Snitt</th><th class="tal">Form</th><th class="tal">Bästa serie</th><th class="tal">Bästa dag</th><th class="tal">Senaste dag</th><th class="tal">★/serie</th><th class="tal">% av max</th><th class="tal">Serier</th></tr></thead>
          <tbody>${rader.map((r) => `<tr>
            <td><b><a href="#/skytt/${r.sk.id}" class="skyttlank">${esc(r.sk.namn)}</a></b></td>
            <td class="tal"><b>${fmt(r.snitt, 2)}</b></td>
            <td class="tal">${formPil(r.form)}</td>
            <td class="tal">${fmt(r.bastaSerie.poang, d)}<small class="datum">${esc(r.bastaSerie.datum)}</small></td>
            <td class="tal">${fmt(r.bastaDag?.snitt, 2)}<small class="datum">${esc(r.bastaDag?.datum ?? '')}</small></td>
            <td class="tal">${fmt(r.sist?.snitt, 2)}<small class="datum">${esc(r.sist?.datum ?? '')}</small></td>
            <td class="tal">${fmt(r.stj, 1)}</td>
            <td class="tal">${fmt(procent(r.snitt, gren), 1)} %</td>
            <td class="tal">${r.antal}<small class="datum">${r.tillfallen} dagar</small></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="hjalp">Bästa dag = högsta dagsmedel. Form = snitt av de senaste tre dagarna mot eget snitt. Sorterat på snitt per serie.</p>
      </section>

      ${kvallensSkytt(allaGren, dagarGren, g, fran)}

      ${sasonger.length > 1 ? `<div class="chips liten sasongval" id="fsasong">${sasonger.map((y) => `<button type="button" data-y="${y}" class="${y === sasong ? 'vald' : ''}">${esc(sasongNamn(y))}</button>`).join('')}</div>` : ''}
      ${sasongsmal(allaGren, mal, g, gren, sasong)}
      ${utmarkelserOversikt(allaGren, dagarGren, mal, g, gren)}

      ${guld.length ? `<section class="card">
        <h2>Guldserier</h2>
        <div class="tabellwrap"><table class="tabell">
          <thead><tr><th>Skytt</th>${guld.map((n) => `<th class="tal">${esc(n.namn)}<small class="datum">från ${fmt(n.grans, 0)}</small></th>`).join('')}</tr></thead>
          <tbody>${[...rader].sort((a, b) => { for (let i = b.guld.length - 1; i >= 0; i--) if (b.guld[i] !== a.guld[i]) return b.guld[i] - a.guld[i]; return 0; }).map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td>
            ${r.guld.map((v) => `<td class="tal${v ? '' : ' muted'}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="hjalp">Antal serier på minst gränsen.</p>
      </section>` : `<section class="card"><h2>Guldserier</h2><p class="muted">Inga guldnivåer för ${esc(gren.namn)} än.</p></section>`}

      <section class="card" id="utveckling">
        <div class="rubrikrad"><h2>Utveckling</h2>
          <div class="seg liten" id="matt">
            <button type="button" data-m="snitt" class="${matt === 'snitt' ? 'vald' : ''}">Poäng</button>
            <button type="button" data-m="form" class="${matt === 'form' ? 'vald' : ''}">Form</button>
            <button type="button" data-m="stj" class="${matt === 'stj' ? 'vald' : ''}">Stjärnor</button>
          </div></div>
        <p class="legend">${matt === 'snitt'
          ? '<span class="lg lg-a"></span>Dagsmedel <span class="lg lg-b"></span>Bästa serie'
          : matt === 'form' ? '<span class="lg lg-a"></span>Form (snitt senaste 3 dagarna) <span class="lg lg-b"></span>Dagsmedel'
            : '<span class="lg lg-a"></span>Stjärnor per serie (dagsmedel)'}</p>
        <div class="smadiagram">${rader.map((r) => `<figure class="panel" data-skytt="${r.sk.id}">
          <figcaption><b>${esc(r.sk.namn)}</b></figcaption>${diagram(r, rader, matt, gren)}</figure>`).join('')}</div>
      </section>

      ${rekordtidslinje(allaGren, dagarGren, g, gren)}
      ${jamnhetOchSerienummer(ss, dd, g, gren)}
      ${traningsmangd(ss, g)}
      ${grenarJamforda(serier, g)}
      ${skottSerier.length ? skottfordelning(skottSerier, g, gren) : ''}
      ${skottSerier.length ? perSkottnummer(skottSerier, g, gren) : ''}
      ${skottSerier.length ? tappadePoang(skottSerier, g, gren) : ''}
      ${skottSerier.length ? svitar(skottSerier, g, gren) : ''}`;

    // Hoppa till-rad
    el.querySelectorAll('section.card > h2:first-child, section.card .rubrikrad h2').forEach((h, i) => {
      const sek = h.closest('section'); if (!sek.id) sek.id = `sek${i}`;
    });
    app.querySelector('#hopp').innerHTML = [...el.querySelectorAll('section.card')].map((sek) => {
      const h = sek.querySelector('h2'); return h ? `<a href="#" data-mal="${sek.id}">${esc(h.textContent.replace(/ \d{4}\/\d{2}$/, ''))}</a>` : '';
    }).join('');
    app.querySelector('#hopp').onclick = (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); document.getElementById(a.dataset.mal)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

    // säsongsmål
    el.querySelector('#fsasong')?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sasong = minns('stat-sasong', Number(b.dataset.y)); rita(); document.getElementById('mal')?.scrollIntoView({ block: 'start' }); });
    el.querySelectorAll('[data-andra]').forEach((b) => b.addEventListener('click', () => {
      const f = el.querySelector(`.malform[data-skytt="${b.dataset.andra}"]`); f.hidden = !f.hidden; if (!f.hidden) f.querySelector('input').focus();
    }));
    const sparaMal = async (skyttId, varde) => {
      const filter = `skytt_id=eq.${skyttId}&gren_id=eq.${grenId}&sasong=eq.${sasong}`;
      if (varde === null) await write('DELETE', `mal?${filter}`, undefined, 'return=minimal');
      else await write('POST', 'mal', { skytt_id: skyttId, gren_id: grenId, sasong, snitt: varde }, 'resolution=merge-duplicates,return=minimal');
      mal = await api('mal?select=*'); rita(); document.getElementById('mal')?.scrollIntoView({ block: 'start' });
    };
    el.querySelectorAll('.malform').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = f.querySelector('input').value.trim().replace(',', '.');
      const v = Number(t);
      const max = gren.antal_skott * (gren.decimaler ? 10.9 : Number(gren.fulltraff ?? 10));
      if (!t || !Number.isFinite(v) || v <= 0 || v > max) { f.querySelector('input').classList.add('ogiltig'); return; }
      try { await sparaMal(Number(f.dataset.skytt), Math.round(v * 10) / 10); } catch (err) { alert(err.message); }
    }));
    el.querySelectorAll('[data-tabort]').forEach((b) => b.addEventListener('click', async () => {
      try { await sparaMal(Number(b.dataset.tabort), null); } catch (err) { alert(err.message); }
    }));

    // hover/tryck på punkter
    kopplaTips(el, app.querySelector('#tip'));
    el.querySelector('#matt')?.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; matt = minns('stat-matt', b.dataset.m); rita();
    });
  }

  app.querySelector('#fgren').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; grenId = minns('stat-gren', Number(b.dataset.id)); rita();
  });
  app.querySelector('#fperiod').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; period = minns('stat-period', b.dataset.id); rita();
  });
  rita();
}

// Ett litet linjediagram per skytt. Samma y-skala för alla paneler så att de går att jämföra.
export function diagram(r, alla, matt, gren) {
  const W = 320, H = 150, m = { l: 34, r: 8, t: 10, b: 22 };
  const glid = (dagE, i) => { const f = dagE.slice(Math.max(0, i - 2), i + 1).map((x) => Number(x.snitt)); return f.reduce((a, v) => a + v, 0) / f.length; };
  const punkter = r.dagE.map((x, i) => {
    const ss = r.egna.filter((s) => s.datum === x.datum && s.stjarnor !== null);
    return {
      datum: x.datum, t: Date.parse(x.datum),
      a: matt === 'snitt' ? Number(x.snitt) : matt === 'form' ? glid(r.dagE, i) : (ss.length ? ss.reduce((a, s) => a + s.stjarnor, 0) / ss.length : null),
      b: matt === 'snitt' ? Number(x.basta) : matt === 'form' ? Number(x.snitt) : null,
      serier: x.serier,
    };
  }).filter((p) => p.a !== null);
  // gemensam skala
  const allaP = alla.flatMap((x) => x.dagE.map((d) => {
    if (matt === 'snitt') return [Number(d.snitt), Number(d.basta)];
    if (matt === 'form') return [Number(d.snitt)];
    const ss = x.egna.filter((s) => s.datum === d.datum && s.stjarnor !== null);
    return ss.length ? [ss.reduce((a, s) => a + s.stjarnor, 0) / ss.length] : [];
  })).flat();
  const tider = alla.flatMap((x) => x.dagE.map((d) => Date.parse(d.datum)));
  let y0 = Math.min(...allaP), y1 = Math.max(...allaP);
  const steg = niceStep((y1 - y0) / 4 || 1);
  y0 = Math.floor(y0 / steg) * steg; y1 = Math.ceil(y1 / steg) * steg; if (y1 === y0) y1 = y0 + steg;
  if (matt === 'stj') y0 = Math.max(0, y0);
  const t0 = Math.min(...tider), t1 = Math.max(...tider);
  const X = (t) => m.l + (t1 === t0 ? (W - m.l - m.r) / 2 : ((t - t0) / (t1 - t0)) * (W - m.l - m.r));
  const Y = (v) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const d = gren.decimaler ? 1 : 0;
  let s = '';
  for (let v = y0; v <= y1 + 1e-9; v += steg) {
    s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${m.l - 6}" y="${Y(v) + 4}" class="axel" text-anchor="end">${fmt(v, steg < 1 ? 1 : 0)}</text>`;
  }
  const manad = (t) => new Date(t).toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' });
  s += `<text x="${m.l}" y="${H - 6}" class="axel">${manad(t0)}</text>`;
  if (t1 !== t0) s += `<text x="${W - m.r}" y="${H - 6}" class="axel" text-anchor="end">${manad(t1)}</text>`;
  const linje = (k) => punkter.filter((p) => p[k] !== null).map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p[k]).toFixed(1)}`).join('');
  if (matt === 'snitt' || matt === 'form') s += `<path d="${linje('b')}" class="linje-b"/>`;
  s += `<path d="${linje('a')}" class="linje-a"/>`;
  s += punkter.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p.a)}" r="4" class="punkt"/>`).join('');
  // större träffytor för hover/tryck
  s += punkter.map((p) => {
    const tip = matt === 'snitt'
      ? `<b>${esc(p.datum)}</b><br>Dagsmedel ${fmt(p.a, 2)}<br>Bästa serie ${fmt(p.b, d)}<br>${p.serier} serier`
      : matt === 'form' ? `<b>${esc(p.datum)}</b><br>Form ${fmt(p.a, 2)}<br>Dagsmedel ${fmt(p.b, 2)}`
        : `<b>${esc(p.datum)}</b><br>${fmt(p.a, 1)} stjärnor per serie`;
    return `<circle cx="${X(p.t)}" cy="${Y(p.a)}" r="14" class="traff" data-tip="${esc(tip)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r.sk.namn)}: ${matt === 'snitt' ? 'dagsmedel' : matt === 'form' ? 'form' : 'stjärnor'} över tid">${s}</svg>`;
}

function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)); const n = raw / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }

// Fördelning av skottvärden (bara serier inmatade skott för skott)
function skottfordelning(ss, g, gren) {
  const korgar = gren.decimaler
    ? [['10', (v) => v >= 10], ['9', (v) => v >= 9 && v < 10], ['8', (v) => v >= 8 && v < 9], ['7', (v) => v >= 7 && v < 8], ['≤6', (v) => v < 7]]
    : [['X', (v) => v === Number(gren.fulltraff)], ['10', (v) => v === 10], ['9', (v) => v === 9], ['8', (v) => v === 8], ['7', (v) => v === 7], ['≤6', (v) => v < 7]];
  const rader = g.skyttar.map((sk) => {
    const vals = ss.filter((s) => s.skytt_id === sk.id).flatMap((s) => s.skott.map(Number));
    if (!vals.length) return null;
    return { sk, n: vals.length, snitt: vals.reduce((a, v) => a + v, 0) / vals.length, korg: korgar.map(([, f]) => vals.filter(f).length) };
  }).filter(Boolean);
  return `<section class="card" id="skottford">
    <h2>Skottfördelning</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th><th class="tal">Skott</th><th class="tal">Snitt/skott</th>${korgar.map(([k]) => `<th class="tal">${k}</th>`).join('')}</tr></thead>
      <tbody>${rader.map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td><td class="tal">${r.n}</td><td class="tal">${fmt(r.snitt, 2)}</td>
        ${r.korg.map((v) => `<td class="tal">${v ? `${v}<small class="datum">${Math.round((100 * v) / r.n)} %</small>` : '<span class="muted">0</span>'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="hjalp">Bara serier som matats in skott för skott (${ss.length} st).</p>
  </section>`;
}

// ---------- paket B: kräver skott (F-40–F-42) ----------
const tia = (v, gren) => v >= 10;                                   // 10-ringen (10,0–10,9 resp. 10 och fullträff)
const fullaSerier = (ss, gren) => ss.filter((s) => s.skott.length === gren.antal_skott);

// F-40: snitt per skottnummer, ett litet diagram per skytt med samma skala
export function perSkottnummer(ss, g, gren) {
  const n = gren.antal_skott, d = gren.decimaler ? 2 : 1;
  const rader = g.skyttar.map((sk) => {
    const egna = fullaSerier(ss.filter((s) => s.skytt_id === sk.id), gren);
    if (egna.length < 2) return null;
    const snitt = Array.from({ length: n }, (_, i) => egna.reduce((a, s) => a + Number(s.skott[i]), 0) / egna.length);
    const tot = snitt.reduce((a, v) => a + v, 0) / n;
    return { sk, serier: egna.length, snitt, tot };
  }).filter(Boolean);
  if (!rader.length) return '';
  const alla = rader.flatMap((r) => r.snitt);
  let y0 = Math.floor(Math.min(...alla) * 5) / 5, y1 = Math.ceil(Math.max(...alla) * 5) / 5;
  if (y1 - y0 < 0.4) { y0 -= 0.2; y1 += 0.2; }
  const W = 320, H = 140, m = { l: 34, r: 8, t: 10, b: 22 };
  const X = (i) => m.l + (i / (n - 1)) * (W - m.l - m.r);
  const Y = (v) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const steg = (y1 - y0) / 4;
  const panel = (r) => {
    let svg = '';
    for (let k = 0; k <= 4; k++) { const v = y0 + k * steg; svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${m.l - 6}" y="${Y(v) + 4}" class="axel" text-anchor="end">${fmt(v, 1)}</text>`; }
    for (let i = 0; i < n; i++) svg += `<text x="${X(i)}" y="${H - 6}" class="axel" text-anchor="middle">${i + 1}</text>`;
    svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(r.tot)}" y2="${Y(r.tot)}" class="linje-b"/>`;
    svg += `<path d="${r.snitt.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('')}" class="linje-a"/>`;
    svg += r.snitt.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="4" class="punkt"/>`).join('');
    svg += r.snitt.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="14" class="traff" data-tip="${esc(`<b>Skott ${i + 1}</b><br>Snitt ${fmt(v, d)}<br>${r.serier} serier`)}"/>`).join('');
    const min = r.snitt.indexOf(Math.min(...r.snitt)), max = r.snitt.indexOf(Math.max(...r.snitt));
    return `<figure class="panel"><figcaption><b>${esc(r.sk.namn)}</b> <span class="muted liten">svagast skott ${min + 1} (${fmt(r.snitt[min], d)}) · starkast skott ${max + 1} (${fmt(r.snitt[max], d)})</span></figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r.sk.namn)}: snitt per skottnummer">${svg}</svg></figure>`;
  };
  return `<section class="card">
    <h2>Snitt per skottnummer</h2>
    <p class="legend"><span class="lg lg-a"></span>Snitt för skottet <span class="lg lg-b"></span>Eget snitt per skott</p>
    <div class="smadiagram">${rader.map(panel).join('')}</div>
    <p class="hjalp">Var i serien går det bäst och sämst? Bara hela serier inmatade skott för skott.</p>
  </section>`;
}

// F-41: tappade poäng – vad skott under 10 kostar jämfört med en 10,0, i snitt per serie
export function tappadePoang(ss, g, gren) {
  const korgar = [['9', (v) => v >= 9 && v < 10], ['8', (v) => v >= 8 && v < 9], ['≤7', (v) => v < 8]];
  const rader = g.skyttar.map((sk) => {
    const egna = fullaSerier(ss.filter((s) => s.skytt_id === sk.id), gren);
    if (!egna.length) return null;
    const vals = egna.flatMap((s) => s.skott.map(Number));
    const tapp = (f) => vals.filter((v) => v < 10 && f(v)).reduce((a, v) => a + (10 - v), 0) / egna.length;
    const per = korgar.map(([, f]) => tapp(f));
    return { sk, serier: egna.length, tot: per.reduce((a, v) => a + v, 0), per, under: vals.filter((v) => v < 10).length / egna.length };
  }).filter(Boolean).sort((a, b) => a.tot - b.tot);
  if (!rader.length) return '';
  return `<section class="card">
    <h2>Tappade poäng</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th><th class="tal">Tappat/serie</th>${korgar.map(([k]) => `<th class="tal">på ${k}:or</th>`).join('')}<th class="tal">Skott under 10/serie</th></tr></thead>
      <tbody>${rader.map((r) => {
        const storst = r.per.indexOf(Math.max(...r.per));
        return `<tr><td><b>${esc(r.sk.namn)}</b></td><td class="tal"><b>${fmt(r.tot, 1)}</b></td>
        ${r.per.map((v, i) => `<td class="tal${i === storst && v > 0 ? ' framhav' : ''}">${v ? fmt(v, 1) : '<span class="muted">0</span>'}</td>`).join('')}
        <td class="tal">${fmt(r.under, 1)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="hjalp">Poäng som skott under 10 kostar jämfört med en 10,0, i snitt per serie. Markerad siffra = där mest poäng försvinner.</p>
  </section>`;
}

// F-42: längsta tiosvit och flest stjärnor i rad – skott i följd under samma dag, över serierna
export function svitar(ss, g, gren) {
  const langst = (egna, f) => {
    let basta = { n: 0, datum: null }, nu = 0, dag = null;
    for (const s of egna) {
      if (s.datum !== dag) { dag = s.datum; nu = 0; }
      for (const v of s.skott.map(Number)) {
        nu = f(v) ? nu + 1 : 0;
        if (nu > basta.n) basta = { n: nu, datum: s.datum };
      }
    }
    return basta;
  };
  const rader = g.skyttar.map((sk) => {
    const egna = ss.filter((s) => s.skytt_id === sk.id).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.nr - b.nr));
    if (!egna.length) return null;
    const stjSerie = egna.reduce((a, s) => (!a || s.stjarnor > a.stjarnor ? s : a), null);
    return { sk, tia: langst(egna, (v) => tia(v, gren)), stj: langst(egna, (v) => v >= Number(gren.stjarna_fran) - 1e-9), stjSerie };
  }).filter(Boolean).sort((a, b) => b.tia.n - a.tia.n);
  if (!rader.length) return '';
  const cell = (x) => x.n ? `${x.n}<small class="datum">${esc(x.datum)}</small>` : '<span class="muted">0</span>';
  return `<section class="card">
    <h2>Svitar</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th><th class="tal">Tior i rad</th><th class="tal">Stjärnor i rad</th><th class="tal">Flest ★ i en serie</th></tr></thead>
      <tbody>${rader.map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td><td class="tal">${cell(r.tia)}</td><td class="tal">${cell(r.stj)}</td>
        <td class="tal">${r.stjSerie.stjarnor}<small class="datum">${esc(r.stjSerie.datum)} serie ${r.stjSerie.nr}</small></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="hjalp">Skott i följd samma dag, även över seriegränsen. Tia = ${gren.decimaler ? '10,0 och uppåt' : '10 eller fullträff'}, stjärna = ${fmt(gren.stjarna_fran, 1)} och uppåt.</p>
  </section>`;
}

// Tooltip för diagrammens punkter (används även av skyttsidan)
export function kopplaTips(el, tip) {
  el.querySelectorAll('.smadiagram svg').forEach((svg) => {
    const visa = (e) => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tip.hidden = true; return; }
      tip.innerHTML = t.dataset.tip; tip.hidden = false;
      const r = t.getBoundingClientRect();
      tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
      tip.style.top = `${r.top + window.scrollY - tip.offsetHeight - 8}px`;
    };
    svg.addEventListener('pointerover', visa); svg.addEventListener('pointerdown', visa);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  });
}

// Utmärkelser för hela familjen: antal och de senaste per skytt, länk till skyttsidan
function utmarkelserOversikt(allaGren, dagarGren, mal, g, gren) {
  const kv = kvallensLista(allaGren, dagarGren);
  const rader = g.skyttar.map((sk) => {
    const egna = allaGren.filter((s) => s.skytt_id === sk.id);
    if (!egna.length) return null;
    const u = beraknaUtmarkelser(egna, gren, { guld: g.guld.filter((x) => x.gren_id === gren.id), kvallens: kv.filter((x) => x.skytt_id === sk.id), malNatt: malNattFor(egna, mal, sk.id, gren.id, sasongFor) });
    const tagna = u.filter((x) => x.datum).sort((a, b) => (a.datum < b.datum ? 1 : -1));
    return { sk, tagna, totalt: u.length };
  }).filter(Boolean).sort((a, b) => b.tagna.length - a.tagna.length);
  return `<section class="card" id="utmarkelser">
    <h2>Utmärkelser</h2>
    ${rader.map((r) => `<div class="utmrad">
      <div class="malhuvud"><b><a href="#/skytt/${r.sk.id}" class="skyttlank">${esc(r.sk.namn)}</a></b><span class="muted liten">${r.tagna.length} av ${r.totalt}</span>
        <a href="#/skytt/${r.sk.id}" class="btn liten textknapp">Alla</a></div>
      <div class="marken kompakt">${r.tagna.slice(0, 3).map((u) => marke(u)).join('')}</div>
    </div>`).join('')}
    <p class="hjalp">De senaste tre per skytt. Tryck på namnet för skyttens sida med alla utmärkelser och vad som är kvar.</p>
  </section>`;
}
