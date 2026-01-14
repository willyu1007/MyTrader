import type {
  ImportHoldingsCsvInput,
  ImportPricesCsvInput,
  MarketImportResult,
  TushareIngestInput
} from "@mytrader/shared";

import { parseHoldingsCsv, parsePricesCsv } from "../market/csvImport";
import { upsertInstruments, upsertPrices } from "../market/marketRepository";
import { fetchTushareDailyPrices } from "../market/tushareClient";
import { config } from "../config";
import { upsertPositions } from "../storage/positionRepository";
import { upsertBaselineLedgerFromPosition } from "../storage/ledgerBaseline";
import type { SqliteDatabase } from "../storage/sqlite";

export async function importHoldingsCsv(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  input: ImportHoldingsCsvInput
): Promise<MarketImportResult> {
  const parsed = parseHoldingsCsv(input.filePath);

  await upsertInstruments(
    marketDb,
    parsed.rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      market: row.market,
      currency: row.currency
    }))
  );

  const result = await upsertPositions(
    businessDb,
    input.portfolioId,
    parsed.rows.map((row) => ({
      portfolioId: input.portfolioId,
      symbol: row.symbol,
      name: row.name,
      assetClass: row.assetClass,
      market: row.market,
      currency: row.currency,
      quantity: row.quantity,
      cost: row.cost,
      openDate: row.openDate
    }))
  );

  for (const row of parsed.rows) {
    await upsertBaselineLedgerFromPosition(businessDb, {
      portfolioId: input.portfolioId,
      symbol: row.symbol,
      assetClass: row.assetClass,
      currency: row.currency,
      quantity: row.quantity,
      cost: row.cost,
      openDate: row.openDate
    });
  }

  return {
    inserted: result.inserted,
    updated: result.updated,
    skipped: parsed.skipped,
    warnings: parsed.warnings
  };
}

export async function importPricesCsv(
  marketDb: SqliteDatabase,
  input: ImportPricesCsvInput
): Promise<MarketImportResult> {
  const parsed = parsePricesCsv(input.filePath, input.source);
  await upsertPrices(marketDb, parsed.rows);

  return {
    inserted: parsed.rows.length,
    updated: 0,
    skipped: parsed.skipped,
    warnings: parsed.warnings
  };
}

export async function ingestTushare(
  marketDb: SqliteDatabase,
  input: TushareIngestInput
): Promise<MarketImportResult> {
  const token = config.tushareToken;
  if (!token) {
    throw new Error("Missing MYTRADER_TUSHARE_TOKEN.");
  }

  await upsertInstruments(
    marketDb,
    input.items.map((item) => ({
      symbol: item.symbol,
      assetClass: item.assetClass,
      name: null,
      market: null,
      currency: null
    }))
  );

  const prices = await fetchTushareDailyPrices(
    token,
    input.items,
    input.startDate,
    input.endDate ?? null
  );

  await upsertPrices(marketDb, prices);

  return {
    inserted: prices.length,
    updated: 0,
    skipped: 0,
    warnings: []
  };
}
