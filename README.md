# India Market Desk

A single-screen Nifty 50 / Nifty 500 desk: index tape, mosaic, sector rotation, universe, alerts, swing setups (VCP / breakout), F&O and breadth on one page.

Quotes, historical candles and the Nifty option chain come from **DhanHQ** when you add credentials. **NSE India** is used for index last prices and FII/DII when the public feed is reachable. Equity last prices fall back to **Yahoo Finance** (`.NS`) because NSE’s stock board is blocked from most cloud IPs — that is why a public deploy used to show the demo tape instead of the real share. If neither is available, the desk still runs on a deterministic tape anchored to the 8 Sep 2026 close (Nifty 23,635) so every panel stays usable.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional server-side fallback; you can also paste Dhan keys on the page
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). The shell paints immediately; the tape then loads from `/data/nifty50.json` (or `/api/market` in `next dev`).

For a production-like local run (required if a preview iframe blocks `/_next` from `next dev`):

```bash
npm run build && npm run start
```

## DhanHQ

Paste the 24-hour **Access Token** (JWT, starts with `eyJ`) from [web.dhan.co](https://web.dhan.co) → My Profile → Access DhanHQ APIs. You also need the **Data APIs** plan subscribed there — a trading token without data returns Dhan 806. Client ID is optional — the desk reads it from Dhan. Do not paste the API key.

Dhan does not issue a never-expiring data token. This desk calls Dhan’s **RenewToken** while the JWT is still valid, so if you open the page at least once a day you should not have to paste again. If the token expires unused, generate a new one on Dhan Web.

`.env.local` still works as a server-side fallback:

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

The desk is **one page**. The first paint is a light shell; the tape loads from baked `/data/*.json` (or `/api/market` when Dhan keys or custom settings are in play) so the page is not a 1MB HTML dump. Indices, mosaic, sector rotation, universe, alerts, setups, F&O and breadth sit together so you can watch without switching tabs. Configure / Dhan keys open a side panel.

1. **Watch strip** — Nifty 50 or Nifty 500 (whichever group is selected), Bank Nifty, VIX, PCR, A/D, FII.
2. **Index tape + mosaic + gainers/losers** — left column. The mosaic and movers follow the selected group.
3. **Sector rotation + universe** — centre. The table lists every name in the selected group (50 or ~500).
4. **Alerts, swing setups (VCP / breakout), F&O (Nifty + stocks), EMA breadth** — right column, scored on the same group.
5. **Stock drawer** — click any name for chart, VCP contraction legs, breakout pivot/stop/1R/2R, stock option chain, PCR/IV and notes.

Toggle **Nifty 50** / **Nifty 500** in the header. The whole desk recalculates: heat map, universe, breadth, alerts and swing setups. The choice is remembered in this browser.

## Equity swing: VCP and breakouts

The right-hand **Swing · VCP / breakout** list and the stock drawer score two Minervini / O’Neil-style patterns on daily bars.

### Volatility Contraction Pattern (VCP)

A VCP is a Stage 2 name that coils through **successively tighter pullbacks** as supply leaves the stock.

- Windows: nested 34 → 21 → 13 → 8 day ranges at the right edge (and swing-high pullbacks in the last 60 days as a fallback). Need **at least two** contractions, each shallower than the last.
- Last contraction **≤ 8%** deep and no more than ~60% of the first leg. Volume should dry up vs the prior three weeks.
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

## Open on a phone or another laptop

Import this repo in [Vercel](https://vercel.com/new). The build bakes Nifty 50 and Nifty 500 into static JSON, so the public `*.vercel.app` URL loads the desk without waiting on a serverless snapshot. Dhan keys stay in that browser only — they are not stored on the server unless you set `DHAN_ACCESS_TOKEN` in the host’s environment.

`npm run build` writes `/data/nifty50.json` and `/data/nifty500.json` first. Local `next dev` still builds the tape on demand if those files are missing.


## Scripts

```bash
npm run dev      # http://127.0.0.1:43147
npm run build
npm run start -- --port 43147
```
