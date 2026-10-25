// Attrapp för Supabase (PostgREST + auth) i minnet – testerna rör aldrig riktiga databasen.
// Påhittade skyttar och resultat.
export function skapaDb() {
  const db = {
    skytt: [{ id: 1, namn: 'Anna', aktiv: true, ordning: 1 }, { id: 2, namn: 'Bo', aktiv: true, ordning: 2 }, { id: 3, namn: 'Cia', aktiv: true, ordning: 3 }, { id: 4, namn: 'Dan', aktiv: true, ordning: 4 }],
    gren: [
      { id: 1, kod: 'lg10', namn: 'Luftgevär 10 m', antal_skott: 10, decimaler: true, fulltraff: null, stjarna_fran: '10.2', aktiv: true, ordning: 1 },
      { id: 2, kod: 'sg50', namn: 'Salongsgevär 50 m', antal_skott: 5, decimaler: false, fulltraff: '10.1', stjarna_fran: '10.1', aktiv: true, ordning: 2 },
    ],
    guldniva: [[97, 'GULD'], [101, 'GULD ☆'], [103, 'GULD ☆☆'], [105, 'GULD ☆☆☆']].map(([g, n]) => ({ gren_id: 1, grans: String(g), namn: n })),
    serie: [], skott: [], kommentar: [], nextId: 1,
  };
  const dagar = ['2026-02-03', '2026-03-03', '2026-04-07', '2026-10-20'];
  let r = 7; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  for (const datum of dagar) for (const sid of [1, 2, 3]) for (let nr = 1; nr <= 3; nr++) {
    const total = Math.round((94 + rnd() * 10 + sid) * 10) / 10;
    db.serie.push({ id: db.nextId++, skytt_id: sid, gren_id: 1, datum, nr, total, stjarnor: Math.floor(rnd() * 8), skapad: datum });
  }
  db.kommentar.push({ skytt_id: 1, datum: '2026-10-20', text: 'Bra dag, nytt gevär.' });
  return db;
}

function vSerie(db) {
  return db.serie.map((s) => {
    const g = db.gren.find((x) => x.id === s.gren_id), sk = db.skytt.find((x) => x.id === s.skytt_id);
    const x = db.skott.filter((k) => k.serie_id === s.id).sort((a, b) => a.nr - b.nr);
    const harSkott = x.length > 0;
    return {
      id: s.id, datum: s.datum, nr: s.nr, skytt_id: s.skytt_id, skytt: sk.namn, gren_id: g.id, gren_kod: g.kod, gren: g.namn,
      inmatning: harSkott ? 'skott' : 'total',
      poang: harSkott ? String(Math.round(x.reduce((a, k) => a + k.varde, 0) * 10) / 10) : String(s.total),
      stjarnor: harSkott ? x.filter((k) => k.varde >= Number(g.stjarna_fran)).length : s.stjarnor,
      antal_skott: x.length, skott_per_serie: g.antal_skott, ofullstandig: harSkott && x.length < g.antal_skott,
      skott: x.map((k) => String(k.varde)), skapad: s.skapad,
    };
  });
}
function vDag(db) {
  const m = new Map();
  vSerie(db).forEach((v) => {
    const k = `${v.datum}|${v.skytt_id}|${v.gren_id}`;
    if (!m.has(k)) m.set(k, { datum: v.datum, skytt_id: v.skytt_id, skytt: v.skytt, gren_id: v.gren_id, gren_kod: v.gren_kod, gren: v.gren, p: [], stj: 0 });
    const d = m.get(k); d.p.push(Number(v.poang)); d.stj += v.stjarnor ?? 0;
  });
  return [...m.values()].map((d) => ({
    datum: d.datum, skytt_id: d.skytt_id, skytt: d.skytt, gren_id: d.gren_id, gren_kod: d.gren_kod, gren: d.gren, serier: d.p.length,
    snitt: (d.p.reduce((a, v) => a + v, 0) / d.p.length).toFixed(2), basta: String(Math.max(...d.p)), samsta: String(Math.min(...d.p)), stjarnor: d.stj,
    kommentar: db.kommentar.find((k) => k.skytt_id === d.skytt_id && k.datum === d.datum)?.text ?? null,
  }));
}

const filtrera = (rows, q) => {
  let ut = rows;
  for (const [k, v] of q) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.')) ut = ut.filter((r) => String(r[k]) === v.slice(3));
  }
  const order = q.get('order');
  if (order) {
    const delar = order.split(',').map((o) => { const [f, dir] = o.split('.'); return [f, dir === 'desc' ? -1 : 1]; });
    ut = [...ut].sort((a, b) => { for (const [f, d] of delar) { if (a[f] < b[f]) return -d; if (a[f] > b[f]) return d; } return 0; });
  }
  return ut;
};

// Kopplar attrappen till en Playwright-sida. log samlar skrivningar.
export async function koppla(page, db, log = [], kod = 'kod123') {
  await page.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (!u.hostname.includes('supabase')) return route.continue();
    const J = (b, s = 200) => route.fulfill({ status: s, body: JSON.stringify(b), contentType: 'application/json' });
    if (u.pathname.includes('/auth/')) {
      const b = JSON.parse(req.postData());
      return b.password === kod || b.refresh_token ? J({ access_token: 'x.e30.y', refresh_token: 'rt', expires_at: Date.now() / 1000 + 3600 }) : J({ error: 'bad' }, 400);
    }
    if (req.headers()['accept-profile'] !== 'skytte') return J({ message: 'fel schema' }, 406);
    const t = u.pathname.replace('/rest/v1/', ''), q = u.searchParams, m = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (m === 'GET') {
      const kalla = { v_serie: vSerie(db), v_dag: vDag(db) }[t] ?? db[t];
      return kalla ? J(filtrera(kalla, q)) : J({ message: 'okänd ' + t }, 404);
    }
    log.push(`${m} ${t}${u.search} ${JSON.stringify(body)}`);
    if (req.headers()['content-profile'] !== 'skytte') return J({ message: 'fel schema' }, 406);
    if (m === 'POST' && t === 'serie') {
      if (db.serie.some((s) => s.skytt_id === body.skytt_id && s.gren_id === body.gren_id && s.datum === body.datum && s.nr === body.nr)) return J({ code: '23505', message: 'duplicate key' }, 409);
      const s = { ...body, id: db.nextId++, skapad: new Date().toISOString() }; db.serie.push(s); return J([s], 201);
    }
    if (m === 'POST' && t === 'skott') { db.skott.push(...body); return route.fulfill({ status: 201, body: '' }); }
    if (m === 'POST' && t === 'kommentar') {
      db.kommentar = db.kommentar.filter((k) => !(k.skytt_id === body.skytt_id && k.datum === body.datum)); db.kommentar.push(body);
      return route.fulfill({ status: 201, body: '' });
    }
    if (m === 'PATCH' && t === 'serie') { const id = Number(q.get('id').slice(3)); Object.assign(db.serie.find((s) => s.id === id), body); return route.fulfill({ status: 204, body: '' }); }
    if (m === 'DELETE') {
      const keep = (r) => ![...q].every(([k, v]) => String(r[k]) === v.slice(3));
      if (t === 'serie') { const ids = db.serie.filter((r) => !keep(r)).map((r) => r.id); db.serie = db.serie.filter(keep); db.skott = db.skott.filter((k) => !ids.includes(k.serie_id)); }
      else db[t] = db[t].filter(keep);
      return route.fulfill({ status: 204, body: '' });
    }
    return J({ message: 'ej hanterat' }, 400);
  });
}
