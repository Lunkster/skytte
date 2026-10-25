// Utmärkelser (F-43). Räknas fram ur serierna – lagras inte. Allt är per skytt och gren.
// Fyra nivåer så att det finns något att sträva mot länge: 1 brons, 2 silver, 3 guld, 4 mästare.
// Balanserade 2026-10-26: få lätta i början, fler svåra (önskemål Henrik).
import { esc, fmt, maxSkott } from './lib.js?v=0.5.1';

export const NIVAER = { 1: 'Brons', 2: 'Silver', 3: 'Guld', 4: 'Mästare' };
const ordning = (a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.nr - b.nr);

// egna: skyttens serier i grenen (v_serie-rader med poang, stjarnor, skott, datum, nr)
// extra: { guld: guldnivåer för grenen, kvallens: [{datum}], malNatt: [{sasong, datum}] }
export function beraknaUtmarkelser(egna, gren, extra = {}) {
  const ser = [...egna].sort(ordning);
  const guld = [...(extra.guld ?? [])].sort((a, b) => Number(a.grans) - Number(b.grans));
  const ut = [];
  const lagg = (id, grupp, niva, namn, beskr, forklaring, datum, framsteg = null) =>
    ut.push({ id, grupp, niva, namn, beskr, forklaring, datum: datum ?? null, framsteg });
  const poang = (s) => Number(s.poang);
  const n = gren.antal_skott;

  // ---------- Milstolpar: att skjuta mycket ----------
  const dagar = [...new Set(ser.map((s) => s.datum))].sort();
  for (const [k, niva] of [[25, 1], [50, 2], [100, 3], [250, 4]]) {
    lagg(`serier-${k}`, 'Milstolpar', niva, `${k} serier`, `Skjutit ${k} serier`,
      `Ges när du har skjutit ${k} serier i ${gren.namn}. Alla serier räknas, oavsett resultat – det är träningen som belönas.`,
      ser.length >= k ? ser[k - 1].datum : null, [Math.min(ser.length, k), k]);
  }
  for (const [k, niva] of [[25, 2], [50, 3]]) {
    lagg(`dagar-${k}`, 'Milstolpar', niva, `${k} skjutdagar`, `Skjutit ${k} olika dagar`,
      `Ges när du har skjutit på ${k} olika dagar. Visar att du kommer tillbaka och tränar regelbundet.`,
      dagar.length >= k ? dagar[k - 1] : null, [Math.min(dagar.length, k), k]);
  }

  // ---------- Resultat: guldnivåerna ----------
  if (guld.length) {
    // Första serien på nivå 2–4 (den lägsta guldnivån är för lätt för att vara en utmärkelse)
    guld.slice(1).forEach((g, i) => {
      const forsta = ser.find((s) => poang(s) >= Number(g.grans));
      lagg(`guld-${g.grans}`, 'Resultat', i + 1, `Första ${g.namn}`, `En serie på minst ${fmt(g.grans, 0)}`,
        `Ges första gången du skjuter en serie på minst ${fmt(g.grans, 0)} poäng – nivån ${g.namn}.`, forsta?.datum);
    });
    const topp = Number(guld[guld.length - 1].grans) + 2;
    const mast = ser.find((s) => poang(s) >= topp);
    lagg('mastarserie', 'Resultat', 4, 'Mästarserie', `En serie på minst ${fmt(topp, 0)}`,
      `Ges för en serie på minst ${fmt(topp, 0)} poäng – två poäng över den högsta guldnivån. En riktigt stor serie.`, mast?.datum);

    // Guldsviter: serier i följd (i skjutordning, även över flera dagar) på minst en viss nivå
    const svit = (grans, k) => {
      let i = 0, datum = null, basta = 0;
      for (const s of ser) { i = poang(s) >= grans ? i + 1 : 0; basta = Math.max(basta, i); if (i === k && !datum) datum = s.datum; }
      return { datum, basta };
    };
    const svitNivaer = [[guld[0], [[5, 1], [10, 2]]], [guld[1], [[5, 2], [10, 3], [20, 4]]]];
    for (const [g, steg] of svitNivaer) {
      if (!g) continue;
      for (const [k, niva] of steg) {
        const { datum, basta } = svit(Number(g.grans), k);
        lagg(`guldsvit-${g.grans}-${k}`, 'Resultat', niva, `${k} ${g.namn} i rad`, `${k} serier i följd på minst ${fmt(g.grans, 0)}`,
          `Ges när ${k} serier i följd (i den ordning de skjutits, även över flera dagar) alla är minst ${fmt(g.grans, 0)} poäng. En enda serie under bryter sviten.`,
          datum, [Math.min(basta, k), k]);
      }
    }
    const dagMed = (grans) => dagar.find((d) => { const p = ser.filter((s) => s.datum === d); return p.length >= 3 && p.every((s) => poang(s) >= grans); });
    if (guld[1]) {
      lagg('gulddag', 'Resultat', 2, 'Gulddag', `Alla serier en dag på ${guld[1].namn}`,
        `Ges för en dag med minst tre serier där alla är minst ${fmt(guld[1].grans, 0)} poäng (${guld[1].namn}). Jämnhet på hög nivå.`, dagMed(Number(guld[1].grans)));
    }
    if (guld[2]) {
      lagg('stjarndag', 'Resultat', 3, 'Toppdag', `Alla serier en dag på ${guld[2].namn}`,
        `Ges för en dag med minst tre serier där alla är minst ${fmt(guld[2].grans, 0)} poäng (${guld[2].namn}).`, dagMed(Number(guld[2].grans)));
    }
  }

  // ---------- Stjärnor ----------
  const stjSerie = (k) => ser.find((x) => (x.stjarnor ?? 0) >= k)?.datum;
  lagg(`stj-serie-${n - 2}`, 'Stjärnor', 2, `${n - 2} ★ i en serie`, `Minst ${n - 2} stjärnor i en serie`,
    `Ges för en serie med minst ${n - 2} stjärnor. En stjärna är ett skott på ${fmt(gren.stjarna_fran, 1)} eller mer${gren.decimaler ? ' (inre delen av tian)' : ' (fullträff)'}.`, stjSerie(n - 2));
  lagg('stjarnregn', 'Stjärnor', 4, 'Stjärnregn', `Alla ${n} skott stjärnor i en serie`,
    `Ges när alla ${n} skotten i en serie är stjärnor (${fmt(gren.stjarna_fran, 1)} eller mer). Mycket ovanligt!`, stjSerie(n));
  let summaStj = 0; const stjMal = [[250, 2], [500, 3], [1000, 4]]; const stjDatum = {};
  for (const s of ser) { summaStj += s.stjarnor ?? 0; for (const [m] of stjMal) if (summaStj >= m && !stjDatum[m]) stjDatum[m] = s.datum; }
  for (const [m, niva] of stjMal) {
    lagg(`stj-tot-${m}`, 'Stjärnor', niva, `${m} stjärnor`, `${m} stjärnor totalt`,
      `Ges när du samlat ${m} stjärnor sammanlagt i ${gren.namn}. Alla serier räknas.`, stjDatum[m], [Math.min(summaStj, m), m]);
  }

  // ---------- Skott (bara serier inmatade skott för skott) ----------
  const medSkott = ser.filter((s) => s.skott?.length);
  if (medSkott.length) {
    const max = maxSkott(gren);
    const prick = medSkott.find((s) => s.skott.some((v) => Number(v) >= max - 1e-9));
    lagg('mitt-i-prick', 'Skott', 2, 'Mitt i prick', gren.decimaler ? `Ett skott på ${fmt(max, 1)}` : 'En fullträff',
      gren.decimaler ? `Ges för ett skott på ${fmt(max, 1)} – det högsta som går, mitt i prick.` : 'Ges för en fullträff (inre tian).', prick?.datum);
    const hel = (fn) => medSkott.find((s) => s.skott.length === n && s.skott.every((v) => fn(Number(v))))?.datum;
    const golv = gren.decimaler ? 9.8 : 9;
    lagg('inga-misstag', 'Skott', 2, 'Inga misstag', `Inget skott under ${fmt(golv, gren.decimaler ? 1 : 0)} i en serie`,
      `Ges för en hel serie där inget skott är under ${fmt(golv, gren.decimaler ? 1 : 0)}. Det handlar om att undvika de dåliga skotten – jämnhet slår enstaka toppskott.`, hel((v) => v >= golv));
    lagg('perfekt-serie', 'Skott', 3, 'Perfekt serie', 'Alla skott i tian',
      `Ges för en serie där alla ${n} skotten är 10 eller mer.`, hel((v) => v >= 10));
    for (const [k, niva] of [[10, 2], [20, 3], [30, 4]]) {
      let i = 0, dag = null, datum = null, basta = 0;
      for (const s of medSkott) {
        if (s.datum !== dag) { dag = s.datum; i = 0; }
        for (const v of s.skott.map(Number)) { i = v >= 10 ? i + 1 : 0; basta = Math.max(basta, i); if (i >= k && !datum) datum = s.datum; }
      }
      lagg(`tiosvit-${k}`, 'Skott', niva, `${k} tior i rad`, `${k} skott i följd på 10 eller mer`,
        `Ges när ${k} skott i följd samma dag är 10 eller mer – sviten får fortsätta in i nästa serie.`, datum, [Math.min(basta, k), k]);
    }
  }

  // ---------- Rekord ----------
  let max = -Infinity, rekord = 0; const rekDatum = {};
  for (const s of ser) { if (poang(s) > max) { if (max > -Infinity) { rekord += 1; for (const m of [5, 10]) if (rekord >= m && !rekDatum[m]) rekDatum[m] = s.datum; } max = poang(s); } }
  lagg('rekord-5', 'Rekord', 2, 'Rekordjägare', 'Slagit personbästa fem gånger',
    'Ges när du har slagit ditt personbästa för en serie fem gånger. Den allra första serien räknas inte som rekord.', rekDatum[5], [Math.min(rekord, 5), 5]);
  lagg('rekord-10', 'Rekord', 3, 'Rekordmaskin', 'Slagit personbästa tio gånger',
    'Ges när du har slagit ditt personbästa för en serie tio gånger.', rekDatum[10], [Math.min(rekord, 10), 10]);

  // ---------- Familjen (kräver data om de andra) ----------
  if (extra.kvallens) {
    const k = [...extra.kvallens].sort((a, b) => (a.datum < b.datum ? -1 : 1));
    for (const [m, niva] of [[1, 1], [5, 2], [10, 3]]) {
      lagg(`kvallens-${m}`, 'Familjen', niva, m === 1 ? 'Kvällens skytt' : `Kvällens skytt ×${m}`, m === 1 ? 'Kvällens skytt en gång' : `Kvällens skytt ${m} gånger`,
        'Kvällens skytt är den som skjuter mest över sitt eget tidigare snitt en kväll när minst två i familjen skjuter. Alla kan vinna, oavsett nivå.',
        k[m - 1]?.datum, m > 1 ? [Math.min(k.length, m), m] : null);
    }
  }
  if (extra.malNatt) {
    lagg('mal-natt', 'Familjen', 2, 'Målet nått', 'Nått sitt säsongsmål',
      'Ges när ditt snitt under säsongen (efter minst fem serier) når målet du satt under Statistik → Säsongsmål.', extra.malNatt[0]?.datum);
  }
  return ut;
}

export const tagna = (lista) => lista.filter((u) => u.datum).sort((a, b) => (a.datum < b.datum ? 1 : -1));

// Nya utmärkelser som en ny serie gav (för grattis vid inmatning)
export function nyaMed(egna, gren, extra, nyttId) {
  const fore = new Set(tagna(beraknaUtmarkelser(egna.filter((s) => s.id !== nyttId), gren, extra)).map((u) => u.id));
  return tagna(beraknaUtmarkelser(egna, gren, extra)).filter((u) => !fore.has(u.id));
}

// Säsongsmål som nåtts: datumet då säsongens snitt (minst 5 serier) först nådde målet
export function malNattFor(egna, mal, skyttId, grenId, sasongFor) {
  return mal.filter((m) => m.skytt_id === skyttId && m.gren_id === grenId).map((m) => {
    const ss = egna.filter((s) => sasongFor(s.datum) === m.sasong).sort(ordning);
    let sum = 0; let datum = null;
    ss.forEach((s, i) => { sum += Number(s.poang); if (!datum && i >= 4 && sum / (i + 1) >= Number(m.snitt)) datum = s.datum; });
    return datum ? { sasong: m.sasong, datum } : null;
  }).filter(Boolean);
}

const IKON = { Milstolpar: '◎', Resultat: '✦', Stjärnor: '★', Skott: '◉', Rekord: '▲', Familjen: '♥' };

// Ett märke är en knapp – tryck för förklaringen (visas av visaForklaring)
export function marke(u) {
  return `<button type="button" class="marke niva${u.niva}${u.datum ? ' tagen' : ''}" data-utm="${esc(u.id)}" aria-label="${esc(u.namn)} – ${esc(NIVAER[u.niva])}${u.datum ? `, tagen ${esc(u.datum)}` : ''}. Visa förklaring">
    <span class="markeikon" aria-hidden="true">${IKON[u.grupp] ?? '•'}</span>
    <span class="markenamn">${esc(u.namn)}</span>
    <small>${u.datum ? esc(u.datum) : u.framsteg ? `${u.framsteg[0]} av ${u.framsteg[1]}` : 'inte än'}</small>
    ${!u.datum && u.framsteg ? `<span class="markestapel"><span style="width:${Math.round((100 * u.framsteg[0]) / u.framsteg[1])}%"></span></span>` : ''}
  </button>`;
}

// Förklaringsruta: kopplas en gång per sida. lista = alla utmärkelser som visas, nyckel = id (+ skytt)
export function kopplaForklaring(el, hamta) {
  el.utmHamta = hamta;                      // senaste sidans uppslag gäller
  if (el.utmKopplad) return;
  el.utmKopplad = true;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-utm]'); if (!b) return;
    const u = el.utmHamta?.(b);
    if (!u) return;
    let ruta = document.getElementById('utmruta');
    if (!ruta) {
      ruta = document.createElement('div'); ruta.id = 'utmruta'; ruta.className = 'utmruta'; ruta.setAttribute('role', 'dialog'); ruta.setAttribute('aria-modal', 'true');
      document.body.appendChild(ruta);
      ruta.addEventListener('click', (ev) => { if (ev.target === ruta || ev.target.closest('.stang')) ruta.hidden = true; });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') ruta.hidden = true; });
    }
    ruta.innerHTML = `<div class="utmkort niva${u.niva}${u.datum ? ' tagen' : ''}">
      <div class="utmtopp"><span class="markeikon" aria-hidden="true">${IKON[u.grupp] ?? '•'}</span>
        <div><h3>${esc(u.namn)}</h3><span class="nivaetikett">${esc(NIVAER[u.niva])} · ${esc(u.grupp)}</span></div></div>
      <p>${esc(u.forklaring)}</p>
      <p class="utmstatus">${u.datum ? `<b>Tagen ${esc(u.datum)}</b>` : u.framsteg ? `Inte tagen än – ${u.framsteg[0]} av ${u.framsteg[1]}` : 'Inte tagen än'}</p>
      ${!u.datum && u.framsteg ? `<span class="markestapel stor"><span style="width:${Math.round((100 * u.framsteg[0]) / u.framsteg[1])}%"></span></span>` : ''}
      <button type="button" class="btn stang">Stäng</button>
    </div>`;
    ruta.hidden = false;
    ruta.querySelector('.stang').focus();
  });
}
