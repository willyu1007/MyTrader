import type { SqliteDatabase } from "../storage/sqlite";

import {
  getValuationMetricSchedulerConfig,
  triggerValuationObjectiveRefresh
} from "../services/insightService";

type ValuationSchedulerState = {
  timer: NodeJS.Timeout | null;
  sessionId: number;
  businessDb: SqliteDatabase | null;
  marketDb: SqliteDatabase | null;
  running: boolean;
  lastRunAt: number | null;
};

const state: ValuationSchedulerState = {
  timer: null,
  sessionId: 0,
  businessDb: null,
  marketDb: null,
  running: false,
  lastRunAt: null
};

const TICK_MS = 30_000;

export function startValuationMetricScheduler(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): void {
  stopValuationMetricScheduler();
  state.businessDb = businessDb;
  state.marketDb = marketDb;
  const sessionId = state.sessionId;

  state.timer = setInterval(() => {
    void schedulerTick(sessionId).catch((error) => {
      console.error("[mytrader] valuation metric scheduler tick failed");
      console.error(error);
    });
  }, TICK_MS);

  void schedulerTick(sessionId).catch((error) => {
    console.error("[mytrader] valuation metric scheduler init failed");
    console.error(error);
  });
}

export function stopValuationMetricScheduler(): void {
  state.sessionId += 1;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.businessDb = null;
  state.marketDb = null;
  state.running = false;
  state.lastRunAt = null;
}

async function schedulerTick(sessionId: number): Promise<void> {
  if (sessionId !== state.sessionId) return;
  const businessDb = state.businessDb;
  const marketDb = state.marketDb;
  if (!businessDb || !marketDb) return;
  if (state.running) return;

  const config = await getValuationMetricSchedulerConfig(businessDb);
  if (sessionId !== state.sessionId) return;
  if (!config.enabled) return;

  const now = Date.now();
  const intervalMs = config.intervalMinutes * 60 * 1000;
  if (state.lastRunAt !== null && now - state.lastRunAt < intervalMs) {
    return;
  }

  state.running = true;
  try {
    await triggerValuationObjectiveRefresh(businessDb, marketDb, {
      reason: "scheduler"
    });
    state.lastRunAt = Date.now();
  } finally {
    state.running = false;
  }
}
