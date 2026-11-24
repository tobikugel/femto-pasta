# femto-pasta 🍝

Tracks the weekly pasta Wednesday of the research group: who had how many servings, plus statistics of
questionable scientific value (Gini coefficient of pasta, Shannon entropy, bus factor, a Gaussian fit of
servings per visit, and the group's pasta converted to 800 nm photons, Ti:Sa runtime and spaghetti light-time).

- **Nuxt 4**, the same setup as `3d-vmi`: the pages are static files (`ssr: false`), the server API in
  `server/` becomes a **Netlify** function.
- **Access**: the shared password (`NUXT_PASTA_PASSWORD`, e.g. `pasta-pesto`), or the QR code from the page
  `/qr`, which links to `/login?key=<password>` and logs in at once. A login lasts 180 days. Changing the
  password logs everybody out and makes old printed QR codes useless.
- **Data**: one JSON file, `pasta.json`, in a **private Hugging Face dataset repository**. The server reads it
  with a token and writes it with a commit through the Hub's API, so every submission is a commit and the
  repository history is a complete audit log (and a backup: any old version can be restored on the Hub).
  When two people submit at the same moment, the second commit is refused by the Hub (it names the commit it
  builds on) and retried on top of the first, so nothing gets lost.
- **Submitting**: pick the pasta Wednesday (today or the last one by default, up to half a year back), yourself
  (or "+ new eater…"), and the servings (in ½ steps). Submitting again for the same day overwrites,
  "git revert" removes the entry. The browser remembers your name.

## Set up the Hugging Face repository

1. **Create the repository.** On <https://huggingface.co/new-dataset>: owner = your account (or the group's
   organisation), name e.g. `femto-pasta-data`, visibility **Private**. Nothing else is needed: the first
   submission creates `pasta.json`. (To start from the Excel list, see the next section.)
2. **Create a token for the app.** <https://huggingface.co/settings/tokens> → *Create new token* →
   **Fine-grained**, name e.g. `femto-pasta-netlify`. Under *Repositories permissions* search for
   `<you>/femto-pasta-data` and tick **Read access to contents of selected repos** and
   **Write access to contents/settings of selected repos**. Leave all the other boxes empty. Copy the token
   (`hf_…`). It is shown once only.
   (A classic "write" token works too, but it can write to *all* your repositories. The fine-grained one can
   only touch this one.)
3. **Optional:** in the repository's *Settings*, keep it private, and you can add group members as
   collaborators if they should see the raw data and history on the Hub.

Do **not** add a rule for `*.json` to the repository's `.gitattributes` (the default one has none):
`pasta.json` must be a normal file, not a Git LFS file.

## Import the Excel list

The Excel file contains names, so it is not committed to GitHub (`.gitignore`). Import it once from your
computer:

```bash
npm install
```

```bash
node scripts/import-excel.mjs path/to/list.xlsx --dry-run
```

`--dry-run` only shows what it found: the layout, people, days, servings per person and warnings. Check that
the totals match the Excel sheet. The layout is detected automatically:

| layout | looks like |
|---|---|
| wide | one row per person, one column per Wednesday (header row: dates), cells = servings |
| wide-t | one row per Wednesday (first column: dates), one column per person (header row: names) |
| long | one row per entry with header `Date`/`Datum`, `Name`, `Servings`/`Portionen`/`Anzahl` |
| totals | `Name`, `Servings` only: needs `--date YYYY-MM-DD`, the day the totals are booked on |

Cells with numbers count as servings (`1,5` works), `x`/`✓`/`ja` count as 1, empty/`0`/`-` mean absent, and rows
called `Total`/`Summe` are skipped. `--sheet <name>` picks another worksheet than the first one.

Then either commit it straight into the Hugging Face repository (merged into what is already there; on a name
clash for the same day the Excel value wins, or the existing one with `--keep-existing`):

```bash
HF_TOKEN=hf_xxx HF_REPO=<you>/femto-pasta-data node scripts/import-excel.mjs path/to/list.xlsx --push
```

or write `pasta.json` (`--out` for another file name) and upload it by hand on the Hub: repository →
*Files and versions* → *Add file* → *Upload files*.

Imported entries are marked `"source": "excel"` (shown as "(excel import)" in the git log on the dashboard).
Days that are not Wednesdays in the Excel list are kept as they are.

## Deploy on Netlify

1. *Add new site* → *Import an existing project* → this GitHub repository. Build command and publish folder
   come from `netlify.toml` (`npm run build`, `dist`, Node 22).
2. *Site configuration → Environment variables* (scope: at least *Functions* and *Builds*):

   | variable | value |
   |---|---|
   | `NUXT_SESSION_PASSWORD` | 32+ random characters, e.g. from `openssl rand -base64 32` |
   | `NUXT_PASTA_PASSWORD` | `pasta-pesto` |
   | `NUXT_HF_TOKEN` | the fine-grained token from above (`hf_…`) |
   | `NUXT_HF_REPO` | `<you>/femto-pasta-data` |
   | `NUXT_HF_FILE` | optional, default `pasta.json` |
   | `NUXT_HF_BRANCH` | optional, default `main` |

3. Deploy, log in with the password, open **QR** (top right), print it and stick it to the kitchen wall.

Changing a variable needs a new deploy (*Deploys → Trigger deploy*).

## Local development

```bash
cp .env.example .env
```

Fill in `NUXT_SESSION_PASSWORD` and leave `NUXT_HF_TOKEN` empty: the log is then kept locally in
`.data/kv/pasta.json` (copy an imported `pasta.json` there to play with real data). With a token and
`NUXT_HF_REPO` it uses the Hugging Face repository instead.

```bash
npm run dev
```

```bash
npm test
```

## Data format

```json
{
  "version": 1,
  "people": ["Anna", "Ben"],
  "entries": [
    { "date": "2026-11-18", "name": "Anna", "servings": 2, "at": "2026-11-18T12:31:05.000Z", "source": "web" },
    { "date": "2026-11-18", "name": "Ben", "servings": 1, "source": "excel" }
  ],
  "updatedAt": "2026-11-18T12:31:05.000Z"
}
```

One entry per person and day. Names match regardless of case and spaces, so "anna " and "Anna" are the same
person. To rename someone or fix a typo, edit `pasta.json` on the Hub (*Files and versions* → `pasta.json` →
*Edit*). The app picks the change up within ~10 seconds.

## Code map

- `server/utils/store.ts`: reading/committing `pasta.json` on Hugging Face (with the conflict retry), or the local file
- `server/utils/auth.ts`, `server/api/login.post.ts`: the shared password and the session
- `server/api/servings.post.ts`: one submission (validation: Wednesday, not in the future, 0–20 servings in ¼ steps)
- `shared/utils/pasta.ts`: date helpers, upsert/normalise of the log (used by pages and server)
- `app/lib/stats.ts`: all statistics and the physics corner (assumptions in `PHYSICS`), tested in `tests/`
- `app/components/`: the hand-made SVG charts, leaderboard, badges, submit panel
- `scripts/import-excel.mjs`: the Excel importer
