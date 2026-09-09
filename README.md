# India Market Desk

A single-screen Nifty 50 / Nifty 500 desk: index tape, mosaic, sector rotation, universe, alerts, setups, F&O and breadth on one page.

Quotes, historical candles and the Nifty option chain come from **DhanHQ** when you add credentials. **NSE India** is used for FII/DII cash flow and index last prices when the public feed is reachable. If neither is available, the desk still runs on a deterministic tape anchored to the 8 Sep 2026 close (Nifty 23,635) so every panel stays usable.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional server-side fallback; you can also paste Dhan keys on the page
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). The shell paints immediately; quotes then load from `/api/market`.

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
- `POST /v2/optionchain/expirylist` and `/v2/optionchain` — index and stock PCR, max pain, ATM IV
- Scrip master CSV for security IDs

NSE (no key): `allIndices`, `fiidiiTradeData`, `option-chain-indices`, `option-chain-equities`.

## What is on the desk

The desk is **one page**. The first paint is a light shell; the tape loads from `/api/market` so the page is not a 1MB HTML dump. Indices, mosaic, sector rotation, universe, alerts, setups, F&O and breadth sit together so you can watch without switching tabs. Configure / Dhan keys open a side panel.

1. **Watch strip** — Nifty, Bank Nifty, VIX, PCR, A/D, FII.
2. **Index tape + mosaic + gainers/losers** — left column.
3. **Sector rotation + universe** — centre.
4. **Alerts, setups, F&O (Nifty + stocks), EMA breadth** — right column.
5. **Stock drawer** — click any name for chart, stock option chain, PCR/IV and notes.

## Scripts

```bash
npm run dev      # http://127.0.0.1:43147
npm run build
npm run start -- --port 43147
```
