// Utmärkelser (F-43). Räknas fram ur serierna – lagras inte. Allt är per skytt och gren.
// Varje utmärkelse har id, namn, beskrivning och antingen datum (när den togs) eller framsteg (n av mål).
import { esc, fmt, maxSkott } from './lib.js?v=0.5.0';

const ordning = (a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.nr - b.nr);

// egna: skyttens serier i grenen (v_serie-rader med poang, stjarnor, skott, datum, nr)
// extra: { guld: guldnivåer för grenen, kvallens: [{datum}], malNatt: [{sasong, datum}] }
export function beraknaUtmarkelser(egna, gren, extra = {}) {
  const ser = [...egna].sort(ordning);
  const guld = [...(extra.guld ?? [])].sort((a, b) => Number(a.grans) - Number(b.grans));
  const ut = [];
  const lagg = (id, grupp, namn, beskr, datum, framsteg = null) => ut.push({ id, grupp, namn, beskr, datum: datum ?? null, framsteg });
  const nte = (lista, n) => (lista.length >= n ? lista[n - 1].datum : null);
  const poang = (s) => Number(s.poang);

  // Milstolpar
  for (const n of [1, 10, 25, 50, 100, 200]) {
    lagg(`serier-${n}`, 'Milstolpar', n === 1 ? 'Första serien' : `${n} serier`, n === 1 ? 'Första inmatade serien' : `Skjutit ${n} serier`, nte(ser, n), [Math.min(ser.length, n), n]);
  }
  const dagar = [...new Set(ser.map((s) => s.datum))].sort();
  for (const n of [10, 25, 50]) lagg(`dagar-${n}`, 'Milstolpar', `${n} skjutdagar`, `Skjutit ${n} olika dagar`, dagar.length >= n ? dagar[n - 1] : null, [Math.min(dagar.length, n), n]);

  // Guld
  for (const g of guld) {
    const forsta = ser.find((s) => poang(s) >= Number(g.grans));
    lagg(`guld-${g.grans}`, 'Guld', `Första ${g.namn}`, `En serie på minst ${fmt(g.grans, 0)}`, forsta?.datum);
  }
  if (guld.length) {
    const grans = Number(guld[0].grans);
    for (const n of [3, 5, 10]) {
      let i = 0, datum = null, basta = 0;
      for (const s of ser) { i = poang(s) >= grans ? i + 1 : 0; basta = Math.max(basta, i); if (i === n && !datum) datum = s.datum; }
      lagg(`guldsvit-${n}`, 'Guld', `${n} ${guld[0].namn} i rad`, `${n} serier i följd på minst ${fmt(grans, 0)}`, datum, [Math.min(basta, n), n]);
    }
    const helDag = dagar.find((d) => { const p = ser.filter((s) => s.datum === d); return p.length >= 2 && p.every((s) => poang(s) >= grans); });
    lagg('guld-dag', 'Guld', 'Gulddag', `Alla serier en dag (minst två) på minst ${fmt(grans, 0)}`, helDag);
  }

  // Stjärnor
  const n = gren.antal_skott;
  for (const k of [Math.ceil(n / 2), n - 2, n].filter((v, i, a) => v > 0 && a.indexOf(v) === i)) {
    const s = ser.find((x) => (x.stjarnor ?? 0) >= k);
    lagg(`stj-serie-${k}`, 'Stjärnor', k === n ? 'Stjärnregn' : `${k} ★ i en serie`, k === n ? `Alla ${n} skott stjärnor i en serie` : `Minst ${k} stjärnor i en serie`, s?.datum);
  }
  let summaStj = 0; const stjMal = [100, 250, 500]; const stjDatum = {};
  for (const s of ser) { summaStj += s.stjarnor ?? 0; for (const m of stjMal) if (summaStj >= m && !stjDatum[m]) stjDatum[m] = s.datum; }
  for (const m of stjMal) lagg(`stj-tot-${m}`, 'Stjärnor', `${m} stjärnor`, `${m} stjärnor totalt`, stjDatum[m], [Math.min(summaStj, m), m]);

  // Skott (bara serier med skott)
  const medSkott = ser.filter((s) => s.skott?.length);
  if (medSkott.length) {
    const max = maxSkott(gren);
    const prick = medSkott.find((s) => s.skott.some((v) => Number(v) >= max - 1e-9));
    lagg('mitt-i-prick', 'Skott', 'Mitt i prick', gren.decimaler ? `Ett skott på ${fmt(max, 1)}` : 'En fullträff', prick?.datum);
    const jamn = medSkott.find((s) => s.skott.length === n && s.skott.every((v) => Number(v) >= 9));
    lagg('jamn-serie', 'Skott', 'Inga misstag', 'En hel serie utan skott under 9', jamn?.datum);
    for (const k of [5, 10]) {
      let i = 0, dag = null, datum = null, basta = 0;
      for (const s of medSkott) {
        if (s.datum !== dag) { dag = s.datum; i = 0; }
        for (const v of s.skott.map(Number)) { i = v >= 10 ? i + 1 : 0; basta = Math.max(basta, i); if (i >= k && !datum) datum = s.datum; }
      }
      lagg(`tiosvit-${k}`, 'Skott', `${k} tior i rad`, `${k} skott i följd på 10 eller mer samma dag`, datum, [Math.min(basta, k), k]);
    }
  }

  // Rekord
  let max = -Infinity, rekord = 0; const rekDatum = {};
  for (const s of ser) { if (poang(s) > max) { if (max > -Infinity) { rekord += 1; for (const m of [1, 5, 10]) if (rekord >= m && !rekDatum[m]) rekDatum[m] = s.datum; } max = poang(s); } }
  lagg('rekord-1', 'Rekord', 'Nytt personbästa', 'Slagit sitt personbästa för en serie', rekDatum[1]);
  lagg('rekord-5', 'Rekord', 'Rekordjägare', 'Slagit personbästa fem gånger', rekDatum[5], [Math.min(rekord, 5), 5]);

  // Familjen (kräver data om de andra)
  if (extra.kvallens) {
    const k = [...extra.kvallens].sort((a, b) => (a.datum < b.datum ? -1 : 1));
    lagg('kvallens-1', 'Familjen', 'Kvällens skytt', 'Sköt mest över sitt snitt en kväll', k[0]?.datum);
    lagg('kvallens-5', 'Familjen', 'Kvällens skytt ×5', 'Kvällens skytt fem gånger', k[4]?.datum, [Math.min(k.length, 5), 5]);
  }
  if (extra.malNatt) lagg('mal-natt', 'Familjen', 'Målet nått', 'Nått sitt säsongsmål', extra.malNatt[0]?.datum);
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

const IKON = { Milstolpar: '◎', Guld: '✦', Stjärnor: '★', Skott: '◉', Rekord: '▲', Familjen: '♥' };

export function marke(u, gren) {
  return `<div class="marke${u.datum ? ' tagen' : ''}" title="${esc(u.beskr)}">
    <span class="markeikon" aria-hidden="true">${IKON[u.grupp] ?? '•'}</span>
    <span class="markenamn">${esc(u.namn)}</span>
    <small>${u.datum ? esc(u.datum) : u.framsteg ? `${u.framsteg[0]} av ${u.framsteg[1]}` : 'inte än'}</small>
    ${!u.datum && u.framsteg ? `<span class="markestapel"><span style="width:${Math.round((100 * u.framsteg[0]) / u.framsteg[1])}%"></span></span>` : ''}
  </div>`;
}
