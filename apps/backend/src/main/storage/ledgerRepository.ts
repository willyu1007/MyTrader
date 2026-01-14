import crypto from "node:crypto";

import type {
  CreateLedgerEntryInput,
  LedgerEntry,
  LedgerEntryId,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  PortfolioId,
  UpdateLedgerEntryInput
} from "@mytrader/shared";

import { all, get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

interface DbLedgerEntryRow {
  id: string;
  portfolio_id: string;
  event_type: string;
  trade_date: string;
  symbol: string | null;
  side: string | null;
  quantity: number | null;
  price: number | null;
  cash_amount: number | null;
  cash_currency: string | null;
  fee: number | null;
  tax: number | null;
  note: string | null;
  source: string;
  external_id: string | null;
  meta_json: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export async function listLedgerEntriesByPortfolio(
  db: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<LedgerEntry[]> {
  const rows = await all<DbLedgerEntryRow>(
    db,
    `
      select id, portfolio_id, event_type, trade_date, symbol, side, quantity, price,
             cash_amount, cash_currency, fee, tax, note, source, external_id, meta_json,
             created_at, updated_at, deleted_at
      from ledger_entries
      where portfolio_id = ?
        and deleted_at is null
      order by trade_date asc, created_at asc
    `,
    [portfolioId]
  );

  return rows.map(toLedgerEntry);
}

export async function createLedgerEntry(
  db: SqliteDatabase,
  input: CreateLedgerEntryInput
): Promise<LedgerEntry> {
  const now = Date.now();
  const id = crypto.randomUUID();

  await run(
    db,
    `
      insert into ledger_entries (
        id, portfolio_id, event_type, trade_date, symbol, side, quantity, price,
        cash_amount, cash_currency, fee, tax, note, source, external_id, meta_json,
        created_at, updated_at, deleted_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      input.portfolioId,
      input.eventType,
      input.tradeDate,
      input.symbol ?? null,
      input.side ?? null,
      input.quantity ?? null,
      input.price ?? null,
      input.cashAmount ?? null,
      input.cashCurrency ?? null,
      input.fee ?? null,
      input.tax ?? null,
      input.note ?? null,
      input.source,
      input.externalId ?? null,
      input.meta ? JSON.stringify(input.meta) : null,
      now,
      now,
      null
    ]
  );

  return {
    id,
    portfolioId: input.portfolioId,
    eventType: input.eventType,
    tradeDate: input.tradeDate,
    symbol: input.symbol ?? null,
    side: input.side ?? null,
    quantity: input.quantity ?? null,
    price: input.price ?? null,
    cashAmount: input.cashAmount ?? null,
    cashCurrency: input.cashCurrency ?? null,
    fee: input.fee ?? null,
    tax: input.tax ?? null,
    note: input.note ?? null,
    source: input.source,
    externalId: input.externalId ?? null,
    meta: input.meta ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

export async function updateLedgerEntry(
  db: SqliteDatabase,
  input: UpdateLedgerEntryInput
): Promise<LedgerEntry> {
  const now = Date.now();
  await run(
    db,
    `
      update ledger_entries
      set portfolio_id = ?, event_type = ?, trade_date = ?, symbol = ?, side = ?, quantity = ?,
          price = ?, cash_amount = ?, cash_currency = ?, fee = ?, tax = ?, note = ?,
          source = ?, external_id = ?, meta_json = ?, updated_at = ?
      where id = ?
        and deleted_at is null
    `,
    [
      input.portfolioId,
      input.eventType,
      input.tradeDate,
      input.symbol ?? null,
      input.side ?? null,
      input.quantity ?? null,
      input.price ?? null,
      input.cashAmount ?? null,
      input.cashCurrency ?? null,
      input.fee ?? null,
      input.tax ?? null,
      input.note ?? null,
      input.source,
      input.externalId ?? null,
      input.meta ? JSON.stringify(input.meta) : null,
      now,
      input.id
    ]
  );

  const row = await get<DbLedgerEntryRow>(
    db,
    `
      select id, portfolio_id, event_type, trade_date, symbol, side, quantity, price,
             cash_amount, cash_currency, fee, tax, note, source, external_id, meta_json,
             created_at, updated_at, deleted_at
      from ledger_entries
      where id = ?
    `,
    [input.id]
  );

  if (!row || row.deleted_at !== null) throw new Error("Ledger entry not found.");
  return toLedgerEntry(row);
}

export async function softDeleteLedgerEntry(
  db: SqliteDatabase,
  ledgerEntryId: LedgerEntryId
): Promise<void> {
  const now = Date.now();
  await run(
    db,
    `
      update ledger_entries
      set deleted_at = ?, updated_at = ?
      where id = ?
        and deleted_at is null
    `,
    [now, now, ledgerEntryId]
  );
}

export async function softDeleteLedgerEntryByExternalId(
  db: SqliteDatabase,
  portfolioId: PortfolioId,
  source: LedgerSource,
  externalId: string
): Promise<void> {
  const now = Date.now();
  await run(
    db,
    `
      update ledger_entries
      set deleted_at = ?, updated_at = ?
      where portfolio_id = ?
        and source = ?
        and external_id = ?
        and deleted_at is null
    `,
    [now, now, portfolioId, source, externalId]
  );
}

export async function upsertLedgerEntryByExternalId(
  db: SqliteDatabase,
  input: CreateLedgerEntryInput & { externalId: string }
): Promise<LedgerEntry> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const metaJson = input.meta ? JSON.stringify(input.meta) : null;

  await run(
    db,
    `
      insert into ledger_entries (
        id, portfolio_id, event_type, trade_date, symbol, side, quantity, price,
        cash_amount, cash_currency, fee, tax, note, source, external_id, meta_json,
        created_at, updated_at, deleted_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(portfolio_id, source, external_id) do update set
        event_type = excluded.event_type,
        trade_date = excluded.trade_date,
        symbol = excluded.symbol,
        side = excluded.side,
        quantity = excluded.quantity,
        price = excluded.price,
        cash_amount = excluded.cash_amount,
        cash_currency = excluded.cash_currency,
        fee = excluded.fee,
        tax = excluded.tax,
        note = excluded.note,
        meta_json = excluded.meta_json,
        updated_at = excluded.updated_at,
        deleted_at = null
    `,
    [
      id,
      input.portfolioId,
      input.eventType,
      input.tradeDate,
      input.symbol ?? null,
      input.side ?? null,
      input.quantity ?? null,
      input.price ?? null,
      input.cashAmount ?? null,
      input.cashCurrency ?? null,
      input.fee ?? null,
      input.tax ?? null,
      input.note ?? null,
      input.source,
      input.externalId,
      metaJson,
      now,
      now,
      null
    ]
  );

  const row = await get<DbLedgerEntryRow>(
    db,
    `
      select id, portfolio_id, event_type, trade_date, symbol, side, quantity, price,
             cash_amount, cash_currency, fee, tax, note, source, external_id, meta_json,
             created_at, updated_at, deleted_at
      from ledger_entries
      where portfolio_id = ?
        and source = ?
        and external_id = ?
      limit 1
    `,
    [input.portfolioId, input.source, input.externalId]
  );

  if (!row || row.deleted_at !== null) throw new Error("Ledger entry upsert failed.");
  return toLedgerEntry(row);
}

function toLedgerEntry(row: DbLedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    eventType: row.event_type as LedgerEventType,
    tradeDate: row.trade_date,
    symbol: row.symbol,
    side: row.side as LedgerSide | null,
    quantity: row.quantity,
    price: row.price,
    cashAmount: row.cash_amount,
    cashCurrency: row.cash_currency,
    fee: row.fee,
    tax: row.tax,
    note: row.note,
    source: row.source as LedgerSource,
    externalId: row.external_id,
    meta: parseMeta(row.meta_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function parseMeta(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
