// Statistik per gren: topplista, guldnivåer, utveckling per skytt (små diagram) och skottfördelning.
import { api, esc, fmt, minns, idag } from './lib.js?v=0.2.1';

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

  const [serier, dagar] = await Promise.all([
    api('v_serie?select=id,datum,nr,skytt_id,gren_id,poang,stjarnor,inmatning,skott,ofullstandig&order=datum,nr'),
    api('v_dag?select=datum,skytt_id,gren_id,serier,snitt,basta,stjarnor&order=datum'),
  ]);

  app.innerHTML = `
    <h1>Statistik</h1>
    <div class="filter">
      <div class="chips liten" id="fgren"></div>
      <div class="chips liten" id="fperiod"></div>
    </div>
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

    el.innerHTML = `
      <section class="card">
        <h2>Topplista</h2>
        <div class="tabellwrap"><table class="tabell">
          <thead><tr><th>Skytt</th><th class="tal">Snitt</th><th class="tal">Bästa serie</th><th class="tal">Bästa dag</th><th class="tal">Senaste dag</th><th class="tal">★/serie</th><th class="tal">Serier</th></tr></thead>
          <tbody>${rader.map((r) => `<tr>
            <td><b>${esc(r.sk.namn)}</b></td>
            <td class="tal"><b>${fmt(r.snitt, 2)}</b></td>
            <td class="tal">${fmt(r.bastaSerie.poang, d)}<small class="datum">${esc(r.bastaSerie.datum)}</small></td>
            <td class="tal">${fmt(r.bastaDag?.snitt, 2)}<small class="datum">${esc(r.bastaDag?.datum ?? '')}</small></td>
            <td class="tal">${fmt(r.sist?.snitt, 2)}<small class="datum">${esc(r.sist?.datum ?? '')}</small></td>
            <td class="tal">${fmt(r.stj, 1)}</td>
            <td class="tal">${r.antal}<small class="datum">${r.tillfallen} dagar</small></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="hjalp">Bästa dag = högsta dagsmedel. Sorterat på snitt per serie.</p>
      </section>

      ${guld.length ? `<section class="card">
        <h2>Guldserier</h2>
        <div class="tabellwrap"><table class="tabell">
          <thead><tr><th>Skytt</th>${guld.map((n) => `<th class="tal">${esc(n.namn)}<small class="datum">från ${fmt(n.grans, 0)}</small></th>`).join('')}</tr></thead>
          <tbody>${[...rader].sort((a, b) => { for (let i = b.guld.length - 1; i >= 0; i--) if (b.guld[i] !== a.guld[i]) return b.guld[i] - a.guld[i]; return 0; }).map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td>
            ${r.guld.map((v) => `<td class="tal${v ? '' : ' muted'}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="hjalp">Antal serier på minst gränsen.</p>
      </section>` : `<section class="card"><h2>Guldserier</h2><p class="muted">Inga guldnivåer för ${esc(gren.namn)} än.</p></section>`}

      <section class="card">
        <div class="rubrikrad"><h2>Utveckling</h2>
          <div class="seg liten" id="matt">
            <button type="button" data-m="snitt" class="${matt === 'snitt' ? 'vald' : ''}">Poäng</button>
            <button type="button" data-m="stj" class="${matt === 'stj' ? 'vald' : ''}">Stjärnor</button>
          </div></div>
        <p class="legend">${matt === 'snitt'
          ? '<span class="lg lg-a"></span>Dagsmedel <span class="lg lg-b"></span>Bästa serie'
          : '<span class="lg lg-a"></span>Stjärnor per serie (dagsmedel)'}</p>
        <div class="smadiagram">${rader.map((r) => `<figure class="panel" data-skytt="${r.sk.id}">
          <figcaption><b>${esc(r.sk.namn)}</b></figcaption>${diagram(r, rader, matt, gren)}</figure>`).join('')}</div>
      </section>

      ${skottSerier.length ? skottfordelning(skottSerier, g, gren) : ''}`;

    // hover/tryck på punkter
    const tip = app.querySelector('#tip');
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
function diagram(r, alla, matt, gren) {
  const W = 320, H = 150, m = { l: 34, r: 8, t: 10, b: 22 };
  const punkter = r.dagE.map((x) => {
    const ss = r.egna.filter((s) => s.datum === x.datum && s.stjarnor !== null);
    return {
      datum: x.datum, t: Date.parse(x.datum),
      a: matt === 'snitt' ? Number(x.snitt) : (ss.length ? ss.reduce((a, s) => a + s.stjarnor, 0) / ss.length : null),
      b: matt === 'snitt' ? Number(x.basta) : null,
      serier: x.serier,
    };
  }).filter((p) => p.a !== null);
  // gemensam skala
  const allaP = alla.flatMap((x) => x.dagE.map((d) => {
    if (matt === 'snitt') return [Number(d.snitt), Number(d.basta)];
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
  if (matt === 'snitt') s += `<path d="${linje('b')}" class="linje-b"/>`;
  s += `<path d="${linje('a')}" class="linje-a"/>`;
  s += punkter.map((p) => `<circle cx="${X(p.t)}" cy="${Y(p.a)}" r="4" class="punkt"/>`).join('');
  // större träffytor för hover/tryck
  s += punkter.map((p) => {
    const tip = matt === 'snitt'
      ? `<b>${esc(p.datum)}</b><br>Dagsmedel ${fmt(p.a, 2)}<br>Bästa serie ${fmt(p.b, d)}<br>${p.serier} serier`
      : `<b>${esc(p.datum)}</b><br>${fmt(p.a, 1)} stjärnor per serie`;
    return `<circle cx="${X(p.t)}" cy="${Y(p.a)}" r="14" class="traff" data-tip="${esc(tip)}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r.sk.namn)}: ${matt === 'snitt' ? 'dagsmedel' : 'stjärnor'} över tid">${s}</svg>`;
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
  return `<section class="card">
    <h2>Skottfördelning</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th><th class="tal">Skott</th><th class="tal">Snitt/skott</th>${korgar.map(([k]) => `<th class="tal">${k}</th>`).join('')}</tr></thead>
      <tbody>${rader.map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td><td class="tal">${r.n}</td><td class="tal">${fmt(r.snitt, 2)}</td>
        ${r.korg.map((v) => `<td class="tal">${v ? `${v}<small class="datum">${Math.round((100 * v) / r.n)} %</small>` : '<span class="muted">0</span>'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="hjalp">Bara serier som matats in skott för skott (${ss.length} st).</p>
  </section>`;
}
