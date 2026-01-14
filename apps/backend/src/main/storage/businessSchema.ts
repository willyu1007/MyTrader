import { exec, get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";
import { backfillBaselineLedgerFromPositions } from "./ledgerBaseline";

const CURRENT_SCHEMA_VERSION = 3;

export async function ensureBusinessSchema(db: SqliteDatabase): Promise<void> {
  await exec(db, "pragma foreign_keys = on;");
  await exec(
    db,
    `
      create table if not exists app_meta (
        key text primary key not null,
        value text not null
      );
    `
  );

  const row = await get<{ value: string }>(
    db,
    `select value from app_meta where key = ?`,
    ["schema_version"]
  );
  const parsedVersion = row ? Number(row.value) : 0;
  let currentVersion = Number.isFinite(parsedVersion) ? parsedVersion : 0;

  if (!row) {
    await run(
      db,
      `insert into app_meta (key, value) values (?, ?)`,
      ["schema_version", "1"]
    );
  }

  if (currentVersion < 2) {
    currentVersion = 2;
    await exec(
      db,
      `
        create table if not exists portfolios (
          id text primary key not null,
          name text not null,
          base_currency text not null,
          created_at integer not null,
          updated_at integer not null
        );
      `
    );

    await exec(
      db,
      `
        create table if not exists positions (
          id text primary key not null,
          portfolio_id text not null,
          symbol text not null,
          name text,
          asset_class text not null,
          market text not null,
          currency text not null,
          quantity real not null,
          cost real,
          open_date text,
          created_at integer not null,
          updated_at integer not null,
          foreign key (portfolio_id) references portfolios(id) on delete cascade
        );
      `
    );

    await exec(
      db,
      `
        create unique index if not exists positions_portfolio_symbol
        on positions (portfolio_id, symbol);
      `
    );

    await exec(
      db,
      `
        create table if not exists risk_limits (
          id text primary key not null,
          portfolio_id text not null,
          limit_type text not null,
          target text not null,
          threshold real not null,
          created_at integer not null,
          updated_at integer not null,
          foreign key (portfolio_id) references portfolios(id) on delete cascade
        );
      `
    );

    await exec(
      db,
      `
        create index if not exists risk_limits_portfolio
        on risk_limits (portfolio_id);
      `
    );

    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["schema_version", String(currentVersion)]
    );
  }

  if (currentVersion < 3) {
    currentVersion = 3;
    await exec(
      db,
      `
        create table if not exists ledger_entries (
          id text primary key not null,
          portfolio_id text not null,
          event_type text not null,
          trade_date text not null,
          symbol text,
          side text,
          quantity real,
          price real,
          cash_amount real,
          cash_currency text,
          fee real,
          tax real,
          note text,
          source text not null,
          external_id text,
          meta_json text,
          created_at integer not null,
          updated_at integer not null,
          deleted_at integer,
          foreign key (portfolio_id) references portfolios(id) on delete cascade,
          check (side in ('buy', 'sell') or side is null),
          check (quantity is null or quantity >= 0),
          check (price is null or price >= 0),
          check (fee is null or fee >= 0),
          check (tax is null or tax >= 0)
        );
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_date
        on ledger_entries (portfolio_id, trade_date, created_at);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_symbol_date
        on ledger_entries (portfolio_id, symbol, trade_date);
      `
    );

    await exec(
      db,
      `
        create index if not exists ledger_entries_portfolio_type_date
        on ledger_entries (portfolio_id, event_type, trade_date);
      `
    );

    await exec(
      db,
      `
        create unique index if not exists ledger_entries_portfolio_source_external_id
        on ledger_entries (portfolio_id, source, external_id);
      `
    );

    await backfillBaselineLedgerFromPositions(db);
    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["ledger_baseline_backfill_v1", "1"]
    );

    await run(
      db,
      `insert or replace into app_meta (key, value) values (?, ?)`,
      ["schema_version", String(currentVersion)]
    );
  }

  if (currentVersion >= 3) {
    const baselineRow = await get<{ value: string }>(
      db,
      `select value from app_meta where key = ?`,
      ["ledger_baseline_backfill_v1"]
    );
    if (!baselineRow) {
      await backfillBaselineLedgerFromPositions(db);
      await run(
        db,
        `insert or replace into app_meta (key, value) values (?, ?)`,
        ["ledger_baseline_backfill_v1", "1"]
      );
    }
  }

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `[mytrader] business DB schema_version=${currentVersion} is newer than supported=${CURRENT_SCHEMA_VERSION}.`
    );
  }
}
