import type { SqliteDatabase } from "../storage/sqlite";
import { triggerOpportunityRulesOnScheduledFallback } from "../services/opportunityService";

type OpportunitySchedulerState = {
  timer: NodeJS.Timeout | null;
  sessionId: number;
  businessDb: SqliteDatabase | null;
  marketDb: SqliteDatabase | null;
  lastTriggeredDateKey: string | null;
  running: boolean;
};

const state: OpportunitySchedulerState = {
  timer: null,
  sessionId: 0,
  businessDb: null,
  marketDb: null,
  lastTriggeredDateKey: null,
  running: false
};

const TICK_MS = 30_000;
const FALLBACK_TIME = "20:30";
const FALLBACK_TIMEZONE = "Asia/Shanghai";

export function startOpportunityScheduler(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase
): void {
  stopOpportunityScheduler();
  state.businessDb = businessDb;
  state.marketDb = marketDb;
  const sessionId = state.sessionId;

  state.timer = setInterval(() => {
    void schedulerTick(sessionId, false).catch((error) => {
      console.error("[mytrader] opportunity scheduler tick failed");
      console.error(error);
    });
  }, TICK_MS);

  void schedulerTick(sessionId, true).catch((error) => {
    console.error("[mytrader] opportunity scheduler init failed");
    console.error(error);
  });
}

export function stopOpportunityScheduler(): void {
  state.sessionId += 1;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.businessDb = null;
  state.marketDb = null;
  state.lastTriggeredDateKey = null;
  state.running = false;
}

async function schedulerTick(sessionId: number, allowCatchUp: boolean): Promise<void> {
  if (sessionId !== state.sessionId) return;
  if (state.running) return;

  const businessDb = state.businessDb;
  const marketDb = state.marketDb;
  if (!businessDb || !marketDb) return;

  const now = getZonedNow(FALLBACK_TIMEZONE);
  const { hours, minutes } = parseRunAt(FALLBACK_TIME);
  const isExactMinute = now.hour === hours && now.minute === minutes;
  const isCatchUpTime =
    allowCatchUp &&
    (now.hour > hours || (now.hour === hours && now.minute >= minutes));
  if (!isExactMinute && !isCatchUpTime) return;
  if (state.lastTriggeredDateKey === now.dateKey) return;

  state.running = true;
  state.lastTriggeredDateKey = now.dateKey;
  try {
    await triggerOpportunityRulesOnScheduledFallback({ businessDb, marketDb });
  } finally {
    state.running = false;
  }
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

function parseRunAt(runAt: string): { hours: number; minutes: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(runAt);
  if (!match) return { hours: 20, minutes: 30 };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return { hours: 20, minutes: 30 };
  }
  return {
    hours: Math.max(0, Math.min(23, Math.floor(hours))),
    minutes: Math.max(0, Math.min(59, Math.floor(minutes)))
  };
}
