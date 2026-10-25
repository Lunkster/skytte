// Statistik paket A (F-30–F-37): form, rekord, jämnhet, serienummer, träningsmängd, kvällens skytt,
// säsongsmål och grenarna jämförda. Fungerar med serier inmatade både som total och skott för skott.
import { esc, fmt, idag, maxSkott } from './lib.js?v=0.5.0';

const medel = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const poang = (s) => Number(s.poang);

// ---------- säsong: 1 augusti – 31 juli ----------
export const sasongFor = (datum) => { const y = Number(datum.slice(0, 4)), m = Number(datum.slice(5, 7)); return m >= 8 ? y : y - 1; };
export const sasongNamn = (y) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;

// ---------- F-30: form = snitt av de senaste 3 dagsmedlen, jämfört med eget snitt ----------
export function form(dagE, snitt) {
  if (dagE.length < 2) return null;
  const sista = dagE.slice(-3).map((d) => Number(d.snitt));
  const f = medel(sista);
  return { varde: f, diff: f - snitt, antal: sista.length };
}
export const formPil = (f) => {
  if (!f) return '<span class="muted">–</span>';
  const pil = f.diff > 0.3 ? '↑' : f.diff < -0.3 ? '↓' : '→';
  const kl = f.diff > 0.3 ? 'upp' : f.diff < -0.3 ? 'ner' : '';
  return `<span class="form ${kl}" title="Snitt senaste ${f.antal} dagar ${fmt(f.varde, 2)} mot eget snitt">${pil} ${f.diff > 0 ? '+' : f.diff < 0 ? '−' : ''}${fmt(Math.abs(f.diff), 1)}</span>`;
};

// ---------- F-37: procent av max ----------
export const maxSerie = (gren) => gren.antal_skott * maxSkott(gren);
export const procent = (v, gren) => (100 * v) / maxSerie(gren);

// ---------- F-35: kvällens skytt = mest över sitt eget snitt före den dagen ----------
// Lista över alla kvällar med en kvällens skytt (används även av utmärkelser och skyttsidan)
export function kvallensLista(allaSerier, dagar, fran = '0000') {
  const datumen = [...new Set(dagar.map((d) => d.datum))].sort();
  const lista = [];
  for (const datum of datumen) {
    if (datum < fran) continue;
    const kandidater = dagar.filter((d) => d.datum === datum).map((d) => {
      const tidigare = allaSerier.filter((s) => s.skytt_id === d.skytt_id && s.datum < datum).map(poang);
      if (tidigare.length < 2) return null;
      const bas = medel(tidigare);
      return { skytt_id: d.skytt_id, dag: Number(d.snitt), bas, diff: Number(d.snitt) - bas, deltog: 0 };
    }).filter(Boolean);
    const deltog = dagar.filter((d) => d.datum === datum).length;
    if (!kandidater.length || deltog < 2) continue;
    const vinnare = kandidater.reduce((a, k) => (k.diff > a.diff ? k : a));
    lista.push({ datum, ...vinnare, deltog });
  }
  return lista;
}

export function kvallensSkytt(allaSerier, dagar, g, fran) {
  const lista = kvallensLista(allaSerier, dagar, fran);
  if (!lista.length) return '';
  const namn = (id) => g.skyttar.find((s) => s.id === id)?.namn ?? '?';
  const lank = (id) => `<a href="#/skytt/${id}" class="skyttlank">${esc(namn(id))}</a>`;
  const antal = g.skyttar.map((sk) => ({ sk, n: lista.filter((x) => x.skytt_id === sk.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const senaste = [...lista].reverse().slice(0, 8);
  return `<section class="card" id="kvallens">
    <h2>Kvällens skytt</h2>
    <p class="kvallens-antal">${antal.map((x) => `<span><b>${lank(x.sk.id)}</b> ${x.n} ${x.n === 1 ? 'gång' : 'gånger'}</span>`).join('')}</p>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Datum</th><th>Kvällens skytt</th><th class="tal">Dagsmedel</th><th class="tal">Mot eget snitt</th></tr></thead>
      <tbody>${senaste.map((x) => `<tr><td>${esc(x.datum)}</td><td><b>${lank(x.skytt_id)}</b></td><td class="tal">${fmt(x.dag, 2)}</td>
        <td class="tal"><span class="form ${x.diff >= 0 ? 'upp' : 'ner'}">${x.diff >= 0 ? '+' : '−'}${fmt(Math.abs(x.diff), 2)}</span><small class="datum">snitt ${fmt(x.bas, 2)}</small></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="hjalp">Den som sköt mest över sitt eget snitt (alla tidigare serier) – så kan alla vinna, oavsett nivå. Kräver minst två skyttar samma dag och två tidigare serier.</p>
  </section>`;
}

// ---------- F-31: rekordtidslinje – serier som var nytt personbästa när de sköts ----------
export function rekordtidslinje(allaSerier, dagar, g, gren) {
  const d = gren.decimaler ? 1 : 0;
  const rader = g.skyttar.map((sk) => {
    const egna = allaSerier.filter((s) => s.skytt_id === sk.id).sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.nr - b.nr));
    if (!egna.length) return null;
    const rek = []; let max = -Infinity;
    for (const s of egna) if (poang(s) > max) { max = poang(s); rek.push(s); }
    const dagE = dagar.filter((x) => x.skytt_id === sk.id).sort((a, b) => (a.datum < b.datum ? -1 : 1));
    const dagRek = []; let dmax = -Infinity;
    for (const x of dagE) if (Number(x.snitt) > dmax) { dmax = Number(x.snitt); dagRek.push(x); }
    return { sk, rek, dagRek };
  }).filter(Boolean);
  return `<section class="card" id="rekord">
    <h2>Rekordtidslinje</h2>
    ${rader.map((r) => `<div class="rekordrad"><b>${esc(r.sk.namn)}</b>
      <div class="rekordkedja"><span class="muted liten">Serie</span>${r.rek.map((s) => `<span class="rekord"><b>${fmt(poang(s), d)}</b><small>${esc(s.datum)}</small></span>`).join('<span class="pil">›</span>')}</div>
      <div class="rekordkedja"><span class="muted liten">Dagsmedel</span>${r.dagRek.map((x) => `<span class="rekord"><b>${fmt(x.snitt, 2)}</b><small>${esc(x.datum)}</small></span>`).join('<span class="pil">›</span>')}</div>
    </div>`).join('')}
    <p class="hjalp">Varje gång ett personbästa slogs, äldst till vänster. Gäller all tid, oavsett vald period.</p>
  </section>`;
}

// ---------- F-32 + F-33: jämnhet och snitt per serienummer ----------
export function jamnhetOchSerienummer(ss, dd, g, gren) {
  const d = gren.decimaler ? 1 : 0;
  const maxNr = Math.max(...ss.map((s) => s.nr));
  const rader = g.skyttar.map((sk) => {
    const dagE = dd.filter((x) => x.skytt_id === sk.id && x.serier >= 2);
    const egna = ss.filter((s) => s.skytt_id === sk.id);
    if (!egna.length) return null;
    const sprid = dagE.map((x) => ({ datum: x.datum, v: Number(x.basta) - Number(x.samsta) }));
    const jamnast = sprid.reduce((a, x) => (!a || x.v < a.v ? x : a), null);
    const ojamnast = sprid.reduce((a, x) => (!a || x.v > a.v ? x : a), null);
    const perNr = Array.from({ length: maxNr }, (_, i) => { const p = egna.filter((s) => s.nr === i + 1).map(poang); return { snitt: medel(p), n: p.length }; });
    return { sk, sprid: medel(sprid.map((x) => x.v)), jamnast, ojamnast, perNr };
  }).filter(Boolean);
  return `<section class="card" id="jamnhet">
    <h2>Jämnhet</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th><th class="tal">Spridning/dag</th><th class="tal">Jämnaste dag</th><th class="tal">Ojämnaste dag</th></tr></thead>
      <tbody>${[...rader].filter((r) => r.sprid !== null).sort((a, b) => a.sprid - b.sprid).map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td><td class="tal"><b>${fmt(r.sprid, 1)}</b></td>
        <td class="tal">${fmt(r.jamnast.v, d)}<small class="datum">${esc(r.jamnast.datum)}</small></td><td class="tal">${fmt(r.ojamnast.v, d)}<small class="datum">${esc(r.ojamnast.datum)}</small></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="hjalp">Skillnaden mellan dagens bästa och sämsta serie – lägre är jämnare. Dagar med minst två serier.</p>
    <h3 class="underrubrik">Snitt per serienummer</h3>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th>${Array.from({ length: maxNr }, (_, i) => `<th class="tal">Serie ${i + 1}</th>`).join('')}</tr></thead>
      <tbody>${rader.map((r) => {
        const giltiga = r.perNr.map((x) => (x.n >= 2 ? x.snitt : null));
        const best = Math.max(...giltiga.filter((v) => v !== null)), samst = Math.min(...giltiga.filter((v) => v !== null));
        return `<tr><td><b>${esc(r.sk.namn)}</b></td>${r.perNr.map((x, i) => `<td class="tal${giltiga[i] === best && giltiga.filter((v) => v !== null).length > 1 ? ' basta' : ''}${giltiga[i] === samst && giltiga.filter((v) => v !== null).length > 1 ? ' framhav' : ''}">${x.n ? `${fmt(x.snitt, 2)}<small class="datum">${x.n} st</small>` : '<span class="muted">–</span>'}</td>`).join('')}</tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="hjalp">Värms man upp eller tröttnar man? Grönt = bästa serienumret, rött = sämsta (minst två serier).</p>
  </section>`;
}

// ---------- F-34: träningsmängd per månad ----------
export function traningsmangd(ss, g) {
  const manader = [...new Set(ss.map((s) => s.datum.slice(0, 7)))].sort().reverse();
  const skyttar = g.skyttar.filter((sk) => ss.some((s) => s.skytt_id === sk.id));
  const namn = (m) => new Date(`${m}-01T12:00`).toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' });
  return `<section class="card" id="traning">
    <h2>Träningsmängd</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Månad</th><th class="tal">Dagar</th>${skyttar.map((sk) => `<th class="tal">${esc(sk.namn)}<small class="datum">serier · snitt</small></th>`).join('')}</tr></thead>
      <tbody>${manader.map((m) => {
        const iM = ss.filter((s) => s.datum.startsWith(m));
        return `<tr><td>${esc(namn(m))}</td><td class="tal">${new Set(iM.map((s) => s.datum)).size}</td>
          ${skyttar.map((sk) => { const p = iM.filter((s) => s.skytt_id === sk.id).map(poang); return `<td class="tal">${p.length ? `${p.length}<small class="datum">${fmt(medel(p), 2)}</small>` : '<span class="muted">–</span>'}</td>`; }).join('')}</tr>`;
      }).join('')}</tbody>
    </table></div>
    <p class="hjalp">Antal skjutdagar och per skytt antal serier och snitt per serie, nyaste månaden först.</p>
  </section>`;
}

// ---------- F-36: säsongsmål ----------
export function sasongsmal(allaSerier, mal, g, gren, sasong) {
  const d = gren.decimaler ? 1 : 0;
  const iS = allaSerier.filter((s) => sasongFor(s.datum) === sasong);
  const skyttar = g.skyttar.filter((sk) => sk.aktiv);
  const rader = skyttar.map((sk) => {
    const p = iS.filter((s) => s.skytt_id === sk.id).map(poang);
    const m = mal.find((x) => x.skytt_id === sk.id && x.gren_id === gren.id && x.sasong === sasong);
    return { sk, snitt: medel(p), n: p.length, mal: m ? Number(m.snitt) : null };
  });
  const matare = (r) => {
    if (r.mal === null) return '<span class="muted liten">Inget mål satt</span>';
    if (r.snitt === null) return `<span class="muted liten">Mål ${fmt(r.mal, d)} – inga serier än</span>`;
    const fyll = Math.max(0, Math.min(1, (r.snitt - (r.mal - 5)) / 5));
    const klart = r.snitt >= r.mal;
    return `<div class="matare${klart ? ' klar' : ''}" role="meter" aria-valuemin="${r.mal - 5}" aria-valuemax="${r.mal}" aria-valuenow="${r.snitt.toFixed(2)}" aria-label="${esc(r.sk.namn)}: ${fmt(r.snitt, 2)} av mål ${fmt(r.mal, d)}">
      <div class="fyllning" style="width:${(fyll * 100).toFixed(0)}%"></div></div>
      <span class="liten">${fmt(r.snitt, 2)} av ${fmt(r.mal, d)} · ${klart ? '<b class="form upp">mål nått!</b>' : `${fmt(r.mal - r.snitt, 2)} kvar`}</span>`;
  };
  return `<section class="card" id="mal">
    <h2>Säsongsmål ${esc(sasongNamn(sasong))}</h2>
    <div class="malrader">${rader.map((r) => `<div class="malrad" data-skytt="${r.sk.id}">
      <div class="malhuvud"><b>${esc(r.sk.namn)}</b><span class="muted liten">${r.n} serier</span>
        <button type="button" class="btn liten textknapp" data-andra="${r.sk.id}">${r.mal === null ? 'Sätt mål' : 'Ändra'}</button></div>
      <div class="malkropp">${matare(r)}</div>
      <form class="malform" data-skytt="${r.sk.id}" hidden>
        <input inputmode="decimal" placeholder="Snitt per serie, t.ex. ${gren.decimaler ? '100,0' : '45'}" value="${r.mal === null ? '' : fmt(r.mal, d)}" aria-label="Mål för ${esc(r.sk.namn)}">
        <button type="submit" class="btn liten textknapp">Spara</button>
        ${r.mal === null ? '' : `<button type="button" class="btn liten textknapp" data-tabort="${r.sk.id}">Ta bort</button>`}
      </form>
    </div>`).join('')}</div>
    <p class="hjalp">Mål = snitt per serie under säsongen (1 aug – 31 jul). Mätaren börjar 5 poäng under målet.</p>
  </section>`;
}

// ---------- F-37: grenarna jämförda i procent av max ----------
export function grenarJamforda(serier, g) {
  const rader = g.skyttar.map((sk) => {
    const per = g.grenar.map((gr) => { const p = serier.filter((s) => s.skytt_id === sk.id && s.gren_id === gr.id).map(poang); return p.length ? { snitt: medel(p), pct: procent(medel(p), gr), n: p.length } : null; });
    return per.filter(Boolean).length ? { sk, per } : null;
  }).filter(Boolean);
  const grenarMedData = g.grenar.filter((gr, i) => rader.some((r) => r.per[i]));
  if (grenarMedData.length < 2) return '';
  return `<section class="card" id="grenar">
    <h2>Grenarna jämförda</h2>
    <div class="tabellwrap"><table class="tabell">
      <thead><tr><th>Skytt</th>${g.grenar.map((gr) => `<th class="tal">${esc(gr.namn)}<small class="datum">max ${fmt(maxSerie(gr), gr.decimaler ? 1 : 1)}</small></th>`).join('')}</tr></thead>
      <tbody>${rader.map((r) => `<tr><td><b>${esc(r.sk.namn)}</b></td>${r.per.map((x) => `<td class="tal">${x ? `${fmt(x.pct, 1)} %<small class="datum">snitt ${fmt(x.snitt, 1)} · ${x.n} st</small>` : '<span class="muted">–</span>'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <p class="hjalp">Snitt per serie i procent av maxpoängen, så att grenarna går att jämföra. All tid.</p>
  </section>`;
}

export const aktuellSasong = () => sasongFor(idag());
