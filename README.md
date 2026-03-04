# RecycleTanto

A dummy-proof handwritten table scanner. Capture a photo, send it for OCR, and get an extracted table—with offline support, PWA install, and a local history.

## Features

- **One-tap capture** — Take a photo and the app uploads, submits an OCR job, and displays the extracted table
- **Webhook-driven** — HandwritingOCR calls back when processing is done; no polling clutter
- **Offline-first** — Queue uploads when offline; they retry automatically when back online
- **Local history** — Scans saved in IndexedDB for browsing and export without the server
- **PWA** — Install to home screen, shell caching, update banners, and offline indicators

## Stack

- **Next.js** (App Router) + TypeScript
- **Server persistence:** SQLite (`better-sqlite3`)
- **Device persistence:** IndexedDB (`dexie`)
- **Realtime status:** SSE with polling fallback
- **PWA:** manifest + service worker shell caching

## Quick start (mock mode)

1. Copy `.env.example` to `.env.local` and set `MOCK_OCR=1`
2. Install and run:

```bash
npm install
npm run dev
```

3. Open `http://localhost:3000`, capture a photo, and see the mock flow complete in ~2 seconds
4. Optional: use `/dev/mock-webhook` to trigger webhooks manually or inspect the offline queue

## Environment variables

| Variable | Description |
|----------|-------------|
| `HANDWRITINGOCR_API_KEY` | API key for HandwritingOCR |
| `HANDWRITINGOCR_WEBHOOK_SECRET` | Secret for HMAC verification of webhook payloads |
| `HANDWRITINGOCR_BASE_URL` | e.g. `https://www.handwritingocr.com/api/v3` |
| `HANDWRITINGOCR_ACTION` | `transcribe` recommended for plans without table extraction |
| `APP_PUBLIC_BASE_URL` | Public HTTPS URL for receiving webhooks |
| `MOCK_OCR` | `1` for local mock mode, `0` for real API |

Override sample payload paths (dev):  
`DEV_SAMPLE_PAYLOAD_FILES=c:/path/a.json,c:/path/b.json`

## Running with real HandwritingOCR

1. Set `MOCK_OCR=0`
2. Configure API key, webhook secret, and base URL
3. Set `APP_PUBLIC_BASE_URL` to a public HTTPS URL reachable by the OCR provider
4. Expose localhost (e.g. ngrok, cloudflared) so HandwritingOCR can call:
   - `POST {APP_PUBLIC_BASE_URL}/api/webhooks/handwritingocr`

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/jobs` | Create job (multipart: `submissionId`, `image`), idempotent by `submissionId` |
| `GET` | `/api/jobs/:id` | Get job status |
| `GET` | `/api/jobs/:id/events` | SSE stream for job updates |
| `POST` | `/api/webhooks/handwritingocr` | Webhook receiver (HMAC SHA-256 `X-Signature`) |

## Android PWA

- Deploy over HTTPS to enable install and service workers
- Open in Chrome → **Add to Home screen**
- Includes: install prompt, update-ready banner, offline banner, queued upload retry, app shell caching

## Reliability

- **Server restarts:** Jobs persisted in SQLite
- **Browser refresh:** Job can be re-fetched by ID
- **Rate limit:** 10 requests/min per IP
- **Max file size:** 8MB server-side; client compresses to max 1600px long edge (JPEG 0.75)
- **Logging:** OCR results not printed in production logs

## Scripts

```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Run production server
npm run lint   # Run ESLint
```
