// Gemensamt: Supabase-anrop mot schemat skytte, inloggning med familjekoden, hjälpfunktioner.

export const SUPABASE_URL = 'https://nlvgisjssbjethumvgdz.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_3wzcVvDgcoupfWSqAis4eg_bz2e6jiG'; // publik nyckel, skyddet är RLS
// Ett delat familjekonto – koden är lösenordet. Rollen 'skytte' står i kontots app_metadata.
const KONTO = 'h.lundqvist+skytte@gmail.com';
const SCHEMA = 'skytte';
const SESSION_KEY = 'skytte-session';   // samma webbadress (lunkster.github.io) som THT – egen nyckel

// ---------- lokala inställningar (senaste val) ----------
export function minns(nyckel, varde) {
  const k = `skytte-${nyckel}`;
  try {
    if (varde === undefined) return JSON.parse(localStorage.getItem(k));
    localStorage.setItem(k, JSON.stringify(varde));
  } catch { /* privat läge */ }
  return varde;
}

// ---------- läsa ----------
export async function api(path) {
  const s = await session(true);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, Accept: 'application/json', 'Accept-Profile': SCHEMA },
  });
  if (!r.ok) throw await fel(r);
  return r.json();
}

// ---------- skriva ----------
export async function write(method, path, body, prefer = 'return=representation') {
  const s = await session(true);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json', 'Content-Profile': SCHEMA, 'Accept-Profile': SCHEMA, Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw await fel(r);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function fel(r) {
  const t = await r.text();
  let msg = t, code = null;
  try { const j = JSON.parse(t); msg = j.message || t; code = j.code; } catch { /* text */ }
  if (r.status === 401) logout();
  return Object.assign(new Error(msg), { status: r.status, code });
}

// ---------- inloggning ----------
function load() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function save(s) { try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* privat läge */ } }
let current = load();

async function auth(grant, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at };
}

export async function login(kod) {
  current = await auth('password', { email: KONTO, password: kod });
  save(current);
  return !!current;
}
export function logout() { current = null; save(null); }
export const isLoggedIn = () => !!current;

async function session(required) {
  if (!current) { if (required) throw Object.assign(new Error('Inte inloggad'), { status: 401 }); return null; }
  if (current.expires_at * 1000 < Date.now() + 60_000) {
    const s = await auth('refresh_token', { refresh_token: current.refresh_token });
    if (!s) { logout(); if (required) throw Object.assign(new Error('Inloggningen har gått ut'), { status: 401 }); return null; }
    current = s; save(s);
  }
  return current;
}

// ---------- hjälp ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (v, d = 1) => (v === null || v === undefined || Number.isNaN(Number(v))) ? '–'
  : Number(v).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const idag = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const num = (v) => (v === null || v === undefined ? null : Number(v));

// Högsta värdet per skott i en gren
export const maxSkott = (g) => (g.decimaler ? 10.9 : Number(g.fulltraff ?? 10));

// Tolka ett skott. Godtar komma och punkt.
// Decimalgren: "104" → 10,4 och "98" → 9,8 (siffror utan tecken som blir över 10,9 delas med 10).
// Heltalsgren: 0–10, och fullträff skrivs som 10,1 eller X.
// Tomt → null, ogiltigt → NaN.
export function tolkaSkott(txt, g) {
  let t = String(txt ?? '').trim().replace(',', '.');
  if (!t) return null;
  if (!g.decimaler && /^[xX*]$/.test(t)) return Number(g.fulltraff ?? NaN);
  if (!/^\d{1,3}(\.\d)?$/.test(t)) return NaN;
  let v = Number(t);
  if (g.decimaler && !t.includes('.') && v > 10.9) v = v / 10;
  v = Math.round(v * 10) / 10;
  if (v < 0 || v > maxSkott(g)) return NaN;
  if (!g.decimaler && v !== Math.trunc(v) && v !== Number(g.fulltraff)) return NaN;
  return v;
}

// Tolka en serietotal. Tomt → null, ogiltigt → NaN.
export function tolkaTotal(txt, g) {
  const t = String(txt ?? '').trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d{1,3}(\.\d)?$/.test(t)) return NaN;
  const v = Number(t);
  if (v < 0 || v > g.antal_skott * maxSkott(g) + 1e-9) return NaN;
  return v;
}

export const stjarna = (v, g) => v !== null && !Number.isNaN(v) && v >= Number(g.stjarna_fran) - 1e-9;
export const summa = (vals) => Math.round(vals.reduce((a, v) => a + v, 0) * 10) / 10;
