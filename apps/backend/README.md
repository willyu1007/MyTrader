# Backend app

Electron main process + preload.

## Dev

- Run from repo root: `pnpm dev`
- Or run directly: `pnpm -C apps/backend dev`

This starts the frontend Vite dev server, builds the Electron main/preload bundle, then launches Electron.

## Start

- From repo root: `pnpm start`
- Or run directly (after build): `pnpm -C apps/backend start`

## Environment

- `MYTRADER_TUSHARE_TOKEN`: Tushare API token. Required for manual/auto ingestion.
- `MYTRADER_AUTO_INGEST`: Enable auto ingestion (`true`/`false`). Default: `true`.
- `MYTRADER_AUTO_INGEST_INTERVAL_MINUTES`: Auto ingest interval in minutes. Default: `360`.
- `MYTRADER_AUTO_INGEST_LOOKBACK_DAYS`: Lookback days when no cached price exists. Default: `30`.
- `MYTRADER_DEV_SERVER_URL`: Set by dev script to point Electron to Vite. Do not set manually.
