/* ====== Zavaděč: přihlášení → výběr zakázky → spuštění editoru ======
   Editor samotný (app.core.js) je společný pro všechny zakázky; data zakázky
   (geometrie, podklady stran, report) se stahují až po výběru. Výkres se ukládá
   do Firestore (elektro_zakazky/{jobId}/stav/aktualni), přihlášení a role jsou
   společné s Deníkem staveb (users_auth/{uid}). */
(() => {
  const CFG = window.VRANA_ELEKTRO_CONFIG;
  const el = id => document.getElementById(id);
  const ukaz = (id, ano) => { const n = el(id); if (n) n.hidden = !ano; };
  const chyba = (id, text) => { const n = el(id); if (!n) return; n.textContent = text || ''; n.hidden = !text; };
  const dev = location.hostname === 'localhost' && new URLSearchParams(location.search).get('dev') === '1';

  // Vlastní pojmenovaná instance: Elektro a Deník sdílejí adresu rekovrana.github.io, a bez toho
  // by měly i společné přihlášení — odhlášení z Elektra by odhlásilo Deník na stejném zařízení.
  const app = firebase.initializeApp(CFG.firebase, 'elektro');
  const auth = firebase.auth(app), db = firebase.firestore(app);
  window.VRANA_DB = db;

  /* ---------- seznam zakázek: statický rejstřík vedle aplikace ---------- */
  async function seznamZakazek() {
    const r = await fetch('zakazky/index.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('rejstřík zakázek se nepodařilo načíst (' + r.status + ')');
    const j = await r.json();
    return Array.isArray(j.zakazky) ? j.zakazky : [];
  }

  /* ---------- kdo je přihlášený a co smí ---------- */
  async function kdoJsem(u) {
    const d = await db.collection('users_auth').doc(u.uid).get();
    const role = d.exists ? (d.data().role || 'sub') : 'sub';
    const zakazky = d.exists && Array.isArray(d.data().elektro) ? d.data().elektro : [];
    return { uid: u.uid, mail: u.email, role, zakazky };
  }
  // přístup jen výslovně: users_auth/{uid}.elektro = ["*"] (vše) nebo seznam jobId; role z Deníku sama nestačí
  const smiNaZakazku = (me, jobId) => me.zakazky.includes('*') || me.zakazky.includes(jobId);

  /* ---------- spuštění editoru nad vybranou zakázkou ---------- */
  async function spustEditor(job, me) {
    const zaklad = 'zakazky/' + job.jobId + '/';
    const r = await fetch(zaklad + 'project.json', { cache: 'force-cache' });
    if (!r.ok) throw new Error('data zakázky se nepodařilo načíst (' + r.status + ')');
    const project = await r.json();

    const pages = {};
    for (const pg of project.pages) pages[pg.img] = zaklad + pg.img;

    window.PROJECT = project;
    window.PAGES = pages;
    window.PROJECT_SLUG = job.jobId;
    window.INITIAL = null;
    window.SHARED_SAVE = !dev;
    window.PDF_URL = zaklad + 'report.pdf';
    window.FONT_URL = 'font/DejaVuSans.ttf';
    window.ELEKTRO_ME = me;

    const telo = await (await fetch('app.body.html', { cache: 'force-cache' })).text();
    const root = el('appRoot'); root.innerHTML = telo; root.hidden = false;
    ukaz('gateLogin', false); ukaz('gateJobs', false);
    document.title = 'Elektro · ' + (project.title || job.title || job.jobId);

    for (const src of ['lib/pdf-lib.min.js', 'lib/fontkit.umd.min.js', 'app.core.js?v=3']) {
      await new Promise((hotovo, selhalo) => {
        const s = document.createElement('script');
        s.src = src; s.onload = hotovo; s.onerror = () => selhalo(new Error('nenačetlo se ' + src));
        document.body.appendChild(s);
      });
    }
    if (dev) console.info('zkušební režim: bez přihlášení, ukládá se jen v prohlížeči');
  }

  /* ---------- obrazovka s výběrem zakázky ---------- */
  async function ukazZakazky(me) {
    ukaz('gateLogin', false); ukaz('gateJobs', true);
    el('jobsWho').textContent = me.mail + ' · ' + ({ admin: 'správce', worker: 'parta', sub: 'subdodavatel' }[me.role] || me.role);
    const box = el('jobsList'); box.innerHTML = '<div class="unit">načítám…</div>';
    try {
      const vse = await seznamZakazek();
      const moje = vse.filter(z => smiNaZakazku(me, z.jobId));
      if (!moje.length) { box.innerHTML = ''; chyba('jobsErr', 'Tento účet nemá přístup k žádné elektro zakázce. Přístup přiděluje ' + CFG.firmContact + '.'); return; }
      box.innerHTML = '';
      for (const z of moje) {
        const b = document.createElement('button');
        b.innerHTML = '<b></b><span></span>';
        b.querySelector('b').textContent = z.title || z.jobId;
        b.querySelector('span').textContent = [z.address, z.rooms ? z.rooms + ' místností' : null, z.walls ? z.walls + ' stěn' : null].filter(Boolean).join(' · ');
        b.onclick = () => {
          b.disabled = true; b.querySelector('span').textContent = 'otevírám…';
          const url = new URL(location.href); url.searchParams.set('z', z.jobId); history.replaceState(null, '', url);
          spustEditor(z, me).catch(e => { chyba('jobsErr', String(e.message || e)); b.disabled = false; });
        };
        box.appendChild(b);
      }
      if (me.zakazky.includes('*')) ukazPristupy(vse).catch(e => chyba('pristupyErr', String(e.message || e)));
      const chce = new URLSearchParams(location.search).get('z');
      const rovnou = chce && moje.find(z => z.jobId === chce);
      if (rovnou) spustEditor(rovnou, me).catch(e => chyba('jobsErr', String(e.message || e)));
    } catch (e) { box.innerHTML = ''; chyba('jobsErr', String(e.message || e)); }
  }

  /* ---------- správa přístupů (jen kdo má elektro: ["*"]) ---------- */
  async function ukazPristupy(zakazky) {
    ukaz('pristupy', true); chyba('pristupyErr', '');
    const roster = (await db.collection('roster').get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.role !== 'admin')
      .sort((a, b) => (a.prijmeni || '').localeCompare(b.prijmeni || '', 'cs'));
    const jmeno = r => [r.jmeno, r.prijmeni].filter(Boolean).join(' ') || r.name || r.id;
    // účty k lidem: users_auth.userDocId odkazuje na záznam osoby
    const ucty = {};
    for (let i = 0; i < roster.length; i += 30) {
      const q = await db.collection('users_auth').where('userDocId', 'in', roster.slice(i, i + 30).map(r => r.id)).get();
      q.docs.forEach(d => { ucty[d.data().userDocId] = { ref: d.ref, elektro: Array.isArray(d.data().elektro) ? d.data().elektro : [] }; });
    }
    const m = el('matice'); m.innerHTML = ''; m.style.gridTemplateColumns = 'minmax(120px,1fr) repeat(' + zakazky.length + ', 28px)';
    m.appendChild(document.createElement('div'));
    for (const z of zakazky) { const h = document.createElement('div'); h.className = 'hl'; h.textContent = z.title || z.jobId; h.title = z.jobId; m.appendChild(h); }
    for (const r of roster) {
      const n = document.createElement('div'); n.className = 'jm'; n.textContent = jmeno(r); m.appendChild(n);
      const u = ucty[r.id];
      for (const z of zakazky) {
        const cell = document.createElement('div');
        if (!u) { cell.className = 'bez'; cell.textContent = '–'; cell.title = 'nemá účet v Deníku'; }
        else {
          const c = document.createElement('input'); c.type = 'checkbox'; c.checked = u.elektro.includes(z.jobId) || u.elektro.includes('*');
          c.disabled = u.elektro.includes('*'); c.title = jmeno(r) + ' → ' + (z.title || z.jobId);
          c.onchange = async () => {
            c.disabled = true; chyba('pristupyErr', '');
            try {
              const FV = firebase.firestore.FieldValue;
              await u.ref.update({ elektro: c.checked ? FV.arrayUnion(z.jobId) : FV.arrayRemove(z.jobId) });
              u.elektro = c.checked ? [...new Set([...u.elektro, z.jobId])] : u.elektro.filter(x => x !== z.jobId);
            } catch (e) { c.checked = !c.checked; chyba('pristupyErr', 'Zápis se nepodařil: ' + ((e && e.code) || e)); }
            finally { c.disabled = false; }
          };
          cell.appendChild(c);
        }
        m.appendChild(cell);
      }
    }
    if (!roster.length) m.innerHTML = '<div class="unit">V Deníku nejsou žádní lidé.</div>';
  }

  /* ---------- přihlášení: stejně jako Deník ---------- */
  const chybaText = e => {
    const kod = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(kod)) return 'Nesedí heslo/PIN — nebo účet ještě není dokončený. Ať ti vedení zkusí PIN nastavit znovu.';
    if (kod === 'auth/too-many-requests') return 'Moc pokusů po sobě. Zkus to za pár minut.';
    if (/referer/.test(kod)) return 'Přihlášení z této adresy není povoleno (omezení klíče Firebase na weby).';
    return 'Přihlášení se nepodařilo: ' + (kod || e);
  };
  const rezim = m => { el('modeTeren').classList.toggle('on', m === 'teren'); el('modeKanc').classList.toggle('on', m === 'kanc');
    ukaz('loginTeren', m === 'teren'); ukaz('loginForm', m === 'kanc'); chyba('loginErr', ''); chyba('loginOk', '');
    try { localStorage.setItem('elektro:loginMode', m); } catch {} };
  el('modeTeren').onclick = () => rezim('teren'); el('modeKanc').onclick = () => rezim('kanc');

  // seznam lidí z veřejného rosteru Deníku (bez vedení), zapamatovaná volba
  let roster = [], vybrany = null;
  const celeJmeno = r => [r.jmeno, r.prijmeni].filter(Boolean).join(' ') || r.name || r.id;
  async function nactiRoster() {
    try { const s = await db.collection('roster').get();
      roster = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.role !== 'admin').sort((x, y) => (x.prijmeni || '').localeCompare(y.prijmeni || '', 'cs')); }
    catch (e) { chyba('loginErr', 'Seznam lidí se nepodařilo načíst: ' + ((e && e.code) || e)); }
    vykresliLidi();
  }
  function vykresliLidi() {
    const q = el('hledat').value.trim().toLowerCase(); const box = el('lidi'); box.innerHTML = '';
    let posledni = null; try { posledni = localStorage.getItem('elektro:posledniClovek'); } catch {}
    const seznam = roster.filter(r => !q ? r.id === posledni : celeJmeno(r).toLowerCase().includes(q)).slice(0, 12);
    if (!seznam.length) { box.innerHTML = '<div class="unit">' + (q ? 'Nikdo takový tu není.' : 'Začni psát své jméno.') + '</div>'; return; }
    for (const r of seznam) { const b = document.createElement('button'); b.type = 'button'; b.textContent = celeJmeno(r);
      b.onclick = () => { vybrany = r; el('vybranyJmeno').textContent = celeJmeno(r); ukaz('terenVyber', false); ukaz('pinForm', true); el('pin').focus(); };
      box.appendChild(b); }
  }
  el('hledat').oninput = vykresliLidi;
  el('zmenit').onclick = () => { vybrany = null; ukaz('pinForm', false); ukaz('terenVyber', true); el('pin').value = ''; };
  el('pinForm').onsubmit = async ev => {
    ev.preventDefault(); chyba('loginErr', ''); const pin = el('pin').value.trim();
    if (!vybrany) return; if (pin.length < 6) { chyba('loginErr', 'PIN má aspoň 6 znaků.'); return; }
    if (!vybrany.authEmail) { chyba('loginErr', 'Účet nemá přihlašovací adresu — ať ti vedení vytvoří přihlášení znovu.'); return; }
    const b = el('pinBtn'); b.disabled = true; b.textContent = 'Přihlašuji…';
    try { await auth.signInWithEmailAndPassword(vybrany.authEmail, pin); try { localStorage.setItem('elektro:posledniClovek', vybrany.id); } catch {} }
    catch (e) { chyba('loginErr', chybaText(e)); }
    finally { b.disabled = false; b.textContent = 'Přihlásit'; el('pin').value = ''; }
  };
  el('loginForm').onsubmit = async ev => {
    ev.preventDefault(); chyba('loginErr', ''); chyba('loginOk', '');
    const b = el('loginBtn'); b.disabled = true; b.textContent = 'Přihlašuji…';
    try { await auth.signInWithEmailAndPassword(el('mail').value.trim(), el('pass').value); }
    catch (e) { chyba('loginErr', chybaText(e)); }
    finally { b.disabled = false; b.textContent = 'Přihlásit'; el('pass').value = ''; }
  };
  el('zapomenute').onclick = async () => {
    const m = el('mail').value.trim(); chyba('loginErr', ''); chyba('loginOk', '');
    if (!m) { chyba('loginErr', 'Napiš nahoru svůj e-mail a pak klikni na Zapomenuté heslo.'); return; }
    try { await auth.sendPasswordResetEmail(m); chyba('loginOk', 'Poslal jsem odkaz na nastavení nového hesla na ' + m + '.'); }
    catch (e) { chyba('loginErr', chybaText(e)); }
  };
  let ulozenyRezim = 'teren'; try { ulozenyRezim = localStorage.getItem('elektro:loginMode') || 'teren'; } catch {}
  rezim(ulozenyRezim); nactiRoster();

  el('logoutBtn').onclick = () => auth.signOut().then(() => location.reload());

  if (dev) {   // místní zkoušení bez přihlášení; ukládá se jen v prohlížeči
    ukazZakazky({ uid: 'dev', mail: 'zkušební režim', role: 'admin', zakazky: ['*'] });
  } else {
    auth.onAuthStateChanged(async u => {
      if (!u) { ukaz('gateLogin', true); ukaz('gateJobs', false); return; }
      try { ukazZakazky(await kdoJsem(u)); }
      catch (e) { ukaz('gateJobs', true); chyba('jobsErr', 'Nepodařilo se načíst oprávnění: ' + ((e && e.message) || e)); }
    });
  }
})();
