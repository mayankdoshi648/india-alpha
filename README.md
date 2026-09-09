# India Market Desk

A Nifty 50 / Nifty 500 terminal: one pulse bar, tabbed workspaces (Tape, Setups, F&O, Sectors, Universe, Breadth, Feed), sector rotation, and a universe inspector.

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

1. **Tape** — pulse bar (Nifty, Bank Nifty, VIX, PCR, A/D, FII), alerts, session macro, index tiles, Nifty 50 mosaic, gainers / losers / volume / RSI lists. Keys `1`.
2. **Setups** — Stage 2, breakouts, volume surge, VCP, divergences, pivot reclaim, oversold pullback. Key `2`.
3. **F&O** — FII/DII flow, India VIX, PCR, max pain, Nifty OI ladder. Key `3`.
4. **Sectors** — compact named chips, four-colour rotation map with labelled dots, constituent heatmap. Key `4`.
5. **Universe** — concentrated Core columns by default (CMP, 1D/1W, RSI, volume spike, stack, 52W, Stage 2, setups). Switch Tape / Structure / Flow / Earnings / All for more fields. Filter by rotation colour. Key `5`.
6. **Breadth** — EMA gauges D/W/M plus A/D and trend filters. Key `6`.
7. **Feed** — DhanHQ JWT. Key `7`.

Also: stock drawer with 80-session chart, watchlists, Configure templates, 60s auto-refresh while NSE is open.

## Scripts

```bash
npm run dev      # http://127.0.0.1:43147
npm run build
npm run start -- --port 43147
```
