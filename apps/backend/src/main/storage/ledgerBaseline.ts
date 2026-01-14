import type { AssetClass, LedgerSource, PortfolioId } from "@mytrader/shared";

import {
  softDeleteLedgerEntryByExternalId,
  upsertLedgerEntryByExternalId
} from "./ledgerRepository";
import { all, transaction } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const BASELINE_SOURCE: LedgerSource = "system";

export interface PositionBaselineInput {
  portfolioId: PortfolioId;
  symbol: string;
  assetClass: AssetClass;
  currency: string;
  quantity: number;
  cost: number | null;
  openDate: string | null;
}

export function getBaselineExternalIdForPosition(input: {
  assetClass: AssetClass;
  symbol: string;
  currency: string;
}): string {
  if (input.assetClass === "cash") {
    return `baseline:cash:${input.currency}`;
  }
  return `baseline:${input.symbol}`;
}

export async function upsertBaselineLedgerFromPosition(
  db: SqliteDatabase,
  input: PositionBaselineInput
): Promise<void> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return;

  const tradeDate = normalizeTradeDate(input.openDate);
  const externalId = getBaselineExternalIdForPosition(input);

  if (input.assetClass === "cash") {
    await upsertLedgerEntryByExternalId(db, {
      portfolioId: input.portfolioId,
      eventType: "cash",
      tradeDate,
      symbol: null,
      side: null,
      quantity: null,
      price: null,
      cashAmount: input.quantity,
      cashCurrency: input.currency,
      fee: null,
      tax: null,
      note: "baseline:positions",
      source: BASELINE_SOURCE,
      externalId,
      meta: { baseline: true, from: "positions" }
    });
    return;
  }

  const price = Number.isFinite(input.cost ?? NaN) ? input.cost : null;

  await upsertLedgerEntryByExternalId(db, {
    portfolioId: input.portfolioId,
    eventType: "adjustment",
    tradeDate,
    symbol: input.symbol,
    side: "buy",
    quantity: input.quantity,
    price,
    cashAmount: null,
    cashCurrency: input.currency,
    fee: null,
    tax: null,
    note: "baseline:positions",
    source: BASELINE_SOURCE,
    externalId,
    meta: { baseline: true, from: "positions" }
  });
}

export async function softDeleteBaselineLedgerForPosition(
  db: SqliteDatabase,
  input: Pick<PositionBaselineInput, "portfolioId" | "assetClass" | "symbol" | "currency">
): Promise<void> {
  const externalId = getBaselineExternalIdForPosition(input);
  await softDeleteLedgerEntryByExternalId(
    db,
    input.portfolioId,
    BASELINE_SOURCE,
    externalId
  );
}

export async function backfillBaselineLedgerFromPositions(
  db: SqliteDatabase
): Promise<{ processed: number }> {
  const rows = await all<{
    portfolio_id: string;
    symbol: string;
    asset_class: string;
    currency: string;
    quantity: number;
    cost: number | null;
    open_date: string | null;
  }>(
    db,
    `
      select portfolio_id, symbol, asset_class, currency, quantity, cost, open_date
      from positions
      where quantity > 0
      order by created_at asc
    `
  );

  await transaction(db, async () => {
    for (const row of rows) {
      await upsertBaselineLedgerFromPosition(db, {
        portfolioId: row.portfolio_id,
        symbol: row.symbol,
        assetClass: row.asset_class as AssetClass,
        currency: row.currency,
        quantity: row.quantity,
        cost: row.cost,
        openDate: row.open_date
      });
    }
  });

  return { processed: rows.length };
}

function normalizeTradeDate(openDate: string | null): string {
  if (openDate && DATE_RE.test(openDate)) return openDate;
  return new Date().toISOString().slice(0, 10);
}

