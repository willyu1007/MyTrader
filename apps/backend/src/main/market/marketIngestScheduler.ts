import type { MarketIngestSchedulerConfig } from "@mytrader/shared";

import {
  enqueueManagedIngest
} from "./ingestOrchestrator";
import {
  getMarketIngestSchedulerConfig
} from "../storage/marketSettingsRepository";
import type { SqliteDatabase } from "../storage/sqlite";

type SchedulerState = {
  timer: NodeJS.Timeout | null;
  sessionId: number;
  businessDb: SqliteDatabase | null;
  lastTriggeredDateKey: string | null;
};

const state: SchedulerState = {
  timer: null,
  sessionId: 0,
  businessDb: null,
  lastTriggeredDateKey: null
};

const TICK_MS = 30_000;

export function startMarketIngestScheduler(
  businessDb: SqliteDatabase,
  _marketDb: SqliteDatabase,
  _analysisDbPath: string
): void {
  stopMarketIngestScheduler();
  state.businessDb = businessDb;
  const sessionId = state.sessionId;

  void initializeSession(sessionId).catch((err) => {
    console.error("[mytrader] market ingest scheduler init failed");
    console.error(err);
  });

  state.timer = setInterval(() => {
    void schedulerTick(sessionId).catch((err) => {
      console.error("[mytrader] market ingest scheduler tick failed");
      console.error(err);
    });
  }, TICK_MS);
}

export function stopMarketIngestScheduler(): void {
  state.sessionId += 1;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.businessDb = null;
  state.lastTriggeredDateKey = null;
}

export async function triggerMarketIngest(
  reason: "startup" | "manual" | "schedule",
  scopeOverride?: "targets" | "universe" | "both"
): Promise<void> {
  const businessDb = state.businessDb;
  if (!businessDb) return;
  const config = await getMarketIngestSchedulerConfig(businessDb);
  const scope =
    scopeOverride ??
    (reason === "manual" ? "both" : config.scope);

  await enqueueManagedIngest({
    scope,
    mode: reason === "manual" ? "manual" : "daily",
    source: reason === "manual" ? "manual" : reason,
    meta: { schedule: reason }
  });
}

async function initializeSession(sessionId: number): Promise<void> {
  if (sessionId !== state.sessionId) return;
  const businessDb = state.businessDb;
  if (!businessDb) return;
  const config = await getMarketIngestSchedulerConfig(businessDb);
  if (sessionId !== state.sessionId) return;

  if (config.runOnStartup) {
    await enqueueManagedIngest({
      scope: config.scope,
      mode: "daily",
      source: "startup",
      meta: { schedule: "startup" }
    });
  }

  if (config.catchUpMissed) {
    const nowParts = getZonedNow(config.timezone);
    const schedule = parseRunAt(config.runAt);
    if (
      nowParts.hour > schedule.hours ||
      (nowParts.hour === schedule.hours && nowParts.minute >= schedule.minutes)
    ) {
      state.lastTriggeredDateKey = nowParts.dateKey;
      await enqueueManagedIngest({
        scope: config.scope,
        mode: "daily",
        source: "schedule",
        meta: { schedule: "catchup" }
      });
    }
  }

  await schedulerTick(sessionId);
}

async function schedulerTick(sessionId: number): Promise<void> {
  if (sessionId !== state.sessionId) return;
  const businessDb = state.businessDb;
  if (!businessDb) return;

  const config = await getMarketIngestSchedulerConfig(businessDb);
  if (sessionId !== state.sessionId) return;
  if (!config.enabled) return;

  const nowParts = getZonedNow(config.timezone);
  const schedule = parseRunAt(config.runAt);
  const matched =
    nowParts.hour === schedule.hours && nowParts.minute === schedule.minutes;
  if (!matched) return;
  if (state.lastTriggeredDateKey === nowParts.dateKey) return;

  state.lastTriggeredDateKey = nowParts.dateKey;
  await enqueueManagedIngest({
    scope: config.scope,
    mode: "daily",
    source: "schedule",
    meta: { schedule: "schedule" }
  });
}

function getZonedNow(timezone: string): {
  dateKey: string;
  hour: number;
  minute: number;
} {
  const formatter = getFormatter(timezone);
  const parts = formatter.formatToParts(new Date());
  const year = getNumericPart(parts, "year");
  const month = getNumericPart(parts, "month");
  const day = getNumericPart(parts, "day");
  const hour = getNumericPart(parts, "hour");
  const minute = getNumericPart(parts, "minute");
  const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
  return { dateKey, hour, minute };
}

function getFormatter(timezone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

function getNumericPart(
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month" | "day" | "hour" | "minute"
): number {
  const raw = parts.find((part) => part.type === type)?.value ?? "0";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function parseRunAt(runAt: MarketIngestSchedulerConfig["runAt"]): {
  hours: number;
  minutes: number;
} {
  const match = /^(\d{2}):(\d{2})$/.exec(runAt);
  if (!match) return { hours: 19, minutes: 30 };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return { hours, minutes };
}
