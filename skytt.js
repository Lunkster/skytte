// Skyttsida (F-28): egen utveckling, nyckeltal, säsongsmål, utmärkelser, senaste tillfällen och skottprofil.
import { api, esc, fmt, minns } from './lib.js?v=0.5.1';
import { diagram, perSkottnummer, tappadePoang, svitar, kopplaTips } from './statistik.js?v=0.5.1';
import { form, formPil, procent, kvallensLista, sasongFor, sasongNamn, aktuellSasong } from './statistikA.js?v=0.5.1';
import { beraknaUtmarkelser, marke, malNattFor, kopplaForklaring } from './utmarkelser.js?v=0.5.1';

export async function renderSkytt(app, g, skyttId) {
  const sk = g.skyttar.find((x) => x.id === skyttId);
  if (!sk) { app.innerHTML = '<div class="card"><p>Skytten finns inte.</p></div>'; return; }
  const [serier, dagar, mal] = await Promise.all([
    api('v_serie?select=id,datum,nr,skytt_id,gren_id,poang,stjarnor,inmatning,skott,ofullstandig&order=datum,nr'),
    api('v_dag?select=datum,skytt_id,gren_id,serier,snitt,basta,samsta,stjarnor,kommentar&order=datum'),
    api('mal?select=*'),
  ]);
  const grenarMedData = g.grenar.filter((gr) => serier.some((s) => s.skytt_id === sk.id && s.gren_id === gr.id));
  const grenVal = grenarMedData.length ? grenarMedData : g.grenar;
  let grenId = minns(`skytt-gren-${sk.id}`) ?? grenVal[0].id;
  if (!grenVal.some((x) => x.id === grenId)) grenId = grenVal[0].id;
  let visaAlla = false;
  let utmNu = [];
  kopplaForklaring(app, (b) => utmNu.find((u) => u.id === b.dataset.utm));

  app.innerHTML = `
    <div class="skytthuvud"><h1>${esc(sk.namn)}</h1><a href="#/statistik" class="muted liten">‹ Statistik</a></div>
    <div class="chips liten" id="fgren"></div>
    <div id="innehall"></div>
    <div class="tooltip" id="tip" hidden></div>`;

  function rita() {
    app.querySelector('#fgren').innerHTML = grenVal.length > 1 ? grenVal.map((x) => `<button type="button" data-id="${x.id}" class="${x.id === grenId ? 'vald' : ''}">${esc(x.namn)}</button>`).join('') : '';
    const gren = g.grenar.find((x) => x.id === grenId);
    const d = gren.decimaler ? 1 : 0;
    const allaGren = serier.filter((s) => s.gren_id === grenId);
    const dagarGren = dagar.filter((x) => x.gren_id === grenId);
    const egna = allaGren.filter((s) => s.skytt_id === sk.id);
    const dagE = dagarGren.filter((x) => x.skytt_id === sk.id);
    const el = app.querySelector('#innehall');
    if (!egna.length) { el.innerHTML = `<p class="muted">${esc(sk.namn)} har inga serier i ${esc(gren.namn)} än.</p>`; return; }

    const p = egna.map((s) => Number(s.poang));
    const snitt = p.reduce((a, v) => a + v, 0) / p.length;
    const bastaSerie = egna.reduce((a, s) => (Number(s.poang) > Number(a.poang) ? s : a));
    const bastaDag = dagE.reduce((a, x) => (Number(x.snitt) > Number(a.snitt) ? x : a));
    const medStj = egna.filter((s) => s.stjarnor !== null);
    const f = form(dagE, snitt);
    const sasong = aktuellSasong();
    const malRad = mal.find((m) => m.skytt_id === sk.id && m.gren_id === grenId && m.sasong === sasong);
    const iSasong = egna.filter((s) => sasongFor(s.datum) === sasong).map((s) => Number(s.poang));
    const sasSnitt = iSasong.length ? iSasong.reduce((a, v) => a + v, 0) / iSasong.length : null;

    // utmärkelser (med kvällens skytt och nådda säsongsmål)
    const kvallens = kvallensLista(allaGren, dagarGren).filter((x) => x.skytt_id === sk.id);
    const malNatt = malNattFor(egna, mal, sk.id, grenId, sasongFor);
    const utm = beraknaUtmarkelser(egna, gren, { guld: g.guld.filter((x) => x.gren_id === grenId), kvallens, malNatt });
    utmNu = utm;
    const tagna = utm.filter((u) => u.datum).sort((a, b) => (a.datum < b.datum ? 1 : -1));
    const kvar = utm.filter((u) => !u.datum);

    const r = { sk, egna, dagE };
    const gEn = { ...g, skyttar: [sk] };
    const skottSerier = egna.filter((s) => s.inmatning === 'skott');
    const senaste = [...dagE].reverse().slice(0, 6);

    el.innerHTML = `
      <section class="nyckeltal">
        <div class="tal-ruta"><small>Snitt per serie</small><b>${fmt(snitt, 2)}</b><span>${fmt(procent(snitt, gren), 1)} % av max</span></div>
        <div class="tal-ruta"><small>Form</small><b>${f ? fmt(f.varde, 2) : '–'}</b><span>${formPil(f)}</span></div>
        <div class="tal-ruta"><small>Bästa serie</small><b>${fmt(bastaSerie.poang, d)}</b><span>${esc(bastaSerie.datum)}</span></div>
        <div class="tal-ruta"><small>Bästa dag</small><b>${fmt(bastaDag.snitt, 2)}</b><span>${esc(bastaDag.datum)}</span></div>
        <div class="tal-ruta"><small>Serier</small><b>${egna.length}</b><span>${dagE.length} dagar</span></div>
        <div class="tal-ruta"><small>Stjärnor/serie</small><b>${medStj.length ? fmt(medStj.reduce((a, s) => a + s.stjarnor, 0) / medStj.length, 1) : '–'}</b><span>${kvallens.length ? `kvällens skytt ${kvallens.length} ggr` : '&nbsp;'}</span></div>
      </section>

      <section class="card">
        <h2>Säsongsmål ${esc(sasongNamn(sasong))}</h2>
        ${malRad ? (sasSnitt === null ? `<p class="muted">Mål ${fmt(malRad.snitt, d)} – inga serier den här säsongen än.</p>` : `
          <div class="matare${sasSnitt >= Number(malRad.snitt) ? ' klar' : ''}"><div class="fyllning" style="width:${Math.round(Math.max(0, Math.min(1, (sasSnitt - (Number(malRad.snitt) - 5)) / 5)) * 100)}%"></div></div>
          <p class="liten">${fmt(sasSnitt, 2)} av ${fmt(malRad.snitt, d)} · ${sasSnitt >= Number(malRad.snitt) ? '<b class="form upp">mål nått!</b>' : `${fmt(Number(malRad.snitt) - sasSnitt, 2)} kvar`} · ${iSasong.length} serier</p>`)
          : `<p class="muted">Inget mål satt. Sätt det under <a href="#/statistik">Statistik → Säsongsmål</a>.</p>`}
      </section>

      <section class="card" id="utmarkelser">
        <div class="rubrikrad"><h2>Utmärkelser</h2><span class="muted">${tagna.length} av ${utm.length}</span></div>
        <p class="hjalp">Tryck på en utmärkelse för att se vad den betyder. Brons, silver, guld och mästare – ju högre nivå, desto svårare.</p>
        <div class="marken">${tagna.map((u) => marke(u)).join('') || '<p class="muted">Inga än – snart!</p>'}</div>
        ${kvar.length ? `<button type="button" class="btn liten textknapp" id="visaKvar">${visaAlla ? 'Dölj' : 'Visa'} de som är kvar (${kvar.length})</button>
          <div class="marken kvar" ${visaAlla ? '' : 'hidden'}>${kvar.sort((a, b) => (b.framsteg ? b.framsteg[0] / b.framsteg[1] : 0) - (a.framsteg ? a.framsteg[0] / a.framsteg[1] : 0)).map((u) => marke(u)).join('')}</div>` : ''}
      </section>

      <section class="card" id="utveckling">
        <h2>Utveckling</h2>
        <p class="legend"><span class="lg lg-a"></span>Dagsmedel <span class="lg lg-b"></span>Bästa serie</p>
        <div class="smadiagram en"><figure class="panel">${diagram(r, [r], 'snitt', gren)}</figure></div>
      </section>

      <section class="card">
        <h2>Senaste tillfällena</h2>
        ${senaste.map((x) => `<div class="skyttrad">
          <div class="skyttnamn"><b>${esc(x.datum)}</b><span class="muted">snitt ${fmt(x.snitt, 2)} · ★ ${x.stjarnor}</span></div>
          <div class="seriechips">${egna.filter((s) => s.datum === x.datum).map((s) => `<a href="#/serie/${s.id}" class="seriechip${s.inmatning === 'skott' ? ' harskott' : ''}"><small>${s.nr}</small>${fmt(s.poang, d)}<span class="stj">★${s.stjarnor ?? '–'}</span></a>`).join('')}</div>
          ${x.kommentar ? `<p class="kommentartext">${esc(x.kommentar)}</p>` : ''}
        </div>`).join('')}
        <p class="hjalp"><a href="#/serier">Alla serier</a></p>
      </section>

      ${skottSerier.length ? perSkottnummer(skottSerier, gEn, gren) + tappadePoang(skottSerier, gEn, gren) + svitar(skottSerier, gEn, gren) : ''}`;

    kopplaTips(el, app.querySelector('#tip'));
    el.querySelector('#visaKvar')?.addEventListener('click', () => { visaAlla = !visaAlla; rita(); document.getElementById('utmarkelser')?.scrollIntoView({ block: 'start' }); });
  }

  app.querySelector('#fgren').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; grenId = minns(`skytt-gren-${sk.id}`, Number(b.dataset.id)); rita();
  });
  rita();
}
