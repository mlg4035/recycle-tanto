# RecycleTanto

Dummy-proof handwritten table scanner:
- user takes a photo
- app uploads to server
- server submits OCR job
- webhook marks job complete
- app shows extracted table and saves locally for offline history

## Stack

- Next.js App Router + TypeScript
- Server persistence: SQLite (`better-sqlite3`)
- Device persistence: IndexedDB (`dexie`)
- Realtime status: SSE with polling fallback
- PWA: manifest + service worker shell caching

## Environment

Copy `.env.example` to `.env.local` and fill values.

### Required vars

- `HANDWRITINGOCR_API_KEY`
- `HANDWRITINGOCR_WEBHOOK_SECRET`
- `HANDWRITINGOCR_BASE_URL` (example: `https://www.handwritingocr.com/api/v3`)
- `HANDWRITINGOCR_ACTION` (`transcribe` recommended for plans without table extraction)
- `APP_PUBLIC_BASE_URL`
- `MOCK_OCR` (`1` for local mock mode, `0` for real API)

## Run locally (mock mode, recommended first)

1. Set `MOCK_OCR=1` in `.env.local`
2. Install and run:

```bash
npm install
npm run dev
```

3. Open `http://localhost:3000`
4. Capture a photo
5. You should see:
   - immediate `processing` status
   - completion in ~2 seconds (mock internal webhook)
   - extracted table
   - saved local scan in `/history`
6. Optional dev tool:
   - open `/dev/mock-webhook`
   - enter a job ID to manually trigger mock webhook completion
   - click **Load sample payload** to auto-load local sample JSON
   - use **Queue Inspector** to review/retry/remove queued offline uploads

Optional override for sample file paths:
- `DEV_SAMPLE_PAYLOAD_FILES=c:/path/a.json,c:/path/b.json`

## Run locally (real HandwritingOCR mode)

1. Set `MOCK_OCR=0`
2. Configure API key/secret/base URL
3. Set `APP_PUBLIC_BASE_URL` to a public HTTPS URL that can receive webhooks
4. Run app:

```bash
npm run dev
```

5. Ensure your public URL forwards to local `http://localhost:3000`
   - tunnel options: ngrok, cloudflared, localtunnel (optional, choose any)
6. HandwritingOCR should call:
   - `POST {APP_PUBLIC_BASE_URL}/api/webhooks/handwritingocr`

## API endpoints

- `POST /api/jobs`
  - multipart form-data: `submissionId`, `image`
  - idempotent by `submissionId`
- `GET /api/jobs/:id`
- `GET /api/jobs/:id/events` (SSE)
- `POST /api/webhooks/handwritingocr` (HMAC SHA-256 `X-Signature`)

## Android PWA notes

- Deploy over HTTPS to enable install + service workers.
- Open in Android Chrome and choose **Add to Home screen**.
- App now includes:
  - install prompt banner when available
  - update-ready banner for new service worker versions
  - offline banner when network is unavailable
  - queued-for-upload offline queue with retry
  - improved caching for app shell and static assets

## Reliability behavior

- Server restarts safe (SQLite-backed jobs)
- Browser refresh safe (job can be re-fetched by id)
- Upload abuse guarded (10/min per IP)
- Max file size 8MB server-side
- Client compresses image to max long edge 1600px (JPEG quality 0.75)
- OCR results are not printed in production logs
