# Elektro editor — nasazení (rekovrana.github.io/elektro)

## Co je v této složce
- `index.html`, `boot.js`, `config.js` — přihlášení (Firebase Auth projektu vrana-denik) a výběr zakázky
- `app.core.js`, `app.css`, `app.body.html` — editor (verze 3.1.0-vrana)
- `lib/` pdf-lib + fontkit, `font/` DejaVu Sans — pro export PDF
- `zakazky/<jobId>/` — podklady zakázky (project.json, pages/*.png, report.pdf); `zakazky/index.json` = rejstřík
- `firestore.rules.elektro.txt` — blok pravidel pro Firestore (vložit k pravidlům Deníku)

## Nová zakázka
    cd ../elektro-editor-projekt
    .venv/bin/python extract.py "Report.pdf" <jobId>
    .venv/bin/python publish_web.py <jobId> "Report.pdf" --title "Klient, ulice"
    git add -A && git commit -m "zakázka <jobId>" && git push

## Přístup pro subdodavatele (Firebase konzole → Firestore → users_auth → dokument uživatele)
Přidat pole  `elektro` (array of string): `["*"]` = všechny zakázky, nebo seznam jobId, např. `["belcicka"]`.
Kdo pole nemá, do Elektra se nedostane — role z Deníku sama přístup nedává.

## Poznámka k soukromí
Podklady (půdorysy, report) leží jako statické soubory na GitHub Pages — kdo zná adresu,
může si je stáhnout i bez přihlášení. Samotný výkres (prvky, revize) je ve Firestore za přihlášením.
Pokud mají být i podklady za heslem, je potřeba je přesunout do Firebase Storage (další krok).
