# Growth & Acquisition Workshop: landing page

A static, dependency-free landing page for the **Growth & Acquisition Workshop** with Amos Feranmi (Saturday, 7 November 2026, 12 PM WAT, live and virtual).

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | The page: copy, SEO and Open Graph metadata, and Event structured data (JSON-LD) |
| `styles.css` | All styles, mobile first. The palette (black, white, yellow, magenta) comes from the workshop poster |
| `main.js` | Scroll reveal and an analytics shim that works with any provider |
| `assets/amos-feranmi.{webp,jpg}` | Instructor portrait, cropped from the official poster |
| `assets/og-image.jpg` | 1200×630 social sharing image made from the official poster |
| `assets/favicon.svg` | Favicon |

The page is served at the site root (`/`).

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Upload the repository root to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, cPanel). It has no build step.

After you deploy, change `og:image` and `twitter:image` in `index.html` to the **absolute** URL of `assets/og-image.jpg`, for example `https://your-domain.com/assets/og-image.jpg`. Facebook, WhatsApp and LinkedIn previews need an absolute URL. Then add `<link rel="canonical">` and `og:url` with the final domain.

## Registration

Every purchase CTA links to the verified registration page: `https://amos.selar.com/gaw`.

The Selar product sells both tickets on that one page, so there is no separate URL for each ticket. Visitors choose their ticket at checkout. Selar currently names the tickets **Standard** and **Premium**, and the page explains that Growth Intensive is listed as Premium. If you rename the Selar ticket to "Growth Intensive", delete that sentence from the `.tickets__note` paragraph in `index.html`.

## Analytics

No analytics provider is installed. `main.js` sends events to whichever of these is on the page and does nothing if none is:

- Google Tag Manager (`window.dataLayer`)
- GA4 (`gtag`)
- Plausible (`plausible`)
- Meta Pixel (`fbq`). Only `registration_click`, sent as `InitiateCheckout`

| Event | When | Properties |
| --- | --- | --- |
| `landing_page_view` | Page load | `page` |
| `primary_cta_click` | Any "Get Your Ticket" button | `location` (`header`, `hero`, `learn`, `final`, `footer`) |
| `standard_access_cta_click` | "Get Standard Access" | `location`, `ticket` |
| `growth_intensive_cta_click` | "Get Growth Intensive" | `location`, `ticket` |
| `explore_tickets_click` | "Explore Ticket Options" / "Compare ticket options" | `location` |
| `registration_click` | Any click through to amos.selar.com | `location`, `ticket` (`standard`, `growth_intensive`, `unspecified`) |

To turn tracking on, paste your provider's snippet into `<head>` in `index.html`. The events above start flowing without further changes.
