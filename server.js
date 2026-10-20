// Growth & Acquisition Workshop server.
// Serves the static landing page from ./public, records first-party analytics
// events to an append-only JSON Lines file, and serves a password-protected
// admin dashboard at /admin. No dependencies beyond Node's standard library.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_DIR = path.join(__dirname, 'admin');
const VOLUME_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const DATA_DIR = process.env.DATA_DIR || VOLUME_DIR || path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
// Simple shared passkey. Set ADMIN_KEY in the environment to change it without editing code.
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ADMIN_PASSWORD || 'growthx';
const WAT_OFFSET_MS = 60 * 60 * 1000; // West Africa Time is UTC+1 all year

const EVENTS = new Set([
  'landing_page_view',
  'primary_cta_click',
  'standard_access_cta_click',
  'growth_intensive_cta_click',
  'explore_tickets_click',
  'registration_click'
]);
const TICKETS = new Set(['standard', 'growth_intensive', 'unspecified']);
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|headless|lighthouse|pingdom|uptime/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// ---------- Event storage ----------

fs.mkdirSync(DATA_DIR, { recursive: true });

let events = [];
try {
  events = fs.readFileSync(EVENTS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch (e) { return null; } })
    .filter(Boolean);
} catch (err) {
  if (err.code !== 'ENOENT') console.error('Could not read events file:', err.message);
}
console.log(`Loaded ${events.length} events from ${EVENTS_FILE}${VOLUME_DIR || process.env.DATA_DIR ? '' : ' (not on a persistent volume)'}`);

const writer = fs.createWriteStream(EVENTS_FILE, { flags: 'a' });

function record(evt) {
  events.push(evt);
  writer.write(JSON.stringify(evt) + '\n');
}

// ---------- Helpers ----------

function clean(value, pattern, max) {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, max);
  return pattern.test(v) ? v : undefined;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return undefined; }
}

function deviceOf(ua) {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? String(fwd).split(',')[0] : req.socket.remoteAddress || '').trim();
}

// Light rate limit so one client can't flood the log.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > 60000) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > 120;
}
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [ip, entry] of hits) if (entry.start < cutoff) hits.delete(ip);
}, 60000).unref();

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }, headers));
  res.end(body);
}

function sendJson(res, status, data, headers) {
  send(res, status, JSON.stringify(data), Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest(); }

function keyMatches(candidate) {
  return typeof candidate === 'string' && crypto.timingSafeEqual(sha256(candidate), sha256(ADMIN_KEY));
}

function cookieKey(req) {
  const m = /(?:^|;\s*)gaw_key=([^;]+)/.exec(req.headers.cookie || '');
  try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
}

const PASSKEY_PAGE = '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">' +
  '<title>Workshop admin</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0b;color:#fff;font-family:system-ui,sans-serif}' +
  'form{width:min(92vw,340px);display:grid;gap:12px}h1{margin:0 0 4px;font-size:1.25rem}input,button{font:inherit;padding:12px;border-radius:4px;border:2px solid #ffd84d}' +
  'input{background:#1c1c1c;color:#fff}button{background:#ffd84d;color:#0b0b0b;font-weight:700;cursor:pointer}p{margin:0;color:#e66767;min-height:1.2em}</style></head><body>' +
  '<form method="get" action="/admin/"><h1>Workshop admin</h1><input type="password" name="key" placeholder="Passkey" autocomplete="current-password" autofocus required>' +
  '<button type="submit">Open dashboard</button><p>__MSG__</p></form></body></html>';

// Returns true when the request may continue; otherwise responds.
function requireAdmin(req, res, url) {
  const headers = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };
  const isPage = url.pathname === '/admin' || url.pathname.startsWith('/admin/');

  const supplied = url.searchParams.get('key');
  if (supplied !== null && isPage && req.method === 'GET') {
    if (keyMatches(supplied)) {
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      send(res, 303, '', Object.assign({
        Location: '/admin/',
        'Set-Cookie': 'gaw_key=' + encodeURIComponent(supplied) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000' + secure
      }, headers));
    } else {
      send(res, 401, PASSKEY_PAGE.replace('__MSG__', 'Wrong passkey.'), Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, headers));
    }
    return false;
  }
  if (keyMatches(cookieKey(req))) return true;

  if (isPage) {
    send(res, 401, PASSKEY_PAGE.replace('__MSG__', ''), Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, headers));
  } else {
    send(res, 401, 'Passkey required.', Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers));
  }
  return false;
}

function serveFile(res, root, relPath, extraHeaders) {
  const filePath = path.normalize(path.join(root, relPath));
  if (!filePath.startsWith(root + path.sep)) return send(res, 404, 'Not found');
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    res.writeHead(200, Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': isHtml || root === ADMIN_DIR ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }, extraHeaders));
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------- Tracking endpoint ----------

async function handleTrack(req, res) {
  const ua = String(req.headers['user-agent'] || '');
  if (BOT_UA.test(ua) || rateLimited(clientIp(req))) return send(res, 204);

  let body;
  try { body = JSON.parse(await readBody(req, 2048)); } catch (e) { return send(res, 400, 'Bad request'); }
  if (!body || !EVENTS.has(body.event)) return send(res, 400, 'Unknown event');

  const ownHost = String(req.headers.host || '').replace(/^www\./, '').split(':')[0];
  const refHost = hostOf(body.ref);
  const evt = {
    t: Date.now(),
    e: body.event,
    sid: clean(body.sid, /^[a-z0-9]{8,40}$/i, 40),
    loc: clean(body.location, /^[a-z_]{1,32}$/, 32),
    tk: TICKETS.has(body.ticket) ? body.ticket : undefined,
    ref: refHost && refHost !== ownHost ? refHost : undefined,
    us: clean(body.utm_source, /^[\w.\- ]{1,64}$/, 64),
    um: clean(body.utm_medium, /^[\w.\- ]{1,64}$/, 64),
    uc: clean(body.utm_campaign, /^[\w.\- ]{1,64}$/, 64),
    dv: deviceOf(ua)
  };
  record(evt);
  send(res, 204);
}

// ---------- Stats ----------

function watDay(t) { return new Date(t + WAT_OFFSET_MS).toISOString().slice(0, 10); }

function countBy(list, key, fallback) {
  const out = {};
  for (const item of list) {
    const k = item[key] || fallback;
    out[k] = (out[k] || 0) + 1;
  }
  return Object.entries(out).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function buildStats(range) {
  const now = Date.now();
  const days = range === 'all' ? null : Number(range);
  const todayStart = Date.parse(watDay(now) + 'T00:00:00Z') - WAT_OFFSET_MS;
  const since = days ? todayStart - (days - 1) * 86400000 : 0;
  const slice = events.filter((e) => e.t >= since);

  const views = slice.filter((e) => e.e === 'landing_page_view');
  const regs = slice.filter((e) => e.e === 'registration_click');
  const visitorSet = new Set(views.map((e) => e.sid).filter(Boolean));
  const regSessionSet = new Set(regs.map((e) => e.sid).filter(Boolean));
  const count = (name) => slice.filter((e) => e.e === name).length;

  // Daily series, zero-filled across the whole range
  const firstT = days ? since : (slice.length ? slice[0].t : now);
  const daily = new Map();
  for (let t = Date.parse(watDay(firstT) + 'T00:00:00Z'); t <= Date.parse(watDay(now) + 'T00:00:00Z'); t += 86400000) {
    daily.set(new Date(t).toISOString().slice(0, 10), { day: new Date(t).toISOString().slice(0, 10), visitors: new Set(), views: 0, registrationClicks: 0 });
  }
  for (const e of slice) {
    const d = daily.get(watDay(e.t));
    if (!d) continue;
    if (e.e === 'landing_page_view') { d.views += 1; if (e.sid) d.visitors.add(e.sid); }
    if (e.e === 'registration_click') d.registrationClicks += 1;
  }

  return {
    range: days ? String(days) : 'all',
    generatedAt: new Date(now).toISOString(),
    firstEventAt: events.length ? new Date(events[0].t).toISOString() : null,
    storage: { persistent: Boolean(VOLUME_DIR || process.env.DATA_DIR), totalEvents: events.length },
    totals: {
      pageViews: views.length,
      visitors: visitorSet.size,
      registrationClicks: regs.length,
      registrationVisitors: regSessionSet.size,
      clickThroughRate: visitorSet.size ? regSessionSet.size / visitorSet.size : 0,
      primaryCtaClicks: count('primary_cta_click'),
      standardClicks: count('standard_access_cta_click'),
      growthIntensiveClicks: count('growth_intensive_cta_click'),
      exploreTicketsClicks: count('explore_tickets_click')
    },
    daily: Array.from(daily.values()).map((d) => ({ day: d.day, visitors: d.visitors.size, views: d.views, registrationClicks: d.registrationClicks })),
    registrationByLocation: countBy(regs, 'loc', 'unknown'),
    registrationByTicket: countBy(regs, 'tk', 'unspecified'),
    referrers: countBy(views, 'ref', 'Direct / none'),
    utmSources: countBy(views.filter((e) => e.us), 'us', ''),
    devices: countBy(views, 'dv', 'unknown')
  };
}

function eventsCsv() {
  const cols = ['time_utc', 'event', 'session', 'location', 'ticket', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'device'];
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const rows = events.map((e) => [new Date(e.t).toISOString(), e.e, e.sid, e.loc, e.tk, e.ref, e.us, e.um, e.uc, e.dv].map(esc).join(','));
  return [cols.join(',')].concat(rows).join('\n') + '\n';
}

// ---------- Router ----------

const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { return send(res, 400, 'Bad request'); }

  try {
    if (pathname === '/api/track') {
      if (req.method !== 'POST') return send(res, 405, 'Method not allowed', { Allow: 'POST' });
      return await handleTrack(req, res);
    }

    if (pathname === '/healthz') return sendJson(res, 200, { ok: true });

    if (pathname === '/api/stats' || pathname === '/api/events.csv' || pathname === '/admin' || pathname.startsWith('/admin/')) {
      if (!requireAdmin(req, res, new URL(req.url, 'http://localhost'))) return;
      if (pathname === '/api/stats') {
        const range = new URL(req.url, 'http://localhost').searchParams.get('range') || '30';
        return sendJson(res, 200, buildStats(['7', '30', '90', 'all'].includes(range) ? range : '30'));
      }
      if (pathname === '/api/events.csv') {
        return send(res, 200, eventsCsv(), {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="growth-workshop-events.csv"',
          'Cache-Control': 'no-store'
        });
      }
      if (pathname === '/admin') return send(res, 301, '', { Location: '/admin/' });
      const rel = pathname === '/admin/' ? 'index.html' : pathname.slice('/admin/'.length);
      return serveFile(res, ADMIN_DIR, rel, { 'X-Robots-Tag': 'noindex, nofollow' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveFile(res, PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'Server error');
  }
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

function shutdown() {
  server.close();
  writer.end(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
