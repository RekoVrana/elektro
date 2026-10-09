# Elektro editor — nasazení (rekovrana.github.io/elektro)

## Co je v této složce
- `index.html`, `boot.js`, `config.js` — přihlášení (Firebase Auth projektu vrana-denik) a výběr zakázky
- `app.core.js`, `app.css`, `app.body.html` — editor (verze 4.0.0-vrana); sestavuje `../elektro-editor-projekt/build_web_v4.py` ze šablony `editor.v4.template.html` (písma a logo jsou vložené v app.core.js)
- `navod.html` — návod k použití (odkaz je v Nápovědě editoru); sestavuje `scratchpad/navod_v4.py` → kopie i v `elektro-editor-projekt/navod.html`
- `lib/` pdf-lib + fontkit, `font/` DejaVu Sans — pro export PDF
- `zakazky/<jobId>/` — podklady zakázky (project.json, pages/*.png, report.pdf); `zakazky/index.json` = rejstřík
- `firestore.rules.elektro.txt` — blok pravidel pro Firestore (vložit k pravidlům Deníku)

## Nová verze editoru
    cd ../elektro-editor-projekt
    .venv/bin/python build_web_v4.py            # → web/app.core.js, app.css, app.body.html, lib/
    # v index.html a boot.js zvednout ?v=N (app.css, config.js, boot.js, app.core.js, app.body.html), ať prohlížeče načtou novou verzi
    git add -A && git commit -m "editor v4.x" && git push

## Nová zakázka
    cd ../elektro-editor-projekt
    .venv/bin/python extract.py "Report.pdf" <jobId>
    .venv/bin/python publish_web.py <jobId> "Report.pdf" --title "Klient, ulice"
    git add -A && git commit -m "zakázka <jobId>" && git push

Po opravě extrakce (např. obložka dveří) stačí znovu spustit extract.py + publish_web.py – otisk geometrie (geomFp) se nemění, uložené výkresy zůstávají platné.

## Přístup pro subdodavatele (Firebase konzole → Firestore → users_auth → dokument uživatele)
Přidat pole  `elektro` (array of string): `["*"]` = všechny zakázky, nebo seznam jobId, např. `["belcicka"]`.
Kdo pole nemá, do Elektra se nedostane — role z Deníku sama přístup nedává.

## Poznámka k soukromí
Podklady (půdorysy, report) leží jako statické soubory na GitHub Pages — kdo zná adresu,
může si je stáhnout i bez přihlášení. Samotný výkres (prvky, revize) je ve Firestore za přihlášením.
Pokud mají být i podklady za heslem, je potřeba je přesunout do Firebase Storage (další krok).
