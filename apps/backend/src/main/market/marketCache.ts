import { all, exec } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export async function ensureMarketCacheSchema(
  db: SqliteDatabase
): Promise<void> {
  await exec(
    db,
    `
      create table if not exists market_meta (
        key text primary key not null,
        value text not null
      );
    `
  );

  await exec(
    db,
    `
      create table if not exists instruments (
        symbol text primary key not null,
        name text,
        asset_class text,
        market text,
        currency text,
        auto_ingest integer not null default 1,
        created_at integer not null,
        updated_at integer not null
      );
    `
  );

  await ensureColumn(
    db,
    "instruments",
    "auto_ingest",
    "integer not null default 1"
  );

  await exec(
    db,
    `
      create index if not exists instruments_auto_ingest
      on instruments (auto_ingest, symbol);
    `
  );

  await exec(
    db,
    `
      create table if not exists daily_prices (
        symbol text not null,
        trade_date text not null,
        open real,
        high real,
        low real,
        close real,
        volume real,
        source text not null,
        ingested_at integer not null,
        primary key (symbol, trade_date)
      );
    `
  );

  await exec(
    db,
    `
      create index if not exists daily_prices_symbol_date
      on daily_prices (symbol, trade_date);
    `
  );
}

async function ensureColumn(
  db: SqliteDatabase,
  table: string,
  column: string,
  definition: string
): Promise<void> {
  const columns = await all<{ name: string }>(
    db,
    `pragma table_info(${table});`
  );
  if (columns.some((entry) => entry.name === column)) return;
  await exec(db, `alter table ${table} add column ${column} ${definition};`);
}
