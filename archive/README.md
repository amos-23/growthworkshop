# Archive

Retired versions of the site. Nothing in this folder is served publicly (the server only serves `public/` and `admin/`).

## 2026-11-workshop

The full landing page for the Growth & Acquisition Workshop planned for 7 November 2026: hero, stats, brand wall, instructor bio, tickets and FAQ, with the photos and logos it used.

To view it locally, copy `archive/2026-11-workshop/` to a temporary folder and serve it, for example `python3 -m http.server`. The page loads `main.js`, which posts to `/api/track`, so it will not record anything unless served by `server.js`. To restore it as the live page, copy `index.html`, `styles.css`, `main.js` and `assets/` back into `public/`.
