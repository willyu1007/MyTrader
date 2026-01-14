import type { TushareIngestItem } from "@mytrader/shared";

import { config } from "../config";
import { ingestTushare } from "../services/marketService";
import { listPositionIngestItems } from "../storage/positionRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import { getLatestPrices, listAutoIngestItems } from "./marketRepository";

type AutoIngestState = {
  timer: NodeJS.Timeout | null;
  running: boolean;
  warnedMissingToken: boolean;
  sessionId: number;
  businessDb: SqliteDatabase | null;
  marketDb: SqliteDatabase | null;
};

const state: AutoIngestState = {
  timer: null,
  running: false,
  warnedMissingToken: false,
  sessionId: 0,
  businessDb: null,
  marketDb: null
};

export function startAutoIngest(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): void {
  stopAutoIngest();
  state.businessDb = businessDb;
  state.marketDb = marketDb;

  if (!config.autoIngest.enabled) {
    console.log("[mytrader] auto-ingest disabled (MYTRADER_AUTO_INGEST=false).");
    return;
  }

  const intervalMs = config.autoIngest.intervalMs;
  console.log(
    `[mytrader] auto-ingest scheduled every ${Math.round(intervalMs / 60000)} min.`
  );
  void runOnce("startup");
  state.timer = setInterval(() => {
    void runOnce("interval");
  }, intervalMs);
}

export function stopAutoIngest(): void {
  state.sessionId += 1;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.running = false;
  state.businessDb = null;
  state.marketDb = null;
}

export function triggerAutoIngest(reason: "import" | "positions"): void {
  if (!config.autoIngest.enabled) return;
  if (!state.businessDb || !state.marketDb) return;
  void runOnce("trigger", reason);
}

async function runOnce(
  schedule: "startup" | "interval" | "trigger",
  reason?: "import" | "positions"
): Promise<void> {
  if (state.running) return;
  if (!state.businessDb || !state.marketDb) return;
  if (!config.autoIngest.enabled) return;

  const sessionId = state.sessionId;
  const businessDb = state.businessDb;
  const marketDb = state.marketDb;
  const token = config.tushareToken;
  if (!token) {
    if (!state.warnedMissingToken) {
      console.warn(
        "[mytrader] auto-ingest skipped: missing MYTRADER_TUSHARE_TOKEN."
      );
      state.warnedMissingToken = true;
    }
    return;
  }
  state.warnedMissingToken = false;

  state.running = true;
  try {
    const registryItems = await listAutoIngestItems(marketDb);
    if (sessionId !== state.sessionId) return;
    const positionItems = await listPositionIngestItems(businessDb);
    if (sessionId !== state.sessionId) return;
    const items = mergeItems(registryItems, positionItems);
    if (items.length === 0) {
      console.log("[mytrader] auto-ingest skipped: no symbols.");
      return;
    }

    const latest = await getLatestPrices(
      marketDb,
      items.map((item) => item.symbol)
    );
    if (sessionId !== state.sessionId) return;
    const endDate = formatDate(new Date());
    const lookbackDate = formatDate(
      addDays(new Date(), -config.autoIngest.lookbackDays)
    );

    let pulled = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of items) {
      if (sessionId !== state.sessionId) return;
      const startDate = getStartDate(item, latest, lookbackDate);
      if (startDate > endDate) {
        skipped += 1;
        continue;
      }
      try {
        const result = await ingestTushare(marketDb, {
          items: [item],
          startDate,
          endDate
        });
        pulled += result.inserted + result.updated;
      } catch (err) {
        errors += 1;
        console.error(`[mytrader] auto-ingest failed for ${item.symbol}.`);
        console.error(err);
      }
    }

    const reasonLabel = reason ? `/${reason}` : "";
    console.log(
      `[mytrader] auto-ingest done (${schedule}${reasonLabel}): symbols=${items.length} skipped=${skipped} errors=${errors} rows=${pulled}.`
    );
  } finally {
    state.running = false;
  }
}

function mergeItems(
  registryItems: TushareIngestItem[],
  positionItems: TushareIngestItem[]
): TushareIngestItem[] {
  const map = new Map<string, TushareIngestItem>();
  for (const item of registryItems) {
    map.set(item.symbol, item);
  }
  for (const item of positionItems) {
    map.set(item.symbol, item);
  }
  return Array.from(map.values());
}

function getStartDate(
  item: TushareIngestItem,
  latest: Map<string, { tradeDate: string }>,
  fallbackDate: string
): string {
  const latestDate = latest.get(item.symbol)?.tradeDate;
  if (!latestDate) return fallbackDate;
  const parsed = parseDate(latestDate);
  if (!parsed) return fallbackDate;
  return formatDate(addDays(parsed, 1));
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
