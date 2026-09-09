# India Market Desk

A Nifty 50 / Nifty 500 market-view dashboard: index tape with EMA posture, FII/DII and option positioning, moving-average breadth, sector rotation, a full universe inspector, and a setup scanner (Stage 2, VCP, volume surge, divergences, pivots, oversold pullbacks).

Quotes, historical candles and the Nifty option chain come from **DhanHQ** when you add credentials. **NSE India** is used for FII/DII cash flow and index last prices when the public feed is reachable. If neither is available, the desk still runs on a deterministic tape anchored to the 8 Sep 2026 close (Nifty 23,635) so every panel stays usable.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional server-side fallback; you can also paste Dhan keys on the page
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). The first paint is server-rendered so the tape shows even before client JS hydrates.

For a production-like local run (required if a preview iframe blocks `/_next` from `next dev`):

```bash
npm run build && npm run start
```

## DhanHQ

Paste the 24-hour **Access Token** (JWT, starts with `eyJ`) from [web.dhan.co](https://web.dhan.co) → My Profile → Access DhanHQ APIs. Client ID is optional — the desk reads it from Dhan. Do not paste the API key. `.env.local` still works as a server-side fallback:

```
DHAN_ACCESS_TOKEN=your_jwt
DHAN_CLIENT_ID=your_client_id
```

Used endpoints:

- `POST /v2/marketfeed/ltp` — last prices
- `POST /v2/charts/historical` — daily OHLC
- `POST /v2/optionchain/expirylist` and `/v2/optionchain` — PCR and max pain
- Scrip master CSV for security IDs

NSE (no key): `allIndices`, `fiidiiTradeData`, `option-chain-indices`.

## What is on the desk

1. **Index tiles** — Nifty, Bank Nifty, Sensex, large / mid / small cap CMP, gain%, 10/20/50/200 EMA above/below.
2. **Session clock** — NSE pre-open / open / closed in IST, quote age, source badges, Dhan token countdown, 60s auto-refresh while the cash market is open.
3. **Desk alerts** — FII streaks, VIX regime, PCR extremes, oversold-near-20 EMA, volume surges, breakouts.
4. **Session macro** — overnight gap, India VIX vs 20-day realized vol, vol premium, USD/INR, 10Y G-Sec, crude.
5. **Institutional F&O radar** — FII/DII net flow, India VIX regime, Nifty PCR, max pain.
6. **Nifty OI ladder** — call/put OI around ATM, call wall, put wall, IV skew.
7. **EMA breadth gauges** — % of the universe above 10/20 (short), 50 (medium), 200 (long) on D/W/M.
8. **Sector health** — sector tiles, constituent heatmap, 4-quadrant rotation.
9. **Universe inspector** — watchlist, cap, sector, returns, RSI, sparkline, volume, delivery %, RS vs Nifty, OI build, EMAs, 52-week range, earnings, CSV export.
10. **Stock drawer** — 80-session chart, delivery, RS, OI build, notes, watchlists.
11. **Setup scanner** — Stage 2, breakouts, volume surge, VCP, divergences, pivot reclaim, oversold pullback.
12. **Market breadth** — seven indicators with a 60-session drill-down.
13. **Settings** — EMA/RSI/volume/breakout templates plus on-page Dhan keys.

## Scripts

```bash
npm run dev      # http://127.0.0.1:43147
npm run build
npm run start -- --port 43147
```
