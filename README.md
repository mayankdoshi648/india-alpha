# India Market Desk

A single-screen Nifty 50 / Nifty 500 desk: index tape, mosaic, sector rotation, universe, alerts, swing setups (VCP / breakout), F&O and breadth on one page.

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
4. **Alerts, swing setups (VCP / breakout), F&O (Nifty + stocks), EMA breadth** — right column.
5. **Stock drawer** — click any name for chart, VCP contraction legs, breakout pivot/stop/1R/2R, stock option chain, PCR/IV and notes.

## Equity swing: VCP and breakouts

The right-hand **Swing · VCP / breakout** list and the stock drawer score two Minervini / O’Neil-style patterns on daily bars.

### Volatility Contraction Pattern (VCP)

A VCP is a Stage 2 name that coils through **successively tighter pullbacks** as supply leaves the stock.

- Windows: swing highs when they exist, else 34 → 21 → 13 → 8 bars. Need **at least two** contractions, each shallower than the last.
- Last contraction **≤ 12%** deep. Volume should dry up vs the prior three weeks.
- **Pivot** = high of the last contraction. **Buy stop** a tick above that high. **Stop** under the last contraction low.
- Targets: **1R** (risk from entry to stop), **2R**, and a **measured move** (height of the whole coil added to the pivot).
- Status: coiling → at pivot → triggered → throwback (price returns to the 10 EMA after the break) → extended (>8% above the 10 EMA, do not chase) → failed (pivot lost).

### Base breakout

- Pivot = **55-day high**. The base should stay **under ~22%** deep and inside the retrace cap (default 50%).
- The last 8 days are the **handle**. Tighter handles fail less often; volume should dry there too.
- Trigger: close through the pivot on **≥ 1.5×** average volume (configurable) and a close in the **upper half** of the bar — ideally the upper third.
- Stop under the handle low. Same 1R / 2R / measured-move plan.
- A **throwback** to the 10 EMA after a valid break is a second entry, not a failure. A close back inside the base is a fail — stand aside.

Configure **Breakout vol** and **Retrace %** in the side panel. The drawer shows the contraction table, checklist ticks, and the next action in plain language.

## Scripts

```bash
npm run dev      # http://127.0.0.1:43147
npm run build
npm run start -- --port 43147
```
