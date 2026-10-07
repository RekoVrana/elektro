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

  firebase.initializeApp(CFG.firebase);
  const auth = firebase.auth(), db = firebase.firestore();
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

    for (const src of ['lib/pdf-lib.min.js', 'lib/fontkit.umd.min.js', 'app.core.js?v=1']) {
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
      const chce = new URLSearchParams(location.search).get('z');
      const rovnou = chce && moje.find(z => z.jobId === chce);
      if (rovnou) spustEditor(rovnou, me).catch(e => chyba('jobsErr', String(e.message || e)));
    } catch (e) { box.innerHTML = ''; chyba('jobsErr', String(e.message || e)); }
  }

  /* ---------- přihlášení ---------- */
  el('loginForm').onsubmit = async ev => {
    ev.preventDefault(); chyba('loginErr', '');
    const b = el('loginBtn'); b.disabled = true; b.textContent = 'Přihlašuji…';
    try { await auth.signInWithEmailAndPassword(el('mail').value.trim(), el('pass').value); }
    catch (e) {
      const kod = (e && e.code) || '';
      chyba('loginErr', kod === 'auth/invalid-credential' || kod === 'auth/wrong-password' || kod === 'auth/user-not-found'
        ? 'Nesprávný e-mail nebo heslo.' : kod === 'auth/too-many-requests'
        ? 'Příliš mnoho pokusů. Zkus to za chvíli.' : /referer/.test(kod)
        ? 'Přihlášení z této adresy není povoleno — klíč Firebase má omezení na weby (Google Cloud → Credentials → Website restrictions musí obsahovat i rekovrana.github.io/elektro).' : 'Přihlášení se nepodařilo: ' + (kod || e));
    } finally { b.disabled = false; b.textContent = 'Přihlásit'; el('pass').value = ''; }
  };
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
