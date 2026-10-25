// Alla serier per tillfälle (datum), nyast först. Tryck på en serie för att ändra den.
import { api, esc, fmt, minns } from './lib.js?v=0.2.1';

export async function renderSerier(app, g, meddelande = '') {
  let gren = minns('serier-gren') ?? 0;     // 0 = alla grenar
  let skytt = minns('serier-skytt') ?? 0;   // 0 = alla skyttar
  let utanSkott = minns('serier-utan') ?? false;
  const [serier, dagar] = await Promise.all([
    api('v_serie?select=id,datum,nr,skytt_id,skytt,gren_id,gren,poang,stjarnor,inmatning,ofullstandig&order=datum.desc,gren_id,skytt_id,nr'),
    api('v_dag?select=datum,skytt_id,gren_id,snitt,kommentar'),
  ]);
  const dagInfo = new Map(dagar.map((d) => [`${d.datum}|${d.skytt_id}|${d.gren_id}`, d]));

  app.innerHTML = `
    <h1>Serier</h1>
    ${meddelande ? `<p class="msg info">${esc(meddelande)}</p>` : ''}
    <div class="filter">
      <div class="chips liten" id="fgren"></div>
      <div class="chips liten" id="fskytt"></div>
      <label class="vaxel"><input type="checkbox" id="futan"${utanSkott ? ' checked' : ''}> Bara serier utan skott <span class="muted" id="antalutan"></span></label>
    </div>
    <div id="lista"></div>`;

  function rita() {
    app.querySelector('#fgren').innerHTML = [{ id: 0, namn: 'Alla grenar' }, ...g.grenar].map((x) =>
      `<button type="button" data-id="${x.id}" class="${x.id === gren ? 'vald' : ''}">${esc(x.namn)}</button>`).join('');
    app.querySelector('#fskytt').innerHTML = [{ id: 0, namn: 'Alla' }, ...g.skyttar].map((x) =>
      `<button type="button" data-id="${x.id}" class="${x.id === skytt ? 'vald' : ''}">${esc(x.namn)}</button>`).join('');
    const iFilter = serier.filter((s) => (!gren || s.gren_id === gren) && (!skytt || s.skytt_id === skytt));
    const utan = iFilter.filter((s) => s.inmatning === 'total').length;
    app.querySelector('#antalutan').textContent = `(${utan} av ${iFilter.length})`;
    const urval = utanSkott ? iFilter.filter((s) => s.inmatning === 'total') : iFilter;
    if (!urval.length) { app.querySelector('#lista').innerHTML = `<p class="muted">${utanSkott ? 'Alla serier har skott.' : 'Inga serier.'}</p>`; return; }
    // datum → gren → skytt
    const tillfallen = new Map();
    urval.forEach((s) => {
      const k = `${s.datum}|${s.gren_id}`;
      if (!tillfallen.has(k)) tillfallen.set(k, { datum: s.datum, gren: s.gren, gren_id: s.gren_id, skyttar: new Map() });
      const t = tillfallen.get(k);
      if (!t.skyttar.has(s.skytt_id)) t.skyttar.set(s.skytt_id, { namn: s.skytt, serier: [] });
      t.skyttar.get(s.skytt_id).serier.push(s);
    });
    app.querySelector('#lista').innerHTML = [...tillfallen.values()].map((t) => `
      <section class="card tillfalle">
        <div class="dagrubrik"><h3>${esc(t.datum)}</h3><span class="muted">${esc(t.gren)}</span></div>
        ${[...t.skyttar].map(([id, sk]) => {
          const d = dagInfo.get(`${t.datum}|${id}|${t.gren_id}`);
          return `<div class="skyttrad">
            <div class="skyttnamn"><b>${esc(sk.namn)}</b><span class="muted">snitt ${fmt(d?.snitt, 2)}</span></div>
            <div class="seriechips">${sk.serier.map((s) => `<a href="#/serie/${s.id}${s.inmatning === 'total' && utanSkott ? '/skott' : ''}" class="seriechip${s.ofullstandig ? ' ofull' : ''}${s.inmatning === 'skott' ? ' harskott' : ''}" title="Serie ${s.nr}${s.inmatning === 'skott' ? ' (skott för skott)' : ' (bara total)'}">
              <small>${s.nr}</small>${fmt(s.poang)}<span class="stj">★${s.stjarnor ?? '–'}</span></a>`).join('')}</div>
            ${d?.kommentar ? `<p class="kommentartext">${esc(d.kommentar)}</p>` : ''}
          </div>`;
        }).join('')}
      </section>`).join('');
  }

  app.querySelector('#fgren').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; gren = minns('serier-gren', Number(b.dataset.id)); rita();
  });
  app.querySelector('#fskytt').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; skytt = minns('serier-skytt', Number(b.dataset.id)); rita();
  });
  app.querySelector('#futan').addEventListener('change', (e) => { utanSkott = minns('serier-utan', e.target.checked); rita(); });
  rita();
}
