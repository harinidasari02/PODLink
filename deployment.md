# PODLink: deployment and run guide

## 1. Run it locally

Requirements: Node.js 20 or newer (tested on 22), npm. No other services are needed. The database is a local SQLite file.

```bash
git clone <GITHUB_URL>
cd podlink
npm install
cp .env.example .env.local        # then set SESSION_SECRET (see below)
npm run dev                       # http://localhost:3000
```

1. Generate a session secret and paste it into `.env.local`:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. On first start the app creates `data/podlink.db` and seeds it with synthetic demo data (5 clients, 6 drivers, 49 trips including the three from the brief, POD images, 6 invoices). Set `AUTO_SEED=false` to skip this.
3. Reset to a clean demo at any time: stop the app, delete `data/podlink.db` and `data/uploads/`, start again.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): POD decision rules, billing cycles, Tally export, trip import, compression planning |
| `npm run typecheck` | TypeScript check |
| `npm run build && npm start` | Production build and server (needs `SESSION_SECRET`) |

Try the phone view on a desktop: open `/driver` in browser dev tools with a phone size. The camera button opens a file picker on desktop, so pick any file from `public/samples/`.

## 2. How it is deployed

**Status: not deployed by me in this submission. There is no live URL.** The app is a single Next.js server with a SQLite file and an uploads folder, so it needs a host with a **persistent disk**. It will not work on serverless hosts with an ephemeral filesystem (for example Vercel) without changing the storage layer.

Recommended: Render, Railway or Fly.io, one web service, Node 20+.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Mount a persistent disk at `/data` and set `DATABASE_PATH=/data/podlink.db` and `UPLOAD_DIR=/data/uploads`
- Set the environment variables below. In production the app refuses to start without `SESSION_SECRET`, and session cookies are `Secure`, so serve it over HTTPS.
- Run a single instance (SQLite is a single-writer database and the login rate limiter is in memory).

### Environment variables (names only)

| Name | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes in production | Signs session cookies. 32+ random characters |
| `ANTHROPIC_API_KEY` | No | Turns on the real vision-model POD check. Without it the app runs the clearly labelled demo check |
| `AI_MODEL` | No | Vision model name used when the key is set |
| `DATABASE_PATH` | No | SQLite file location. Default `./data/podlink.db` |
| `UPLOAD_DIR` | No | POD image folder. Default `./data/uploads` |
| `AUTO_SEED` | No | `false` disables first-run demo data |

## 3. Demo logins for the reviewer

All demo data is synthetic. No real people, phone numbers or documents.

| Role | Sign in with | Credentials |
|---|---|---|
| Driver (Marathi prompts) | Login screen, **Driver** tab | Code `D101`, PIN `1234` |
| Driver (Hindi prompts) | Login screen, **Driver** tab | Code `D103`, PIN `1234` |
| Billing executive | Login screen, **Office** tab | `billing@demo.podlink.test` / `demo-pass-2026` |

### Suggested walkthrough (about 5 minutes)

1. **Driver, offline capture.** Sign in as `D101`. Open trip TRP-66178 (Indore). In browser dev tools set the network to Offline, tap the big camera button, choose `public/samples/TRP-66150-good.jpg`. The screen says the photo is saved. Go back online and the AI verdict appears by itself (green tick).
2. **Retake and the cap of two.** Open TRP-66150. Upload `TRP-66150-blurry.jpg`, then `TRP-66150-no-stamp.jpg`. Each returns a retake with icon reasons. A third bad photo goes to the office instead of a third retake. The retake counter is stored on the server.
3. **Review queue.** Sign in as billing. Open **Review**. Each item shows the photo beside what the AI read, why it is here, and lets you correct the quantity, accept, or ask for a retake. Corrections are saved beside the AI reading, not over it.
4. **Billing queue and export.** Open **Billing**. Verified trips are grouped by client and cycle. Tick trips and press *Prepare invoice batch*, then **Export** to download a ZIP with the Tally sales voucher XML, a CSV and the POD images. **Client link** gives a read-only page of that invoice's PODs.
5. **Dashboard.** Trips without POD, POD-to-invoice days, by branch and by age. *SMS link* creates the upload link for a hired driver (the message itself is mocked and the link is shown on screen).
6. **Import.** Open **Import** and upload `public/sample-trips.csv`. Rows with a bad e-way bill number are rejected with a reason per row.

### Demo mode versus real AI

With no `ANTHROPIC_API_KEY` the check is a **demo check**. It really reads ink colour from the photo to decide whether a stamp and a signature are present and it really measures blur, darkness and cropping. The other fields (quantity, remarks, confidence) come from each trip's seeded scenario. Every result in this mode is labelled "Demo check". With a key set, the photo is sent to the vision model and its JSON answer is validated before use.
