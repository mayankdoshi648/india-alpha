# India Market Desk

A Nifty 50 / Nifty 500 market-view dashboard: index tape with EMA posture, FII/DII and option positioning, moving-average breadth, sector rotation, a full universe inspector, and a setup scanner (Stage 2, VCP, volume surge, divergences, pivots, oversold pullbacks).

Quotes, historical candles and the Nifty option chain come from **DhanHQ** when you add credentials. **NSE India** is used for FII/DII cash flow and index last prices when the public feed is reachable. If neither is available, the desk still runs on a deterministic tape anchored to the 8 Sep 2026 close (Nifty 23,635) so every panel stays usable.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional — add Dhan keys for live data
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147). The first paint is server-rendered so the tape shows even before client JS hydrates.

For a production-like local run (required if a preview iframe blocks `/_next` from `next dev`):

```bash
npm run build && npm run start
```

## DhanHQ

Create an API access token in the Dhan web terminal, then set:

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
2. **Institutional F&O radar** — FII/DII net flow, India VIX regime, Nifty PCR, max pain.
3. **EMA breadth gauges** — % of the universe above 10/20 (short), 50 (medium), 200 (long) on D/W/M.
4. **Sector health** — sector tiles with the same EMA tape, constituent heatmap, 4-quadrant rotation (leading / weakening / lagging / improving), turnover share, A/D and Chaikin Money Flow.
5. **Universe inspector** — watchlist mark, cap, sector, CMP, 1D/1W/1M, RSI(14), 7-day sparkline, volume, 1D/9D spike, gap %, EMAs, % vs 20 EMA, 52-week range, previous/next earnings and earnings-day impact.
6. **Setup scanner** — Stage 2 checklist, qualified base breakouts, volume surge, VCP, bullish/bearish/hidden divergence, pivot reclaim, oversold pullback.
7. **Market breadth** — seven indicators with a 60-session drill-down.
8. **Trend filters** — EMA stack, convergence, 10/20 bullish crosses, RSI above its MA, daily and/or weekly.
9. **Settings** — EMA periods, RSI, volume-spike and breakout thresholds, Stage 2 near-high/low filters, plus three templates.
10. **Watchlists** — three private lists (Core, Breakouts, Research) and per-stock research notes in this browser.

## Scripts

```bash
npm run dev      # http://127.0.0.1:43147
npm run build
npm run start -- --port 43147
```
