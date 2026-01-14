type AutoIngestConfig = {
  enabled: boolean;
  intervalMs: number;
  lookbackDays: number;
};

export type BackendConfig = {
  devServerUrl: string | null;
  isDev: boolean;
  tushareToken: string | null;
  autoIngest: AutoIngestConfig;
};

const config = buildConfig();

export { config };

function buildConfig(): BackendConfig {
  const devServerUrl = readOptionalString("MYTRADER_DEV_SERVER_URL");
  const autoIngestEnabled = readBoolean("MYTRADER_AUTO_INGEST", true);
  const autoIngestIntervalMinutes = readInteger(
    "MYTRADER_AUTO_INGEST_INTERVAL_MINUTES",
    360,
    { min: 5, max: 1440 }
  );
  const autoIngestLookbackDays = readInteger(
    "MYTRADER_AUTO_INGEST_LOOKBACK_DAYS",
    30,
    { min: 1, max: 365 }
  );

  return {
    devServerUrl,
    isDev: Boolean(devServerUrl),
    tushareToken: readOptionalString("MYTRADER_TUSHARE_TOKEN"),
    autoIngest: {
      enabled: autoIngestEnabled,
      intervalMs: autoIngestIntervalMinutes * 60 * 1000,
      lookbackDays: autoIngestLookbackDays
    }
  };
}

function readOptionalString(key: string): string | null {
  const raw = process.env[key];
  if (!raw) return null;
  const value = raw.trim();
  return value ? value : null;
}

function readBoolean(key: string, defaultValue: boolean): boolean {
  const raw = readOptionalString(key);
  if (raw === null) return defaultValue;
  switch (raw.toLowerCase()) {
    case "true":
    case "1":
    case "yes":
    case "y":
      return true;
    case "false":
    case "0":
    case "no":
    case "n":
      return false;
    default:
      throw new Error(`[mytrader] Invalid boolean config for ${key}.`);
  }
}

function readInteger(
  key: string,
  defaultValue: number,
  range?: { min?: number; max?: number }
): number {
  const raw = readOptionalString(key);
  if (raw === null) return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`[mytrader] Invalid numeric config for ${key}.`);
  }
  if (range?.min !== undefined && value < range.min) {
    throw new Error(`[mytrader] ${key} must be >= ${range.min}.`);
  }
  if (range?.max !== undefined && value > range.max) {
    throw new Error(`[mytrader] ${key} must be <= ${range.max}.`);
  }
  return value;
}
