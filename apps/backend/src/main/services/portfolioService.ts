import type {
  DataQualityLevel,
  MarketDataQuality,
  PortfolioId,
  PortfolioSnapshot,
  PositionValuation
} from "@mytrader/shared";

import { getInstrumentsBySymbols, getLatestPrices } from "../market/marketRepository";
import { listLedgerEntriesByPortfolio } from "../storage/ledgerRepository";
import { listPositionsByPortfolio } from "../storage/positionRepository";
import { getPortfolio } from "../storage/portfolioRepository";
import { listRiskLimits } from "../storage/riskLimitRepository";
import type { SqliteDatabase } from "../storage/sqlite";
import { buildPortfolioPerformance } from "./performanceService";
import { derivePositionsFromLedger, type PositionMetadata } from "./positionEngine";

export async function getPortfolioSnapshot(
  businessDb: SqliteDatabase,
  marketDb: SqliteDatabase,
  portfolioId: PortfolioId
): Promise<PortfolioSnapshot> {
  const portfolio = await getPortfolio(businessDb, portfolioId);
  if (!portfolio) throw new Error("未找到组合。");

  const storedPositions = await listPositionsByPortfolio(businessDb, portfolioId);
  const ledgerEntries = await listLedgerEntriesByPortfolio(businessDb, portfolioId);
  const symbolSet = new Set<string>();
  storedPositions.forEach((position) => symbolSet.add(position.symbol));
  ledgerEntries.forEach((entry) => {
    if (entry.symbol) symbolSet.add(entry.symbol);
  });
  const symbolsForMetadata = Array.from(symbolSet.values());
  const instruments = await getInstrumentsBySymbols(
    marketDb,
    symbolsForMetadata
  );
  const metadataBySymbol = new Map<string, PositionMetadata>();
  storedPositions.forEach((position) => {
    metadataBySymbol.set(position.symbol, {
      id: position.id,
      symbol: position.symbol,
      name: position.name,
      assetClass: position.assetClass,
      market: position.market,
      currency: position.currency
    });
  });
  instruments.forEach((instrument, symbol) => {
    const existing = metadataBySymbol.get(symbol);
    if (existing) {
      metadataBySymbol.set(symbol, {
        ...existing,
        name: existing.name ?? instrument.name,
        market: existing.market ?? instrument.market ?? "CN",
        currency: existing.currency ?? instrument.currency ?? portfolio.baseCurrency
      });
      return;
    }
    metadataBySymbol.set(symbol, {
      symbol,
      name: instrument.name,
      assetClass: instrument.assetClass ?? "stock",
      market: instrument.market ?? "CN",
      currency: instrument.currency ?? portfolio.baseCurrency
    });
  });

  const hasHoldingsLedgerEntries = ledgerEntries.some(
    (entry) => entry.eventType === "trade" || entry.eventType === "adjustment"
  );
  const hasCashLedgerEntries = ledgerEntries.some(
    (entry) => entry.cashAmount !== null
  );

  const derived =
    hasHoldingsLedgerEntries || hasCashLedgerEntries
      ? derivePositionsFromLedger({
          portfolioId,
          entries: ledgerEntries,
          metadataBySymbol,
          baseCurrency: portfolio.baseCurrency
        })
      : null;

  const positions = derived
    ? hasHoldingsLedgerEntries
      ? derived.positions
      : [
          ...storedPositions.filter((position) => position.assetClass !== "cash"),
          ...derived.positions.filter((position) => position.assetClass === "cash")
        ].sort((a, b) => a.symbol.localeCompare(b.symbol))
    : storedPositions;
  const riskLimits = await listRiskLimits(businessDb, portfolioId);
  const symbolsForPrices = positions
    .filter((position) => position.assetClass !== "cash")
    .map((position) => position.symbol);
  const latestPrices = await getLatestPrices(marketDb, symbolsForPrices);

  const valuations: PositionValuation[] = positions.map((position) => {
    if (position.assetClass === "cash") {
      const marketValue = position.quantity;
      const costValue = marketValue;
      return {
        position,
        latestPrice: 1,
        priceDate: null,
        marketValue,
        costValue,
        pnl: 0,
        pnlPct: 0
      };
    }

    const latest = latestPrices.get(position.symbol);
    const latestPrice = latest?.close ?? null;
    const priceDate = latest?.tradeDate ?? null;
    const marketValue =
      latestPrice === null ? null : latestPrice * position.quantity;
    const costValue =
      position.cost === null ? null : position.cost * position.quantity;
    const pnl =
      marketValue === null || costValue === null ? null : marketValue - costValue;
    const pnlPct =
      pnl === null || costValue === null || costValue === 0
        ? null
        : pnl / costValue;

    return {
      position,
      latestPrice,
      priceDate,
      marketValue,
      costValue,
      pnl,
      pnlPct
    };
  });

  const totalMarketValue = valuations.reduce((sum, val) => {
    return sum + (val.marketValue ?? 0);
  }, 0);

  const totalCostValue = valuations.reduce((sum, val) => {
    return sum + (val.costValue ?? 0);
  }, 0);

  const bySymbol = valuations.map((val) => ({
    key: val.position.symbol,
    label: val.position.name ?? val.position.symbol,
    weight: totalMarketValue > 0 ? (val.marketValue ?? 0) / totalMarketValue : 0,
    marketValue: val.marketValue ?? 0
  }));

  const byAssetClassMap = new Map<
    string,
    { label: string; marketValue: number }
  >();
  for (const val of valuations) {
    const key = val.position.assetClass;
    const existing = byAssetClassMap.get(key);
    const marketValue = val.marketValue ?? 0;
    if (existing) {
      existing.marketValue += marketValue;
    } else {
      byAssetClassMap.set(key, {
        label: formatAssetClassLabel(key),
        marketValue
      });
    }
  }

  const byAssetClass = Array.from(byAssetClassMap.entries()).map(
    ([key, entry]) => ({
      key,
      label: entry.label,
      weight: totalMarketValue > 0 ? entry.marketValue / totalMarketValue : 0,
      marketValue: entry.marketValue
    })
  );

  const riskWarnings = riskLimits
    .map((limit) => {
      if (limit.limitType === "position_weight") {
        const exposure = bySymbol.find((entry) => entry.key === limit.target);
        const actual = exposure?.weight ?? 0;
        if (actual <= limit.threshold) return null;
        return {
          limitId: limit.id,
          limitType: limit.limitType,
          target: limit.target,
          threshold: limit.threshold,
          actual,
          message: `持仓 ${limit.target} 权重 ${formatPct(actual)} 超过上限 ${formatPct(limit.threshold)}。`
        };
      }
      if (limit.limitType === "asset_class_weight") {
        const exposure = byAssetClass.find(
          (entry) => entry.key === limit.target
        );
        const actual = exposure?.weight ?? 0;
        if (actual <= limit.threshold) return null;
        const targetLabel = formatAssetClassLabel(limit.target);
        return {
          limitId: limit.id,
          limitType: limit.limitType,
          target: limit.target,
          threshold: limit.threshold,
          actual,
          message: `资产类别 ${targetLabel} 权重 ${formatPct(actual)} 超过上限 ${formatPct(limit.threshold)}。`
        };
      }
      return null;
    })
    .filter((warning): warning is NonNullable<typeof warning> => Boolean(warning));

  const priceAsOf = valuations
    .map((val) => val.priceDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .pop() ?? null;

  const performance = await buildPortfolioPerformance({
    ledgerEntries,
    marketDb,
    endValue: totalMarketValue,
    priceAsOf
  });
  const dataQuality = buildMarketDataQuality(valuations, priceAsOf);

  return {
    portfolio,
    positions: valuations,
    totals: {
      marketValue: totalMarketValue,
      costValue: totalCostValue,
      pnl: totalMarketValue - totalCostValue
    },
    performance,
    dataQuality,
    exposures: {
      byAssetClass,
      bySymbol
    },
    riskLimits,
    riskWarnings,
    priceAsOf
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatAssetClassLabel(value: string): string {
  switch (value) {
    case "stock":
      return "股票";
    case "etf":
      return "ETF";
    case "cash":
      return "现金";
    default:
      return value;
  }
}

const COVERAGE_OK_THRESHOLD = 0.98;
const COVERAGE_PARTIAL_THRESHOLD = 0.95;
const FRESHNESS_OK_DAYS = 3;
const FRESHNESS_PARTIAL_DAYS = 5;

function buildMarketDataQuality(
  valuations: PositionValuation[],
  priceAsOf: string | null
): MarketDataQuality | null {
  if (valuations.length === 0) return null;

  const nonCash = valuations.filter(
    (valuation) => valuation.position.assetClass !== "cash"
  );
  if (nonCash.length === 0) {
    return {
      overallLevel: "ok",
      coverageLevel: "ok",
      freshnessLevel: "ok",
      coverageRatio: 1,
      freshnessDays: 0,
      asOfDate: priceAsOf,
      missingSymbols: [],
      notes: []
    };
  }

  let coveredValue = 0;
  let totalValue = 0;
  let missingUnknown = 0;
  const missingSymbols: string[] = [];

  for (const valuation of nonCash) {
    if (valuation.marketValue !== null) {
      coveredValue += valuation.marketValue;
      totalValue += valuation.marketValue;
      continue;
    }
    missingSymbols.push(valuation.position.symbol);
    if (valuation.costValue !== null) {
      totalValue += valuation.costValue;
    } else {
      missingUnknown += 1;
    }
  }

  const coverageRatio = totalValue > 0 ? coveredValue / totalValue : null;
  const coverageLevel = resolveCoverageLevel(coverageRatio);

  const priceDates = nonCash
    .map((valuation) => valuation.priceDate)
    .filter((date): date is string => Boolean(date));
  const freshnessDays =
    priceAsOf && priceDates.length > 0 ? maxDateLag(priceAsOf, priceDates) : null;
  const freshnessLevel = resolveFreshnessLevel(freshnessDays);

  const notes: string[] = [];
  if (missingSymbols.length > 0) {
    notes.push(`缺少 ${missingSymbols.length} 个标的行情`);
  }
  if (missingUnknown > 0) {
    notes.push("部分缺失标的无成本，覆盖率可能偏高");
  }
  if (!priceAsOf) {
    notes.push("缺少行情 as-of 日期");
  }

  return {
    overallLevel: pickWorstLevel(coverageLevel, freshnessLevel),
    coverageLevel,
    freshnessLevel,
    coverageRatio,
    freshnessDays,
    asOfDate: priceAsOf,
    missingSymbols,
    notes
  };
}

function resolveCoverageLevel(ratio: number | null): DataQualityLevel {
  if (ratio === null || !Number.isFinite(ratio)) return "insufficient";
  if (ratio >= COVERAGE_OK_THRESHOLD) return "ok";
  if (ratio >= COVERAGE_PARTIAL_THRESHOLD) return "partial";
  return "insufficient";
}

function resolveFreshnessLevel(days: number | null): DataQualityLevel {
  if (days === null || !Number.isFinite(days)) return "insufficient";
  if (days <= FRESHNESS_OK_DAYS) return "ok";
  if (days <= FRESHNESS_PARTIAL_DAYS) return "partial";
  return "insufficient";
}

function maxDateLag(asOfDate: string, dates: string[]): number {
  const asOf = Date.parse(`${asOfDate}T00:00:00Z`);
  return dates.reduce((max, date) => {
    const current = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(current) || current > asOf) return max;
    const lag = Math.max(0, (asOf - current) / 86_400_000);
    return Math.max(max, lag);
  }, 0);
}

function pickWorstLevel(
  first: DataQualityLevel,
  second: DataQualityLevel
): DataQualityLevel {
  const rank = (value: DataQualityLevel) =>
    value === "insufficient" ? 2 : value === "partial" ? 1 : 0;
  return rank(first) >= rank(second) ? first : second;
}
