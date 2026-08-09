# Byte Squad · Heard

Team 331 · AI for Strong Institutions (UN SDG 16) · Tech for Good 2026, GDG Coimbatore

Reads a CSV of written public consultation responses, works out what each one is
actually arguing, and shows the most raised themes ranked by how many
stakeholders raised each, with a real quote for every theme — and the source
rows behind every count, so the ranking can be checked rather than trusted.

## Who it is for

Meena, a policy analyst in a city municipal corporation or planning authority.
When a draft plan is published, the public gets 30 to 45 days to file written
objections, and a technical committee has to read all of them before the public
hearings. Today that is done by hand in a spreadsheet.

The scale is real. Coimbatore's own draft Master Plan 2041 drew over 3,000
objections and suggestions on a 600 page document, and the Local Planning
Authority reported going through them individually over roughly two months.
Pimpri Chinchwad received 49,000 on one revised development plan. The Delhi
Development Authority processed over 33,000 on a master plan draft.

## What it does

1. Upload a CSV of responses.
2. Each chunk goes to Gemini, which decides whether it states a position at all,
   and if it does, extracts the theme and a one line key point.
3. A consolidation pass merges labels that are different words for the same
   argument.
4. Themes are grouped, ranked by how many raised them, and shown with the quote
   that best represents each.
5. Every theme carries the source rows it was built from — the row id from the
   uploaded file, the organisation, and the response text — so a claim on screen
   can be traced back to the spreadsheet it came from.
6. A finished run is kept in the browser, and can be printed to PDF or exported
   as a CSV of source rows.

## How you know it is right

The themes are model output and can be wrong. The quotes and source rows are
not: Gemini is asked for a short label, and `extractOne` in `src/extract.ts`
spreads a `Verdict` carrying only `substantive`, `theme` and `key_point` over the
uploaded row. That type has no text field, so the model is structurally unable to
rewrite a response — the text on screen is the text in the file, byte for byte.

Which means the tool does not ask to be believed. Open a theme, read its source
rows, and check them against your own file by row id. "Download source rows"
exports the same thing as a CSV for exactly that comparison.

## What it does not do

- English only. No Tamil or Tanglish.
- It does not tell you whether a response supports or opposes the proposal, only
  what it is about.
- It only knows who is speaking when the upload has an organisation column.
  Without one, counts are of text chunks, and the organisation view is hidden
  rather than guessed at.
- Accuracy is measured on a small hand labelled set, so treat the number as
  indicative and read the row count next to it.
- Scanned PDFs with no text layer are skipped entirely, not OCRed.
- Saved reports live in one browser on one machine. They survive a refresh, but
  they are not shared with a colleague and clearing site data removes them. Use
  the PDF or CSV export for anything that has to leave.

## When it is not sure

Real submissions are full of text that is not an opinion: respondents quoting
the consultation's own questions, footnotes, member rosters, "we appreciate the
opportunity to comment". Rather than inventing a theme for those, the tool sets
them aside and reports how many it set aside. On a 40 chunk sample it filtered
16 and removed four junk themes that would otherwise have ranked.

## Architecture

    CSV upload
      -> parse (src/index.ts)
      -> extract theme + position gate, batched (src/extract.ts)
      -> consolidate synonym labels (src/consolidate.ts)
      -> group, rank, pick sample quote, attach source rows (src/group.ts)
      -> JSON to the React client (client/)
      -> kept in localStorage (client/src/storage.ts)

TypeScript throughout, on both sides. The server runs its `.ts` files directly:
Node 24 strips types at runtime, so there is no build step, no compiled output
to keep in sync, and `npm start` is still one process. The client is the one
thing that does build, because the browser needs bundled JS.

The API contract lives once in `shared/api.ts` and is imported by the server
that produces it and the client that reads it, so renaming a field is a build
error rather than `undefined` in the page. `client/src/api.ts` still validates
the response at runtime, because a type says nothing about what actually arrives
over the wire.

Saved reports live in `localStorage`, not a database. The server holds nothing
between requests and the analysis is stateless, so a database would have bought
storage we do not need at the cost of a connection string, an env var and a
deploy to get wrong. The browser fixes the thing that actually hurt — a run costs
minutes of paced Gemini quota, and a refresh used to throw it away. The cost of
that choice is that reports do not follow you to another machine, which is why
both exports exist.

All Gemini calls go through one shared client, `src/gemini.ts`. That matters
because extraction, consolidation and the benchmark judge all draw on the same
per project free tier quota, so the rate limiter has to be shared rather than
per module. It paces to `GEMINI_RPM`, honours the `retryDelay` Gemini returns on
a 429, and fails fast with a clear message on a daily quota rather than retrying
for hours.

Extraction batches 10 chunks per request. Throttled one at a time, a 223 row run
takes about 19 minutes; batched it is about 2. Running requests in parallel
instead would not help, because the free tier counts requests per minute, so 12
in flight still gives 12 a minute and more 429s.

MongoDB is optional. The server starts immediately and connects in the
background, so a missing Mongo cannot block startup.

Stack: Node 24, TypeScript, Express, React, Vite, Gemini API, MongoDB
(optional), Gemini CLI for the agentic workflow.

## Run

    npm install
    cp .env.example .env      # add your GEMINI_API_KEY
    npm run build             # builds the React client into dist/
    npm start

Open http://localhost:3000 and upload a CSV from `data/`.

Get a free Gemini key at https://aistudio.google.com/app/apikey

While developing, run two terminals: `npm run dev` for the API with watch and
reload, and `npm run dev:web` for the Vite dev server on 5173, which proxies
`/api` to 3000. For a demo, prefer `npm run build && npm start`, which serves
everything from one process on one port.

If `dist/` is missing, the server falls back to the plain page in `public/`, so
a broken build still gives you a working demo.

## Scripts

| Command | Does |
|---|---|
| `npm start` | Run the app on http://localhost:3000 |
| `npm run dev` | API only, with watch and reload |
| `npm run dev:web` | Vite dev server for the client, proxied to the API |
| `npm run build` | Build the client into `dist/` |
| `npm run typecheck` | Typecheck client and server |
| `npm run benchmark` | Theme accuracy on `data/labeled_sample.csv` via an LLM judge |
| `npm run fetch:trai` | Pull real Indian consultation responses from TRAI |
| `npm run fetch -- <docketId> <n>` | Pull US comments from Regulations.gov |

## Data

| File | What |
|---|---|
| `data/trai_comments.csv` | 223 real response chunks from 19 Indian stakeholders on TRAI's AI and Big Data consultation |
| `data/trai_sample.csv` | First 40 of the above, 4 organisations. Quick test set |
| `data/sample_comments.csv` | 10 toy comments, gig worker insurance topic |
| `data/labeled_sample.csv` | The same 10 with an expected theme, for the benchmark |

Airtel, MTNL and Ministry of Defence submissions were scanned images with no
text layer, so they are not in the dataset.

## Tuning

Uploads are capped at `MAX_COMMENTS` rows (default 300) and `MAX_UPLOAD_BYTES`
(default 5 MB), because every row costs a paced Gemini request. A longer file is
truncated rather than rejected, and the page says so.

Set in `.env`: `GEMINI_RPM` (default 12, under the free tier 15),
`GEMINI_BATCH_SIZE` (default 10, set 1 for one chunk per request),
`GEMINI_MAX_RETRIES` (default 5).

## Team

- Priyadharshini — ingestion, extraction, grouping, benchmark
- Nitish Kumar PS — frontend, ranked list, demo

## Project docs

- [`PROPOSAL.md`](./PROPOSAL.md) — the ideation phase submission
- [`MILESTONES.md`](./MILESTONES.md) — organiser checklist
- [`/docs`](./docs) — design notes and research
