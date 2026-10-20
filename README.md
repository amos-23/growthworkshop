# Growth & Acquisition Workshop: landing page

A static, dependency-free landing page for the **Growth & Acquisition Workshop** with Amos Feranmi (Saturday, 7 November 2026, 12 PM WAT, live and virtual).

## Files

| Path | Purpose |
| --- | --- |
| `server.js` | Dependency-free Node server: serves `public/`, records events at `/api/track`, serves the admin at `/admin` |
| `public/index.html` | The landing page: copy, SEO and Open Graph metadata, Event structured data (JSON-LD) |
| `public/styles.css` | All page styles, mobile first. Palette (black, white, yellow, magenta) from the workshop poster |
| `public/main.js` | Scroll reveal and event tracking |
| `public/assets/` | Instructor portrait, 1200×630 sharing image and favicon, all derived from the official poster |
| `admin/` | Password-protected analytics dashboard (`index.html`, `admin.css`, `admin.js`) |

## Run locally

```sh
ADMIN_PASSWORD=choose-a-password npm start
# site:  http://localhost:3000
# admin: http://localhost:3000/admin/   (username: admin)
```

## Deploy (Railway)

1. Railway detects `package.json` and runs `npm start`. No build step.
2. Set these **variables** on the service:
   - `ADMIN_PASSWORD`: required. Without it `/admin` is disabled.
   - `ADMIN_USER`: optional, defaults to `admin`.
3. **Add a Volume** to the service (any mount path). Events are stored in `events.jsonl` on that volume; without one they are lost on every redeploy. The admin page shows a warning until a volume is attached. `RAILWAY_VOLUME_MOUNT_PATH` is picked up automatically, or set `DATA_DIR` yourself.
4. Run a single instance (events are held in memory and appended to one file).

The sharing image URLs in `public/index.html` (`og:image`, `twitter:image`) should be absolute, for example `https://www.growthworkshop.xyz/assets/og-image.jpg`, so WhatsApp, Facebook and LinkedIn previews work.

## Registration

Every purchase CTA links to the verified registration page: `https://amos.selar.com/gaw`.

The Selar product sells both tickets on that one page, so there is no separate URL for each ticket. Visitors choose their ticket at checkout. Selar currently names the tickets **Standard** and **Premium**, and the page explains that Growth Intensive is listed as Premium. If you rename the Selar ticket to "Growth Intensive", delete that sentence from the `.tickets__note` paragraph in `index.html`.

## Analytics and the admin dashboard

The page records events to its own `/api/track` endpoint. They appear at **`/admin/`** (HTTP basic auth) with:

- Visitors, page views, registration clicks and click-through rate
- A daily trend chart (WAT days) with a table view, and 7 / 30 / 90 day / all-time ranges
- Clicks by button location and by ticket button (Standard Access, Growth Intensive)
- Referrers, `utm_source` campaigns and devices
- A CSV export of every event (`/api/events.csv`)

**What it counts.** "Registration clicks" are visitors leaving for the Selar page. They are not purchases, so check Selar for sales. A visitor is a browser tab session (stored in `sessionStorage`), so the same person returning in a new tab counts again. No cookies, IP addresses or user agents are stored; only a device type (mobile, tablet or desktop). Known bots, previews and automated browsers are ignored.

**Tag your links** to see where traffic comes from, for example `https://www.growthworkshop.xyz/?utm_source=instagram&utm_medium=bio`.

Events also still go to Google Tag Manager, GA4, Plausible or Meta Pixel if you paste one into the page `<head>`.

| Event | When | Properties |
| --- | --- | --- |
| `landing_page_view` | Page load | `page` |
| `primary_cta_click` | Any "Get Your Ticket" button | `location` (`header`, `hero`, `learn`, `final`, `footer`) |
| `standard_access_cta_click` | "Get Standard Access" | `location`, `ticket` |
| `growth_intensive_cta_click` | "Get Growth Intensive" | `location`, `ticket` |
| `explore_tickets_click` | "Explore Ticket Options" / "Compare ticket options" | `location` |
| `registration_click` | Any click through to amos.selar.com | `location`, `ticket` (`standard`, `growth_intensive`, `unspecified`) |
