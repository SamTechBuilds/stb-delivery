# STB Delivery — Client-Facing Delivery Website

**STB Delivery** is the client-facing website for Sam Tech Builds. Clients open a private link and see their project handover — screenshots, files, checklist, support period details and contact information.

This app talks **only** to the STB Core `delivery-api` Edge Function using a link token. Clients never sign in and have no Supabase account.

---

## Repository overview

```
stb-delivery/
├── src/
│   ├── api.ts              # Token delivery API client + sessionStorage fallback (B3)
│   ├── slug-api.ts         # Slug-based public delivery API client
│   ├── types.ts            # Shared TypeScript types
│   ├── format.ts           # Date / size formatting helpers
│   ├── sections.ts         # Delivery section definitions
│   ├── App.tsx             # Router root
│   ├── main.tsx            # React entry point
│   ├── styles.css          # Global styles
│   ├── pages/              # Route-level page components
│   │   └── TokenDelivery.tsx   # Main delivery page (token + slug)
│   ├── components/         # Shared UI components
│   └── admin/              # Internal admin panel (staff only, behind auth)
├── public/
│   ├── _redirects          # Cloudflare Pages: SPA fallback for /* and /reveal/*
│   ├── _headers            # Cloudflare Pages: security headers + CSP
│   ├── favicon.svg
│   └── robots.txt          # noindex, nofollow, noarchive
├── tests/                  # Vitest unit tests
├── e2e/                    # Playwright end-to-end tests (uses mock Supabase)
├── .env.example            # Required environment variables (placeholder values)
├── .env.e2e                # E2E test overrides (mock URLs — NOT for production)
├── vite.config.ts
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

---

## Local development

### Prerequisites

- Node.js 22+
- npm 10+

### Install

```bash
npm ci
```

### Configure environment

Copy `.env.example` to `.env.local` and fill in your STB Core values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_DELIVERY_API_URL=https://YOUR_REF.supabase.co/functions/v1/delivery-api
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STB_CONTACT_EMAIL=hello@samtechbuilds.com
VITE_STB_WEBSITE=https://samtechbuilds.netlify.app
```

Replace `YOUR_REF` with your Supabase project reference (e.g. `abcdefghijklmnop`).

### Run development server

```bash
npm run dev
```

Visits `http://localhost:5173`. Open a delivery link: `http://localhost:5173/#YOUR_TOKEN`

### Type-check

```bash
npm run typecheck
```

### Unit tests

```bash
npm test
```

### End-to-end tests (Playwright)

E2E tests use a mock Supabase (`.env.e2e`) — no real credentials required:

```bash
npx playwright install chromium
npm run test:e2e
```

### Build (production)

```bash
npm run build
```

Output: `dist/`. Vite reads environment variables from the Cloudflare Pages dashboard at build time — **not** from `.env.e2e`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_DELIVERY_API_URL` | ✅ | Full URL of the `delivery-api` Edge Function |
| `VITE_SUPABASE_URL` | ✅ | Base URL of STB Core Supabase project |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon/publishable key (safe to expose; RLS enforces access) |
| `VITE_STB_CONTACT_EMAIL` | ✅ | Shown on error screens |
| `VITE_STB_WEBSITE` | ✅ | Shown on error screens |

**Never set `SUPABASE_SERVICE_ROLE_KEY` here.** The service role key is used only inside Edge Functions, never in browser code.

---

## Deployment (Cloudflare Pages)

See `../stb-core/docs/DEPLOY.md` Step 2 for the full sequence. Summary:

1. Push this repository to a private GitHub repo (e.g. `SamTechBuilds/stb-delivery`).
2. In Cloudflare Pages → Create → Pages → Connect to Git → select `stb-delivery`.
3. Set build command: `npm run build`; output directory: `dist`; Node version: `22`.
4. Add all five `VITE_*` environment variables in the Cloudflare Pages dashboard.
5. Deploy. Project URL: `https://stb-delivery.pages.dev` (or your custom domain).

The `public/_redirects` file handles SPA routing — no additional Cloudflare configuration needed.

**After deployment**, update `DELIVERY_ALLOWED_ORIGINS` in the STB Core Edge Function secrets to include the Cloudflare Pages URL (Step 1d of DEPLOY.md).

---

## Security notes

- `public/_headers` enforces `noindex/nofollow`, CSP, HSTS, `X-Frame-Options`, `Referrer-Policy: no-referrer`.
- Assets are cached immutably; HTML is `no-cache`.
- Token is scrubbed from the URL after first read (`history.replaceState`) and stored in `sessionStorage` for tab-lifetime persistence only.
- No `dangerouslySetInnerHTML` anywhere — all content is React-interpolated.

---

## Companion package

This app requires **STB Core** (Supabase backend). The companion package `stb-core-deployment.zip` contains:

- All 9 SQL migrations
- Both Edge Functions (`delivery-api`, `delivery-public`)
- Full deployment instructions (`docs/DEPLOY.md`)
- Security documentation

Apply migrations and deploy Edge Functions **before** deploying this app.
