// Mata in (och ändra) en serie: gren, skytt, datum, serienummer, serietotal eller skott för skott.
import { api, write, esc, fmt, idag, minns, num, tolkaSkott, tolkaTotal, stjarna, summa, maxSkott } from './lib.js?v=0.4.0';

let flash = '';   // meddelande som ska visas efter nästa sidbyte (t.ex. "sparad, nästa serie")

export async function renderMata(app, g, serieId = null, lage = '') {
  const grenar = g.grenar.filter((x) => x.aktiv || serieId);
  const skyttar = g.skyttar.filter((x) => x.aktiv || serieId);
  const st = {
    gren: grenar.find((x) => x.id === minns('gren')) ?? grenar[0],
    skytt: skyttar.find((x) => x.id === minns('skytt')) ?? null,
    datum: idag(),
    nr: 1, nrAndrat: false,
    satt: null,                 // 'total' | 'skott'
    vals: [], cursor: 0,        // skott
    total: '', stjarnor: 0,     // serietotal
    kommentar: '', kommentarOrig: '',
    redigera: null,             // serien som ändras
  };

  if (serieId) {
    const [s] = await api(`v_serie?id=eq.${serieId}&select=*`);
    if (!s) { app.innerHTML = '<div class="card"><p>Serien finns inte längre.</p><p><a href="#/serier">Till serierna</a></p></div>'; return; }
    st.redigera = s;
    st.gren = g.grenar.find((x) => x.id === s.gren_id);
    st.skytt = g.skyttar.find((x) => x.id === s.skytt_id);
    st.datum = s.datum; st.nr = s.nr; st.nrAndrat = true;
    st.satt = s.inmatning;
    if (s.inmatning === 'skott') st.vals = s.skott.map(Number);
    else {
      st.total = fmt(s.poang, 1).replace(/\s/g, ''); st.stjarnor = s.stjarnor ?? 0;
      st.jamfor = { poang: Number(s.poang), stjarnor: s.stjarnor };   // inmatad total att jämföra skotten mot
      if (lage === 'skott') st.satt = 'skott';
    }
  }
  if (!st.satt) st.satt = minns(`satt-${st.gren.kod}`) ?? 'total';
  nollstallSkott(st);

  app.innerHTML = `
    <h1>${st.redigera ? 'Ändra serie' : 'Mata in'}</h1>
    ${flash ? `<p class="msg info">${esc(flash)}</p>` : ''}
    <section class="card form">
      <div class="falt"><span class="etikett">Gren</span><div class="seg" id="gren"></div></div>
      <div class="falt"><span class="etikett">Skytt</span><div class="chips" id="skytt"></div></div>
      <div class="rad2">
        <div class="falt"><label class="etikett" for="datum">Datum</label><input type="date" id="datum" value="${esc(st.datum)}" max="${idag()}"></div>
        <div class="falt"><span class="etikett">Serie</span>
          <div class="stepper"><button type="button" class="btn liten" data-nr="-1" aria-label="Föregående serienummer">−</button>
          <output id="nr">${st.nr}</output><button type="button" class="btn liten" data-nr="1" aria-label="Nästa serienummer">+</button></div></div>
      </div>
      <div class="falt"><span class="etikett">Inmatning</span>
        <div class="seg" id="satt">
          <button type="button" data-satt="total">Serietotal</button><button type="button" data-satt="skott">Enskilda skott</button>
        </div></div>
      <div class="info" id="kompl" hidden></div>
      <div id="inmatning"></div>
      <div class="summa" id="summa"></div>
      <details class="kommentar" id="kommentarbox">
        <summary>Kommentar för dagen <span class="muted" id="kommentarvem"></span></summary>
        <textarea id="kommentar" rows="3" maxlength="2000" placeholder="Form, gevär, väder …"></textarea>
        <button type="button" class="btn liten" id="sparakommentar">Spara kommentar</button>
      </details>
      <div class="knappar">
        <button type="button" class="btn primar stor" id="spara">${st.redigera ? 'Spara ändringar' : 'Spara serie'}</button>
        ${st.redigera ? '<button type="button" class="btn fara" id="tabort">Ta bort</button><a class="btn" href="#/serier">Avbryt</a>' : ''}
      </div>
      <p class="msg" id="msg" role="status"></p>
    </section>
    <section id="dagens"></section>`;

  const $ = (id) => app.querySelector(`#${id}`);

  // ---------- val ----------
  function ritaVal() {
    $('gren').innerHTML = grenar.map((x) => `<button type="button" data-id="${x.id}" class="${x.id === st.gren.id ? 'vald' : ''}">${esc(x.namn)}</button>`).join('');
    $('skytt').innerHTML = skyttar.map((x) => `<button type="button" data-id="${x.id}" class="${x.id === st.skytt?.id ? 'vald' : ''}">${esc(x.namn)}</button>`).join('');
    app.querySelectorAll('#satt button').forEach((b) => b.classList.toggle('vald', b.dataset.satt === st.satt));
    $('nr').textContent = st.nr;
    const kompl = $('kompl');
    kompl.hidden = !st.jamfor;
    if (st.jamfor) {
      kompl.innerHTML = st.satt === 'total'
        ? `Inmatad som total: <b>${fmt(st.jamfor.poang)}</b> <span class="stj">★ ${st.jamfor.stjarnor ?? '–'}</span>. Har du skotten på utskriften?
           <button type="button" class="btn" id="komplknapp">Komplettera med skott</button>`
        : `Kompletterar serien som var inmatad som total: <b>${fmt(st.jamfor.poang)}</b> <span class="stj">★ ${st.jamfor.stjarnor ?? '–'}</span>.`;
      $('komplknapp')?.addEventListener('click', () => { app.querySelector('#satt button[data-satt=skott]').click(); });
    }
    $('spara').textContent = !st.redigera ? 'Spara serie' : (st.jamfor && st.satt === 'skott' ? 'Spara och nästa utan skott' : 'Spara ändringar');
    $('kommentarvem').textContent = st.skytt ? `· ${st.skytt.namn} ${st.datum}` : '';
  }

  $('gren').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const ny = grenar.find((x) => x.id === Number(b.dataset.id));
    if (ny.id === st.gren.id) return;
    st.gren = ny; if (!st.redigera) minns('gren', ny.id);
    st.satt = minns(`satt-${ny.kod}`) ?? st.satt;
    nollstallSkott(st); st.total = ''; st.stjarnor = 0; st.nrAndrat = !!st.redigera && st.nrAndrat;
    meddela(''); ritaVal(); ritaInmatning(); await laddaDag();
  });
  $('skytt').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    st.skytt = skyttar.find((x) => x.id === Number(b.dataset.id));
    if (!st.redigera) { minns('skytt', st.skytt.id); st.nrAndrat = false; }
    meddela(''); ritaVal(); await laddaDag();
  });
  $('datum').addEventListener('change', async (e) => {
    if (!e.target.value) return;
    st.datum = e.target.value; if (!st.redigera) st.nrAndrat = false;
    meddela(''); ritaVal(); await laddaDag();
  });
  app.querySelectorAll('[data-nr]').forEach((b) => b.addEventListener('click', () => {
    st.nr = Math.max(1, Math.min(99, st.nr + Number(b.dataset.nr))); st.nrAndrat = true; ritaVal(); ritaDag();
  }));
  $('satt').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.dataset.satt === st.satt) return;
    // Byte från skott till total: ta med summan
    if (b.dataset.satt === 'total' && st.vals.some((v) => v !== null)) {
      const ifyllda = st.vals.filter((v) => v !== null);
      st.total = fmt(summa(ifyllda), 1).replace(/\s/g, ''); st.stjarnor = ifyllda.filter((v) => stjarna(v, st.gren)).length;
    }
    st.satt = b.dataset.satt; minns(`satt-${st.gren.kod}`, st.satt);
    ritaVal(); ritaInmatning(); fokusera();
  });

  // ---------- inmatningsfälten ----------
  function ritaInmatning() {
    const gr = st.gren, n = gr.antal_skott;
    if (st.satt === 'total') {
      $('inmatning').innerHTML = `
        <div class="rad2">
          <div class="falt"><label class="etikett" for="total">Poäng (${n} skott)</label>
            <input id="total" inputmode="decimal" autocomplete="off" placeholder="${gr.decimaler ? 't.ex. 101,5' : 't.ex. 46'}" value="${esc(st.total)}"></div>
          <div class="falt"><span class="etikett">Stjärnor ★</span>
            <div class="stepper"><button type="button" class="btn liten" data-stj="-1" aria-label="En stjärna färre">−</button>
            <output id="stj">${st.stjarnor}</output><button type="button" class="btn liten" data-stj="1" aria-label="En stjärna till">+</button></div></div>
        </div>
        <p class="hjalp">${gr.decimaler ? `Stjärna = skott på ${fmt(gr.stjarna_fran)} och uppåt.` : `Stjärna = fullträff (${fmt(gr.fulltraff)}).`}</p>`;
      $('total').addEventListener('input', (e) => { st.total = e.target.value; ritaSumma(); });
      app.querySelectorAll('[data-stj]').forEach((b) => b.addEventListener('click', () => {
        st.stjarnor = Math.max(0, Math.min(n, st.stjarnor + Number(b.dataset.stj))); $('stj').textContent = st.stjarnor; ritaSumma();
      }));
    } else if (gr.decimaler) {
      $('inmatning').innerHTML = `
        <div class="skottrutnat" style="--n:${n}">${st.vals.map((v, i) => `
          <label class="skottfalt"><span>${i + 1}</span>
          <input data-i="${i}" inputmode="decimal" autocomplete="off" enterkeyhint="${i < n - 1 ? 'next' : 'done'}" value="${v === null ? '' : fmt(v, 1)}" aria-label="Skott ${i + 1}"></label>`).join('')}
        </div>
        <p class="hjalp">Skriv t.ex. <b>10,4</b> eller bara <b>104</b> (10,0 = <b>100</b>) – hoppar vidare själv. Stjärna från ${fmt(gr.stjarna_fran)}.</p>`;
      const inputs = [...app.querySelectorAll('.skottrutnat input')];
      inputs.forEach((inp) => {
        inp.addEventListener('input', () => {
          const i = Number(inp.dataset.i), t = inp.value.trim();
          const v = tolkaSkott(t, gr);
          st.vals[i] = (v === null || Number.isNaN(v)) ? null : v;
          inp.classList.toggle('ogiltig', Number.isNaN(v));
          inp.classList.toggle('stjarna', stjarna(v, gr));
          ritaSumma();
          // Klart skott → nästa ruta
          const klar = /^\d{1,2}[.,]\d$/.test(t) || /^\d{3}$/.test(t) || (/^\d{2}$/.test(t) && t !== '10');
          if (klar && !Number.isNaN(v) && i < n - 1) { inputs[i + 1].focus(); inputs[i + 1].select(); }
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const i = Number(inp.dataset.i); if (i < n - 1) inputs[i + 1].focus(); else $('spara').focus(); }
        });
        inp.addEventListener('blur', () => { const v = st.vals[Number(inp.dataset.i)]; if (v !== null) inp.value = fmt(v, 1); });
      });
      inputs.forEach((inp) => { const v = st.vals[Number(inp.dataset.i)]; inp.classList.toggle('stjarna', stjarna(v, gr)); });
    } else {
      // Heltal: tryck på värdet, rutan flyttas fram själv
      const ft = Number(gr.fulltraff);
      $('inmatning').innerHTML = `
        <div class="skottrad" id="skottrad"></div>
        <div class="knappsats" id="knappsats">
          ${Array.from({ length: 11 }, (_, i) => 10 - i).map((v) => `<button type="button" data-v="${v}">${v}</button>`).join('')}
          ${gr.fulltraff ? `<button type="button" data-v="${ft}" class="ft" aria-label="Fullträff">X</button>` : ''}
          <button type="button" data-v="bort" class="bort" aria-label="Sudda">⌫</button>
        </div>
        <p class="hjalp">Tryck på en ruta för att ändra den. X = fullträff (${fmt(ft)}), ger stjärna.</p>`;
      $('knappsats').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.v === 'bort') {
          let i = st.vals[st.cursor] !== null ? st.cursor : st.cursor - 1;
          if (i < 0) i = 0;
          st.vals[i] = null; st.cursor = i;
        } else {
          st.vals[st.cursor] = Number(b.dataset.v);
          const nasta = st.vals.findIndex((v, i) => v === null && i > st.cursor);
          st.cursor = nasta >= 0 ? nasta : Math.min(st.cursor + 1, n - 1);
        }
        ritaSkottrad(); ritaSumma();
      });
      ritaSkottrad();
    }
    ritaSumma();
  }

  function ritaSkottrad() {
    const gr = st.gren;
    $('skottrad').innerHTML = st.vals.map((v, i) => `
      <button type="button" data-i="${i}" class="skottruta${i === st.cursor ? ' aktiv' : ''}${stjarna(v, gr) ? ' stjarna' : ''}" aria-label="Skott ${i + 1}">
        <small>${i + 1}</small>${v === null ? '' : (v === Number(gr.fulltraff) ? 'X' : v)}</button>`).join('');
    $('skottrad').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { st.cursor = Number(b.dataset.i); ritaSkottrad(); }));
  }

  function ritaSumma() {
    const gr = st.gren;
    if (st.satt === 'total') {
      const v = tolkaTotal(st.total, gr);
      $('summa').innerHTML = Number.isNaN(v) ? `<span class="ogiltig-text">Poängen ska vara 0–${fmt(gr.antal_skott * maxSkott(gr))}</span>`
        : v === null ? '<span class="muted">Fyll i poäng</span>'
          : `<b>${fmt(v)}</b> poäng · <span class="stj">★ ${st.stjarnor}</span>${guldText(v)}`;
      return;
    }
    const ifyllda = st.vals.filter((v) => v !== null);
    const s = summa(ifyllda), stj = ifyllda.filter((v) => stjarna(v, gr)).length;
    $('summa').innerHTML = `<b>${fmt(s, gr.decimaler || ifyllda.some((v) => v !== Math.trunc(v)) ? 1 : 0)}</b> poäng · <span class="stj">★ ${stj}</span>
      <span class="muted">· ${ifyllda.length} av ${gr.antal_skott} skott</span>${ifyllda.length === gr.antal_skott ? guldText(s) : ''}${jamforText(ifyllda, s, stj)}`;
  }

  // Jämförelse mot den tidigare inmatade totalen när en serie kompletteras med skott
  function jamforText(ifyllda, s, stj) {
    if (!st.jamfor || !ifyllda.length) return '';
    const gr = st.gren;
    if (ifyllda.length < gr.antal_skott) {
      return `<div class="jamfor muted">Inmatat tidigare: ${fmt(st.jamfor.poang)} ★ ${st.jamfor.stjarnor ?? '–'} · kvar ${fmt(st.jamfor.poang - s)} på ${gr.antal_skott - ifyllda.length} skott</div>`;
    }
    const diff = Math.round((s - st.jamfor.poang) * 10) / 10, stjOk = st.jamfor.stjarnor === null || st.jamfor.stjarnor === stj;
    if (!diff && stjOk) return '<div class="jamfor ok">✓ Stämmer med den inmatade totalen</div>';
    return `<div class="jamfor avviker">Stämmer inte med inmatat: ${fmt(st.jamfor.poang)} ★ ${st.jamfor.stjarnor ?? '–'}
      (${diff ? `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))} poäng` : 'poängen stämmer'}${stjOk ? '' : `, ${stj - st.jamfor.stjarnor > 0 ? '+' : '−'}${Math.abs(stj - st.jamfor.stjarnor)} ★`}). Kontrollera skotten.</div>`;
  }

  function guldText(v) {
    const niv = g.guld.filter((x) => x.gren_id === st.gren.id && v >= Number(x.grans)).sort((x, y) => Number(y.grans) - Number(x.grans));
    return niv.length ? ` · <span class="guld">${esc(niv[0].namn)}</span>` : '';
  }

  // ---------- dagens serier ----------
  let dag = [];
  async function laddaDag() {
    if (!st.datum) return;
    [dag] = await Promise.all([
      api(`v_serie?select=id,nr,skytt_id,skytt,poang,stjarnor,inmatning,skott,ofullstandig&gren_id=eq.${st.gren.id}&datum=eq.${st.datum}&order=skytt_id,nr`),
      laddaKommentar(),
    ]);
    if (!st.nrAndrat && st.skytt) {
      const egna = dag.filter((s) => s.skytt_id === st.skytt.id).map((s) => s.nr);
      st.nr = egna.length ? Math.max(...egna) + 1 : 1;
      $('nr').textContent = st.nr;
    }
    ritaDag();
  }

  function ritaDag() {
    if (!dag.length) { $('dagens').innerHTML = `<h2>${esc(st.gren.namn)} ${esc(st.datum)}</h2><p class="muted">Inga serier än.</p>`; return; }
    const perSkytt = new Map();
    dag.forEach((s) => { if (!perSkytt.has(s.skytt)) perSkytt.set(s.skytt, []); perSkytt.get(s.skytt).push(s); });
    $('dagens').innerHTML = `<h2>${esc(st.gren.namn)} ${esc(st.datum)}</h2>` + [...perSkytt].map(([namn, ss]) => {
      const snitt = ss.reduce((a, s) => a + Number(s.poang), 0) / ss.length;
      return `<div class="card dagkort${ss[0].skytt_id === st.skytt?.id ? ' egen' : ''}">
        <div class="dagrubrik"><b>${esc(namn)}</b><span class="muted">${ss.length} serier · snitt ${fmt(snitt, 2)}</span></div>
        <ul class="serielista">${ss.map((s) => `<li class="${st.redigera?.id === s.id ? 'redigeras' : ''}${st.skytt?.id === s.skytt_id && s.nr === st.nr && !st.redigera ? ' krock' : ''}">
          <a href="#/serie/${s.id}"><span class="nr">${s.nr}</span><b>${fmt(s.poang)}</b><span class="stj">★ ${s.stjarnor ?? '–'}</span>
          <span class="muted liten">${s.inmatning === 'skott' ? (s.ofullstandig ? 'ofullständig' : 'skott') : 'total'}</span></a></li>`).join('')}</ul></div>`;
    }).join('');
  }

  // ---------- kommentar ----------
  async function laddaKommentar() {
    if (!st.skytt) { $('kommentar').value = ''; return; }
    const [k] = await api(`kommentar?select=text&skytt_id=eq.${st.skytt.id}&datum=eq.${st.datum}`);
    st.kommentar = st.kommentarOrig = k?.text ?? '';
    $('kommentar').value = st.kommentar;
    if (st.kommentar) $('kommentarbox').open = true;
  }
  $('kommentar').addEventListener('input', (e) => { st.kommentar = e.target.value; });
  async function sparaKommentar() {
    if (!st.skytt || st.kommentar.trim() === st.kommentarOrig.trim()) return false;
    const filter = `skytt_id=eq.${st.skytt.id}&datum=eq.${st.datum}`;
    if (!st.kommentar.trim()) await write('DELETE', `kommentar?${filter}`, undefined, 'return=minimal');
    else await write('POST', 'kommentar', { skytt_id: st.skytt.id, datum: st.datum, text: st.kommentar.trim() }, 'resolution=merge-duplicates,return=minimal');
    st.kommentarOrig = st.kommentar.trim();
    return true;
  }
  $('sparakommentar').addEventListener('click', async () => {
    if (!st.skytt) return meddela('Välj skytt först.', true);
    try { meddela(await sparaKommentar() ? 'Kommentaren sparad.' : 'Ingen ändring.'); } catch (e) { meddela(e.message, true); }
  });

  // ---------- spara ----------
  function meddela(t, fel = false) { const m = $('msg'); m.textContent = t; m.classList.toggle('fel', fel); m.classList.remove('nyttrekord'); }

  $('spara').addEventListener('click', async () => {
    const gr = st.gren, n = gr.antal_skott;
    if (!st.skytt) return meddela('Välj skytt.', true);
    if (!st.datum) return meddela('Välj datum.', true);
    let rad, skott = [];
    if (st.satt === 'total') {
      const v = tolkaTotal(st.total, gr);
      if (v === null || Number.isNaN(v)) return meddela(`Fyll i poängen (0–${fmt(n * maxSkott(gr))}).`, true);
      if (st.stjarnor > n) return meddela(`Högst ${n} stjärnor.`, true);
      rad = { total: v, stjarnor: st.stjarnor };
    } else {
      const ifyllda = st.vals.filter((v) => v !== null).length;
      if (!ifyllda) return meddela('Fyll i skotten.', true);
      if (app.querySelector('.skottrutnat .ogiltig')) return meddela('Något skott är felskrivet (röd ruta).', true);
      if (ifyllda < n && !confirm(`Bara ${ifyllda} av ${n} skott ifyllda. Spara ändå?`)) return;
      if (st.jamfor && ifyllda === n) {
        const sum = summa(st.vals), stj = st.vals.filter((v) => stjarna(v, gr)).length;
        const avviker = Math.abs(sum - st.jamfor.poang) > 0.05 || (st.jamfor.stjarnor !== null && st.jamfor.stjarnor !== stj);
        if (avviker && !confirm(`Skotten ger ${fmt(sum)} ★ ${stj}, men inmatat var ${fmt(st.jamfor.poang)} ★ ${st.jamfor.stjarnor ?? '–'}. Spara skotten ändå?`)) return;
      }
      skott = st.vals.map((v, i) => ({ nr: i + 1, varde: v })).filter((x) => x.varde !== null);
      rad = { total: null, stjarnor: null };
    }
    rad = { ...rad, skytt_id: st.skytt.id, gren_id: gr.id, datum: st.datum, nr: st.nr };
    const knapp = $('spara'); knapp.disabled = true; meddela('Sparar …');
    try {
      let id;
      if (st.redigera) {
        id = st.redigera.id;
        await write('PATCH', `serie?id=eq.${id}`, rad, 'return=minimal');
        await write('DELETE', `skott?serie_id=eq.${id}`, undefined, 'return=minimal');
      } else {
        [{ id }] = await write('POST', 'serie', rad);
      }
      if (skott.length) {
        try { await write('POST', 'skott', skott.map((x) => ({ ...x, serie_id: id })), 'return=minimal'); } catch (e) {
          if (!st.redigera) await write('DELETE', `serie?id=eq.${id}`, undefined, 'return=minimal').catch(() => {});
          throw e;
        }
      }
      await sparaKommentar().catch(() => {});
      if (st.redigera && st.jamfor && st.satt === 'skott') { await tillNasta(); return; }
      if (st.redigera) { location.hash = '#/serier'; return; }
      const poang = st.satt === 'total' ? rad.total : summa(skott.map((x) => x.varde));
      const stj = st.satt === 'total' ? rad.stjarnor : skott.filter((x) => stjarna(x.varde, gr)).length;
      const rekord = await rekordText(id, poang).catch(() => '');
      meddela(`${st.skytt.namn}, serie ${st.nr} sparad: ${fmt(poang, gr.decimaler || poang % 1 ? 1 : 0)} ★ ${stj}${rekord}`);
      if (rekord) $('msg').classList.add('nyttrekord'); else $('msg').classList.remove('nyttrekord');
      nollstallSkott(st); st.total = ''; st.stjarnor = 0; st.nrAndrat = false;
      ritaInmatning(); await laddaDag();
      fokusera();
    } catch (e) {
      meddela(e.code === '23505' ? `${st.skytt.namn} har redan en serie ${st.nr} den dagen – byt serienummer.` : e.message, true);
    } finally { knapp.disabled = false; }
  });

  if (st.redigera) {
    $('tabort').addEventListener('click', async () => {
      if (!confirm(`Ta bort serie ${st.redigera.nr} för ${st.skytt.namn} ${st.datum}?`)) return;
      try { await write('DELETE', `serie?id=eq.${st.redigera.id}`, undefined, 'return=minimal'); location.hash = '#/serier'; } catch (e) { meddela(e.message, true); }
    });
  }

  // Nästa serie utan skott för samma skytt: samma dag högre serienummer, annars äldre dagar
  async function tillNasta() {
    const r = st.redigera;
    const kvar = await api(`v_serie?select=id,datum,nr,gren_id&inmatning=eq.total&skytt_id=eq.${r.skytt_id}&order=datum.desc,gren_id,nr`);
    const nasta = kvar.find((x) => x.datum < r.datum || (x.datum === r.datum && (x.gren_id > r.gren_id || (x.gren_id === r.gren_id && x.nr > r.nr))))
      ?? kvar[0];
    const klar = `${st.skytt.namn} ${r.datum} serie ${r.nr} kompletterad med skott.`;
    if (!nasta) { flash = `${klar} ${st.skytt.namn} har inga fler serier utan skott.`; location.hash = '#/serier'; return; }
    flash = `${klar} Nästa: ${nasta.datum} serie ${nasta.nr} (${kvar.length} kvar för ${st.skytt.namn}).`;
    location.hash = `#/serie/${nasta.id}/skott`;
  }

  // F-31: nytt personbästa (serie, och dagsmedel när minst två serier skjutits idag)
  async function rekordText(id, poang) {
    const tidigare = await api(`v_serie?select=id,datum,poang&skytt_id=eq.${st.skytt.id}&gren_id=eq.${st.gren.id}`);
    const andra = tidigare.filter((s) => s.id !== id);
    if (!andra.length) return '';
    const delar = [];
    const maxSerie = Math.max(...andra.map((s) => Number(s.poang)));
    if (poang > maxSerie) delar.push(`nytt personbästa för en serie (förra ${fmt(maxSerie, st.gren.decimaler ? 1 : 0)})`);
    const idag = tidigare.filter((s) => s.datum === st.datum).map((s) => Number(s.poang));
    const forr = andra.filter((s) => s.datum !== st.datum);
    if (idag.length >= 2 && forr.length) {
      const perDag = new Map(); forr.forEach((s) => { if (!perDag.has(s.datum)) perDag.set(s.datum, []); perDag.get(s.datum).push(Number(s.poang)); });
      const bastaDag = Math.max(...[...perDag.values()].map((p) => p.reduce((a, v) => a + v, 0) / p.length));
      const dagsSnitt = idag.reduce((a, v) => a + v, 0) / idag.length;
      if (dagsSnitt > bastaDag) delar.push(`dagsmedlet ${fmt(dagsSnitt, 2)} slår bästa dagen (${fmt(bastaDag, 2)})`);
    }
    return delar.length ? ` – ★ Grattis! ${delar.join(' och ')}!` : '';
  }

  function fokusera() {
    if (st.satt === 'total') $('total')?.focus();
    else { const tom = [...app.querySelectorAll('.skottrutnat input')].find((i) => !i.value); tom?.focus(); }
  }

  ritaVal(); ritaInmatning(); await laddaDag();
  flash = '';
  if (lage === 'skott') fokusera();
}

export const tomFlash = () => { const f = flash; flash = ''; return f; };

function nollstallSkott(st) {
  const n = st.gren.antal_skott;
  const gamla = st.vals ?? [];
  st.vals = Array.from({ length: n }, (_, i) => (st.redigera && st.redigera.gren_id === st.gren.id ? (gamla[i] ?? null) : null));
  if (!st.redigera || st.redigera.gren_id !== st.gren.id) st.vals = Array(n).fill(null);
  st.cursor = Math.max(0, st.vals.findIndex((v) => v === null));
  if (st.vals.every((v) => v !== null)) st.cursor = 0;
}
