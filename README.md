# Growth & Acquisition Workshop

The public site is now a short "join the list for the next workshop" page. The workshop took place on 7 November 2026; the full sales page is archived in `archive/`.

## Files

| Path | Purpose |
| --- | --- |
| `server.js` | Dependency-free Node server: serves `public/`, records page views at `/api/track`, takes waitlist sign-ups at `/api/waitlist`, serves the admin at `/admin` |
| `public/index.html` | The waitlist page (headline, one line, sign-up form) |
| `public/waitlist.js` | Form handling: validation, posting to `/api/waitlist`, thank-you message |
| `public/styles.css` | Styles. Palette (black, white, yellow, magenta) from the workshop poster |
| `public/main.js` | Page-view tracking |
| `public/assets/` | Favicon and the 1200×630 social sharing image |
| `admin/` | Passkey-protected dashboard: traffic stats and the waitlist (`index.html`, `admin.css`, `admin.js`) |
| `archive/2026-11-workshop/` | The retired full workshop page with its photos and logos. Not served publicly (see `archive/README.md`) |

## Run locally

```sh
npm start
# site:  http://localhost:3000
# admin: http://localhost:3000/admin/?key=growthx
```

## Deploy (Railway)

1. Railway detects `package.json` and runs `npm start`. No build step.
2. No variables are required. The admin passkey defaults to `growthx` (see below); set `ADMIN_KEY` to change it without editing code.
3. **Attach a Volume** to the service. Page views are stored in `events.jsonl` and waitlist sign-ups in `waitlist.jsonl` on that volume; without one they are lost on every redeploy. `RAILWAY_VOLUME_MOUNT_PATH` is picked up automatically, or set `DATA_DIR` yourself.
4. Run a single instance (data is held in memory and appended to files).

## Waitlist

Visitors give a name, an email and an optional WhatsApp number. The sign-up endpoint:

- rejects invalid emails and empty names, and quietly ignores a hidden "honeypot" field that only bots fill in;
- is rate-limited per IP address (8 sign-ups a minute);
- treats the same email twice as already signed up (no duplicate row).

View and export the list at **`/admin/`** (the "Waitlist" card, with a Download CSV link; also `/api/waitlist.csv`). CSV cells that could be read as spreadsheet formulas are prefixed with an apostrophe.

**Personal data.** The list holds names, emails and phone numbers. It is only reachable through the admin passkey and the Railway volume, so back up the CSV when you need it, and delete entries (edit `waitlist.jsonl` on the volume) if someone asks. The page tells people their details are only used to tell them about the next workshop; keep to that.

## Analytics and the admin dashboard

The page records views to its own `/api/track` endpoint. `/admin/` shows visitors, page views, a daily chart, referrers, `utm_source` campaigns and devices, and a CSV export of every event (`/api/events.csv`). No cookies or IP addresses are stored; known bots and automated browsers are ignored.

**Passkey.** Open `/admin/?key=growthx` once; the browser remembers it for a year. The default key is in `server.js` and this repository is public, so treat it as a light gate. The waitlist contains personal details, so set `ADMIN_KEY` on the host to something private.

**Tag your links** to see where traffic comes from, for example `https://www.growthworkshop.xyz/?utm_source=instagram&utm_medium=bio`.
