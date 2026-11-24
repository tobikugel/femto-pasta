# femto-pasta 🍝

Tracks the weekly pasta Wednesday of the research group: who had how many servings, plus statistics of
questionable scientific value (Gini coefficient of pasta, Shannon entropy, bus factor, a Gaussian fit of
servings per visit, and the group's pasta converted to 800 nm photons, Ti:Sa runtime and spaghetti light-time).

- **Nuxt 4**, the same setup as `3d-vmi`: the pages are static files (`ssr: false`), the server API in
  `server/` becomes a **Netlify** function.
- **Access**: the shared password (`NUXT_PASTA_PASSWORD`, default `pasta-pesto` when the variable is not set), or the QR code from the page
  `/qr`, which links to `/login?key=<password>` and logs in at once. A login lasts 180 days. Changing the
  password logs everybody out and makes old printed QR codes useless.
- **Data**: one JSON file, `pasta.json`, in a **private Hugging Face dataset repository**. The server reads it
  with a token and writes it with a commit through the Hub's API, so every submission is a commit and the
  repository history is a complete audit log (and a backup: any old version can be restored on the Hub).
  When two people submit at the same moment, the second commit is refused by the Hub (it names the commit it
  builds on) and retried on top of the first, so nothing gets lost.
- **Credits** (page `/credits`): every serving costs the price of its day (default 2 €, changeable from a
  date on, older pasta keeps its old price). Payments into the fund raise a member's credit, payouts
  (e.g. money back for buying the groceries) lower it. The page shows the balance of everybody, the
  fund, outstanding debt, how many Wednesdays each credit lasts ("runway"), and the ledger of payments.
  Anyone with the password can log a payment or remove one; the Hugging Face history keeps everything.
- **Logging pasta** (start page `/`): tap your name, tap the number of servings (1, 2, 3, ½ or more), done.
  The day is today on a Wednesday, else the last Wednesday ("change" picks an earlier one). The browser
  remembers your name, so next time it is one tap. Tapping again for the same day overwrites, "remove it"
  deletes. The statistics are on `/dashboard`, the money on `/credits`.
- `server/utils/store.ts`: reading/committing `pasta.json` on Hugging Face (with the conflict retry), or the local file
- `server/utils/auth.ts`, `server/api/login.post.ts`: the shared password and the session
- `server/api/payments/`, `server/api/price.post.ts`: payments (add, remove) and the price per serving
- `app/lib/credits.ts`, `app/pages/credits.vue`: balances and the credits page
- `server/api/servings.post.ts`: one submission (validation: Wednesday, not in the future, 0–20 servings in ¼ steps)
- `shared/utils/pasta.ts`: date helpers, upsert/normalise of the log (used by pages and server)
- `app/lib/stats.ts`: all statistics and the physics corner (assumptions in `PHYSICS`), tested in `tests/`
- `app/components/`: the hand-made SVG charts, leaderboard, badges, submit panel
- `scripts/import-excel.mjs`: the Excel importer
