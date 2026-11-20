# STB Delivery

The client-facing handover experience: a personal gift tag and box, the STB visiting card (vCard + QR),
the project reveal, screenshots, walkthrough video, handover files and support validity.

- Static React + Vite site. No database access: it talks only to the STB Core `delivery-api` Edge Function.
- Links look like `https://<site>/#<token>`. The token stays in the fragment, so it's never sent to the host.
- Respects reduced motion (no animation), keyboard-accessible, mobile-first.
- `public/_headers`: strict CSP, noindex, no-referrer, frame-ancestors none. `public/robots.txt`: disallow all.

```bash
npm ci
cp .env.example .env.local   # set VITE_DELIVERY_API_URL
npm run dev
npm test                     # unit tests
npx playwright test          # browser tests against a mocked gateway (uses system Chrome)
npm run build
```

Deploy: see `stb-core/docs/DEPLOY.md` step 3.
