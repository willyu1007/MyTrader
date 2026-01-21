import type {
  ContributionBreakdown,
  LedgerEntry,
  PerformanceMetric,
  PerformanceRangeKey,
  PortfolioPerformance,
  PortfolioPerformanceAnalysis,
  PortfolioPerformanceRangeResult,
  PortfolioPerformanceSeries,
  PortfolioRiskMetrics,
  RiskSeriesMetrics
} from "@mytrader/shared";

import {
  getInstrumentsBySymbols,
  getLatestPricesAsOf,
  listPriceDatesInRange
} from "../market/marketRepository";
import type { SqliteDatabase } from "../storage/sqlite";

interface CashFlow {
  date: string;
  amount: number;
}

interface TwrResult {
  metric: PerformanceMetric | null;
  reason: string | null;
}

interface MwrResult {
  metric: PerformanceMetric | null;
  reason: string | null;
}

interface PerformanceRangeResult {
  metric: PerformanceMetric | null;
  series: PortfolioPerformanceSeries;
  reason: string | null;
}

interface LedgerState {
  holdings: Map<string, number>;
  cashBalances: Map<string, number>;
}

interface ValuationResult {
  values: { date: string; value: number }[];
}

const MS_PER_DAY = 86_400_000;
const TRADING_DAYS_PER_YEAR = 252;

export async function buildPortfolioPerformance(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  endValue: number;
  priceAsOf: string | null;
}): Promise<PortfolioPerformance> {
  const { ledgerEntries, marketDb, endValue, priceAsOf } = input;
  if (ledgerEntries.length === 0) {
    return {
      selectedMethod: "none",
      reason: "暂无流水",
      twr: null,
      mwr: null
    };
  }

  const twr = await computeTwr({
    ledgerEntries,
    marketDb,
    priceAsOf
  });
  const mwr = computeMwr({
    ledgerEntries,
    endValue,
    priceAsOf
  });

  if (twr.metric) {
    return {
      selectedMethod: "twr",
      reason: null,
      twr: twr.metric,
      mwr: mwr.metric
    };
  }
  if (mwr.metric) {
    return {
      selectedMethod: "mwr",
      reason: twr.reason ?? mwr.reason,
      twr: twr.metric,
      mwr: mwr.metric
    };
  }
  return {
    selectedMethod: "none",
    reason: twr.reason ?? mwr.reason ?? "收益口径不足",
    twr: twr.metric,
    mwr: mwr.metric
  };
}

export async function buildPortfolioPerformanceRange(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  range: PerformanceRangeKey;
  priceAsOf: string | null;
}): Promise<PortfolioPerformanceRangeResult> {
  const { ledgerEntries, marketDb, range, priceAsOf } = input;
  if (ledgerEntries.length === 0) {
    return {
      performance: {
        selectedMethod: "none",
        reason: "暂无流水",
        twr: null,
        mwr: null
      },
      series: null,
      analysis: null
    };
  }

  const { startDate, endDate, reason } = resolveRangeDates(
    ledgerEntries,
    range,
    priceAsOf
  );
  if (!startDate || !endDate) {
    return {
      performance: {
        selectedMethod: "none",
        reason: reason ?? "区间不足",
        twr: null,
        mwr: null
      },
      series: null,
      analysis: null
    };
  }

  const twr = await computeTwrRange({
    ledgerEntries,
    marketDb,
    startDate,
    endDate
  });
  const mwr = await computeMwrRange({
    ledgerEntries,
    marketDb,
    startDate,
    endDate
  });
  const analysis = await buildPerformanceAnalysis({
    ledgerEntries,
    marketDb,
    startDate,
    endDate,
    twrSeries: twr.series,
    navSeries: mwr.series
  });

  if (twr.metric) {
    return {
      performance: {
        selectedMethod: "twr",
        reason: null,
        twr: twr.metric,
        mwr: mwr.metric
      },
      series: twr.series,
      analysis
    };
  }

  if (mwr.metric) {
    return {
      performance: {
        selectedMethod: "mwr",
        reason: twr.reason ?? mwr.reason,
        twr: twr.metric,
        mwr: mwr.metric
      },
      series: mwr.series,
      analysis
    };
  }

  return {
    performance: {
      selectedMethod: "none",
      reason: twr.reason ?? mwr.reason ?? "收益口径不足",
      twr: twr.metric,
      mwr: mwr.metric
    },
    series: twr.series.points.length ? twr.series : mwr.series.points.length ? mwr.series : null,
    analysis
  };
}

async function buildPerformanceAnalysis(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  startDate: string;
  endDate: string;
  navSeries: PortfolioPerformanceSeries;
  twrSeries: PortfolioPerformanceSeries;
}): Promise<PortfolioPerformanceAnalysis> {
  const { ledgerEntries, marketDb, startDate, endDate, navSeries, twrSeries } =
    input;
  const contributions = await buildContributionBreakdown({
    ledgerEntries,
    marketDb,
    startDate,
    endDate
  });
  const riskMetrics = buildRiskMetrics({ navSeries, twrSeries });
  return {
    contributions,
    riskMetrics
  };
}

async function computeTwr(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  priceAsOf: string | null;
}): Promise<TwrResult> {
  const { ledgerEntries, marketDb, priceAsOf } = input;
  if (!priceAsOf) {
    return { metric: null, reason: "缺少行情快照" };
  }

  const startDate = findEarliestDate(ledgerEntries);
  const endDate = priceAsOf;
  if (!startDate) {
    return { metric: null, reason: "缺少起始日期" };
  }
  if (compareDate(startDate, endDate) >= 0) {
    return { metric: null, reason: "行情区间不足" };
  }

  const cashFlowsByDate = collectCashFlowsByDate(ledgerEntries);
  const lastLedgerDate = findLatestDate(ledgerEntries);
  if (lastLedgerDate && compareDate(lastLedgerDate, endDate) > 0) {
    return { metric: null, reason: "行情早于流水" };
  }
  const hasFlowAfterEnd = Array.from(cashFlowsByDate.keys()).some(
    (date) => compareDate(date, endDate) > 0
  );
  if (hasFlowAfterEnd) {
    return { metric: null, reason: "行情早于现金流" };
  }
  const flowDates = Array.from(cashFlowsByDate.keys()).filter(
    (date) => compareDate(date, endDate) <= 0
  );
  const evaluationDates = uniqueSortedDates([
    startDate,
    ...flowDates,
    endDate
  ]);
  if (evaluationDates.length < 2) {
    return { metric: null, reason: "可计算区间不足" };
  }

  const valuations = await buildValuations(
    ledgerEntries,
    evaluationDates,
    marketDb
  );
  if ("reason" in valuations) {
    return { metric: null, reason: valuations.reason };
  }

  let compounded = 1;
  for (let i = 1; i < valuations.values.length; i += 1) {
    const prev = valuations.values[i - 1];
    const current = valuations.values[i];
    if (prev.value <= 0) {
      return { metric: null, reason: "期初净值为零" };
    }
    const cashFlow = cashFlowsByDate.get(current.date) ?? 0;
    const periodReturn = (current.value - cashFlow) / prev.value - 1;
    if (!Number.isFinite(periodReturn)) {
      return { metric: null, reason: "TWR 计算失败" };
    }
    compounded *= 1 + periodReturn;
  }

  const totalReturn = compounded - 1;
  const days = daysBetween(startDate, endDate);
  const annualizedReturn =
    days > 0 ? Math.pow(1 + totalReturn, 365 / days) - 1 : null;

  return {
    metric: {
      method: "twr",
      totalReturn,
      annualizedReturn,
      startDate,
      endDate
    },
    reason: null
  };
}

async function computeTwrRange(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  startDate: string;
  endDate: string;
}): Promise<PerformanceRangeResult> {
  const { ledgerEntries, marketDb, startDate, endDate } = input;
  const series: PortfolioPerformanceSeries = {
    method: "twr",
    points: [],
    startDate,
    endDate,
    reason: null
  };

  if (compareDate(startDate, endDate) >= 0) {
    series.reason = "区间不足";
    return { metric: null, series, reason: series.reason };
  }

  const cashFlowsByDate = collectCashFlowsByDateInRange(
    ledgerEntries,
    startDate,
    endDate
  );
  const evaluationDates = await buildSeriesDates(
    ledgerEntries,
    marketDb,
    startDate,
    endDate,
    cashFlowsByDate
  );
  if (evaluationDates.length < 2) {
    series.reason = "可计算区间不足";
    return { metric: null, series, reason: series.reason };
  }

  const valuations = await buildValuations(
    ledgerEntries,
    evaluationDates,
    marketDb
  );
  if ("reason" in valuations) {
    series.reason = valuations.reason;
    return { metric: null, series, reason: series.reason };
  }

  const points = buildTwrSeriesPoints(valuations.values, cashFlowsByDate);
  series.points = points;
  if (points.length < 2) {
    series.reason = "可计算区间不足";
    return { metric: null, series, reason: series.reason };
  }

  const totalReturn = points[points.length - 1].returnPct;
  const days = daysBetween(startDate, endDate);
  const annualizedReturn =
    days > 0 ? Math.pow(1 + totalReturn, 365 / days) - 1 : null;

  return {
    metric: {
      method: "twr",
      totalReturn,
      annualizedReturn,
      startDate,
      endDate
    },
    series,
    reason: null
  };
}

function computeMwr(input: {
  ledgerEntries: LedgerEntry[];
  endValue: number;
  priceAsOf: string | null;
}): MwrResult {
  const { ledgerEntries, endValue, priceAsOf } = input;
  const cashFlows = ledgerEntries
    .filter(
      (entry): entry is LedgerEntry & { cashAmount: number } =>
        entry.eventType === "cash" &&
        entry.cashAmount !== null &&
        entry.cashAmount !== 0
    )
    .map((entry) => ({
      date: entry.tradeDate,
      amount: -entry.cashAmount
    }))
    .sort((a, b) => compareDate(a.date, b.date));

  if (cashFlows.length === 0) {
    return { metric: null, reason: "缺少外部现金流" };
  }
  if (!Number.isFinite(endValue) || endValue <= 0) {
    return { metric: null, reason: "期末市值不足" };
  }

  const lastLedgerDate = findLatestDate(ledgerEntries);
  const endDate =
    pickLatestDate(priceAsOf, lastLedgerDate) ??
    cashFlows[cashFlows.length - 1].date;
  cashFlows.push({ date: endDate, amount: endValue });

  if (!hasPositiveAndNegative(cashFlows)) {
    return { metric: null, reason: "现金流方向不足" };
  }

  const irr = computeIrr(cashFlows);
  if (irr === null || !Number.isFinite(irr)) {
    return { metric: null, reason: "MWR 计算失败" };
  }

  const startDate = cashFlows[0].date;
  const days = daysBetween(startDate, endDate);
  const totalReturn = days > 0 ? Math.pow(1 + irr, days / 365) - 1 : null;

  return {
    metric: {
      method: "mwr",
      totalReturn: totalReturn ?? 0,
      annualizedReturn: irr,
      startDate,
      endDate
    },
    reason: null
  };
}

async function computeMwrRange(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  startDate: string;
  endDate: string;
}): Promise<PerformanceRangeResult> {
  const { ledgerEntries, marketDb, startDate, endDate } = input;
  const series: PortfolioPerformanceSeries = {
    method: "mwr",
    points: [],
    startDate,
    endDate,
    reason: null
  };

  if (compareDate(startDate, endDate) >= 0) {
    series.reason = "区间不足";
    return { metric: null, series, reason: series.reason };
  }

  const cashFlows = ledgerEntries
    .filter(
      (entry): entry is LedgerEntry & { cashAmount: number } =>
        entry.eventType === "cash" &&
        entry.cashAmount !== null &&
        entry.cashAmount !== 0 &&
        compareDate(entry.tradeDate, startDate) >= 0 &&
        compareDate(entry.tradeDate, endDate) <= 0
    )
    .map((entry) => ({
      date: entry.tradeDate,
      amount: -entry.cashAmount
    }));

  const startValueResult = await getPortfolioValueAtDate(
    ledgerEntries,
    marketDb,
    startDate
  );
  const endValueResult = await getPortfolioValueAtDate(
    ledgerEntries,
    marketDb,
    endDate
  );

  if (startValueResult.value !== null && startValueResult.value > 0) {
    cashFlows.push({
      date: startDate,
      amount: -startValueResult.value
    });
  }

  if (endValueResult.value === null || endValueResult.value <= 0) {
    series.reason = endValueResult.reason ?? "期末市值不足";
    return { metric: null, series, reason: series.reason };
  }

  cashFlows.push({ date: endDate, amount: endValueResult.value });
  cashFlows.sort((a, b) => compareDate(a.date, b.date));

  if (!hasPositiveAndNegative(cashFlows)) {
    series.reason = "现金流方向不足";
    return { metric: null, series, reason: series.reason };
  }

  const irr = computeIrr(cashFlows);
  if (irr === null || !Number.isFinite(irr)) {
    series.reason = "MWR 计算失败";
    return { metric: null, series, reason: series.reason };
  }

  const days = daysBetween(startDate, endDate);
  const totalReturn = days > 0 ? Math.pow(1 + irr, days / 365) - 1 : null;

  const seriesDates = await buildSeriesDates(
    ledgerEntries,
    marketDb,
    startDate,
    endDate,
    collectCashFlowsByDateInRange(ledgerEntries, startDate, endDate)
  );
  const valuations = await buildValuations(
    ledgerEntries,
    seriesDates,
    marketDb
  );
  if ("reason" in valuations) {
    series.reason = valuations.reason;
  } else {
    series.points = buildNavSeriesPoints(valuations.values);
  }

  return {
    metric: {
      method: "mwr",
      totalReturn: totalReturn ?? 0,
      annualizedReturn: irr,
      startDate,
      endDate
    },
    series,
    reason: series.reason
  };
}

function resolveRangeDates(
  ledgerEntries: LedgerEntry[],
  range: PerformanceRangeKey,
  priceAsOf: string | null
): { startDate: string | null; endDate: string | null; reason: string | null } {
  const earliest = findEarliestDate(ledgerEntries);
  const lastLedgerDate = findLatestDate(ledgerEntries);
  const endDate = priceAsOf ?? lastLedgerDate;
  if (!endDate) {
    return { startDate: null, endDate: null, reason: "缺少结束日期" };
  }
  if (!earliest) {
    return { startDate: null, endDate, reason: "缺少起始日期" };
  }
  if (compareDate(endDate, earliest) < 0) {
    return { startDate: null, endDate, reason: "行情区间不足" };
  }

  let startDate = earliest;
  if (range !== "ALL") {
    startDate = computeRangeStartDate(range, endDate);
  }

  if (compareDate(startDate, earliest) < 0) {
    startDate = earliest;
  }
  if (compareDate(startDate, endDate) >= 0) {
    return { startDate: null, endDate, reason: "区间不足" };
  }

  return { startDate, endDate, reason: null };
}

function computeRangeStartDate(range: PerformanceRangeKey, endDate: string): string {
  const end = new Date(`${endDate}T00:00:00Z`);
  switch (range) {
    case "1M":
      return formatDate(shiftDate(end, -1, 0));
    case "3M":
      return formatDate(shiftDate(end, -3, 0));
    case "6M":
      return formatDate(shiftDate(end, -6, 0));
    case "1Y":
      return formatDate(shiftDate(end, 0, -1));
    case "YTD":
      return `${end.getUTCFullYear()}-01-01`;
    default:
      return formatDate(end);
  }
}

async function buildSeriesDates(
  ledgerEntries: LedgerEntry[],
  marketDb: SqliteDatabase,
  startDate: string,
  endDate: string,
  cashFlowsByDate: Map<string, number>
): Promise<string[]> {
  const symbols = listLedgerSymbols(ledgerEntries);
  const priceDates = await listPriceDatesInRange(
    marketDb,
    symbols,
    startDate,
    endDate
  );
  return uniqueSortedDates([
    startDate,
    endDate,
    ...priceDates,
    ...Array.from(cashFlowsByDate.keys())
  ]);
}

async function getPortfolioValueAtDate(
  ledgerEntries: LedgerEntry[],
  marketDb: SqliteDatabase,
  date: string
): Promise<{ value: number | null; reason: string | null }> {
  const valuation = await buildValuations(ledgerEntries, [date], marketDb);
  if ("reason" in valuation) {
    return { value: null, reason: valuation.reason };
  }
  const value = valuation.values[0]?.value ?? null;
  return { value, reason: value === null ? "估值结果为空" : null };
}

function collectCashFlowsByDateInRange(
  entries: LedgerEntry[],
  startDate: string,
  endDate: string
): Map<string, number> {
  const result = new Map<string, number>();
  entries.forEach((entry) => {
    if (entry.eventType !== "cash") return;
    if (entry.cashAmount === null) return;
    if (compareDate(entry.tradeDate, startDate) < 0) return;
    if (compareDate(entry.tradeDate, endDate) > 0) return;
    const existing = result.get(entry.tradeDate) ?? 0;
    result.set(entry.tradeDate, existing + entry.cashAmount);
  });
  return result;
}

function listLedgerSymbols(entries: LedgerEntry[]): string[] {
  const symbols = new Set<string>();
  entries.forEach((entry) => {
    if (entry.eventType !== "trade" && entry.eventType !== "adjustment") return;
    if (!entry.symbol) return;
    symbols.add(entry.symbol);
  });
  return Array.from(symbols.values());
}

function buildTwrSeriesPoints(
  valuations: { date: string; value: number }[],
  cashFlowsByDate: Map<string, number>
): PortfolioPerformanceSeries["points"] {
  if (valuations.length === 0) return [];
  const points: PortfolioPerformanceSeries["points"] = [];
  let compounded = 1;
  points.push({
    date: valuations[0].date,
    value: valuations[0].value,
    returnPct: 0
  });

  for (let i = 1; i < valuations.length; i += 1) {
    const prev = valuations[i - 1];
    const current = valuations[i];
    if (prev.value <= 0) return [];
    const cashFlow = cashFlowsByDate.get(current.date) ?? 0;
    const periodReturn = (current.value - cashFlow) / prev.value - 1;
    if (!Number.isFinite(periodReturn)) return [];
    compounded *= 1 + periodReturn;
    points.push({
      date: current.date,
      value: current.value,
      returnPct: compounded - 1
    });
  }
  return points;
}

function buildNavSeriesPoints(
  valuations: { date: string; value: number }[]
): PortfolioPerformanceSeries["points"] {
  if (valuations.length === 0) return [];
  const startValue = valuations[0].value;
  if (!Number.isFinite(startValue) || startValue <= 0) return [];
  return valuations.map((entry) => ({
    date: entry.date,
    value: entry.value,
    returnPct: entry.value / startValue - 1
  }));
}

async function buildContributionBreakdown(input: {
  ledgerEntries: LedgerEntry[];
  marketDb: SqliteDatabase;
  startDate: string;
  endDate: string;
}): Promise<ContributionBreakdown> {
  const { ledgerEntries, marketDb, startDate, endDate } = input;
  const state = buildLedgerStateAtDate(ledgerEntries, endDate);
  const holdings = Array.from(state.holdings.entries()).filter(
    ([, quantity]) => quantity > 0
  );
  const symbols = holdings.map(([symbol]) => symbol);
  const instruments = await getInstrumentsBySymbols(marketDb, symbols);
  const startPrices = await getLatestPricesAsOf(marketDb, symbols, startDate);
  const endPrices = await getLatestPricesAsOf(marketDb, symbols, endDate);
  const cashValue = Array.from(state.cashBalances.values()).reduce(
    (sum, amount) => sum + amount,
    0
  );

  const missingSymbols: string[] = [];
  const bySymbol: ContributionBreakdown["bySymbol"] = [];

  const symbolMarketValues = new Map<string, number>();
  holdings.forEach(([symbol, quantity]) => {
    const endPrice = endPrices.get(symbol)?.close ?? null;
    const marketValue =
      endPrice !== null && Number.isFinite(endPrice) ? endPrice * quantity : 0;
    symbolMarketValues.set(symbol, marketValue);
  });

  const totalMarketValue =
    cashValue +
    Array.from(symbolMarketValues.values()).reduce((sum, value) => sum + value, 0);

  if (!Number.isFinite(totalMarketValue) || totalMarketValue <= 0) {
    return {
      startDate,
      endDate,
      bySymbol: [],
      byAssetClass: [],
      missingSymbols: [],
      reason: "期末市值不足"
    };
  }

  holdings.forEach(([symbol]) => {
    const instrument = instruments.get(symbol);
    const label = instrument?.name ?? symbol;
    const marketValue = symbolMarketValues.get(symbol) ?? 0;
    const weight = marketValue / totalMarketValue;
    const startPrice = startPrices.get(symbol)?.close ?? null;
    const endPrice = endPrices.get(symbol)?.close ?? null;
    let returnPct: number | null = null;
    if (
      startPrice !== null &&
      endPrice !== null &&
      Number.isFinite(startPrice) &&
      Number.isFinite(endPrice) &&
      startPrice > 0
    ) {
      returnPct = endPrice / startPrice - 1;
    } else {
      missingSymbols.push(symbol);
    }
    const contribution =
      returnPct === null ? null : returnPct * weight;
    bySymbol.push({
      key: symbol,
      label,
      weight,
      marketValue,
      returnPct,
      contribution,
      priceStart: startPrice,
      priceEnd: endPrice
    });
  });

  const byAssetClassMap = new Map<
    string,
    {
      label: string;
      weight: number;
      marketValue: number;
      contribution: number;
      hasMissing: boolean;
    }
  >();

  bySymbol.forEach((entry) => {
    const instrument = instruments.get(entry.key);
    const assetClass = instrument?.assetClass ?? "stock";
    const label = formatAssetClassLabel(assetClass);
    const group =
      byAssetClassMap.get(assetClass) ?? {
        label,
        weight: 0,
        marketValue: 0,
        contribution: 0,
        hasMissing: false
      };
    group.weight += entry.weight;
    group.marketValue += entry.marketValue;
    if (entry.contribution === null) {
      group.hasMissing = true;
    } else {
      group.contribution += entry.contribution;
    }
    byAssetClassMap.set(assetClass, group);
  });

  if (cashValue !== 0) {
    const weight = cashValue / totalMarketValue;
    const group =
      byAssetClassMap.get("cash") ?? {
        label: formatAssetClassLabel("cash"),
        weight: 0,
        marketValue: 0,
        contribution: 0,
        hasMissing: false
      };
    group.weight += weight;
    group.marketValue += cashValue;
    byAssetClassMap.set("cash", group);
  }

  const byAssetClass = Array.from(byAssetClassMap.entries()).map(
    ([key, group]) => {
      const returnPct =
        group.hasMissing || group.weight === 0
          ? null
          : group.contribution / group.weight;
      return {
        key,
        label: group.label,
        weight: group.weight,
        marketValue: group.marketValue,
        returnPct,
        contribution: group.hasMissing ? null : group.contribution,
        priceStart: null,
        priceEnd: null
      };
    }
  );

  return {
    startDate,
    endDate,
    bySymbol,
    byAssetClass,
    missingSymbols,
    reason:
      missingSymbols.length > 0
        ? `缺少 ${missingSymbols.length} 个标的价格，贡献结果不完整`
        : null
  };
}

function buildRiskMetrics(input: {
  navSeries: PortfolioPerformanceSeries;
  twrSeries: PortfolioPerformanceSeries;
}): PortfolioRiskMetrics {
  const { navSeries, twrSeries } = input;
  return {
    nav: buildRiskSeriesMetrics(navSeries, "nav"),
    twr: buildRiskSeriesMetrics(twrSeries, "twr")
  };
}

function buildRiskSeriesMetrics(
  series: PortfolioPerformanceSeries,
  mode: "nav" | "twr"
): RiskSeriesMetrics {
  const points = series.points;
  if (points.length < 2) {
    return {
      volatility: null,
      volatilityAnnualized: null,
      maxDrawdown: null,
      startDate: series.startDate ?? null,
      endDate: series.endDate ?? null,
      points: points.length,
      reason: series.reason ?? "可计算区间不足"
    };
  }

  const values = points.map((point) => {
    if (mode === "nav") return point.value;
    return 1 + point.returnPct;
  });

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return {
      volatility: null,
      volatilityAnnualized: null,
      maxDrawdown: null,
      startDate: series.startDate ?? null,
      endDate: series.endDate ?? null,
      points: points.length,
      reason: "序列数据异常"
    };
  }

  const returns = values
    .slice(1)
    .map((value, index) => value / values[index] - 1)
    .filter((value) => Number.isFinite(value));

  if (returns.length < 2) {
    return {
      volatility: null,
      volatilityAnnualized: null,
      maxDrawdown: null,
      startDate: series.startDate ?? null,
      endDate: series.endDate ?? null,
      points: points.length,
      reason: series.reason ?? "可计算区间不足"
    };
  }

  const volatility = computeStandardDeviation(returns);
  const maxDrawdown = computeMaxDrawdown(values);

  return {
    volatility,
    volatilityAnnualized:
      volatility === null ? null : volatility * Math.sqrt(TRADING_DAYS_PER_YEAR),
    maxDrawdown,
    startDate: series.startDate ?? null,
    endDate: series.endDate ?? null,
    points: points.length,
    reason: series.reason ?? null
  };
}

function buildLedgerStateAtDate(
  entries: LedgerEntry[],
  asOfDate: string
): LedgerState {
  const state: LedgerState = {
    holdings: new Map(),
    cashBalances: new Map()
  };
  if (!asOfDate) return state;
  const sorted = [...entries].sort(compareLedgerEntries);
  const cutoff = endOfDayTimestamp(asOfDate);
  for (const entry of sorted) {
    if (entrySortKey(entry) > cutoff) break;
    applyEntry(entry, state);
  }
  return state;
}

function computeStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  if (!Number.isFinite(variance) || variance < 0) return null;
  return Math.sqrt(variance);
}

function computeMaxDrawdown(values: number[]): number | null {
  if (values.length < 2) return null;
  let peak = values[0];
  let maxDrawdown = 0;
  for (const value of values) {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (value > peak) {
      peak = value;
      continue;
    }
    const drawdown = value / peak - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
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

function shiftDate(date: Date, months: number, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function buildValuations(
  ledgerEntries: LedgerEntry[],
  dates: string[],
  marketDb: SqliteDatabase
): Promise<ValuationResult | { reason: string }> {
  const sorted = [...ledgerEntries].sort(compareLedgerEntries);
  const state: LedgerState = {
    holdings: new Map(),
    cashBalances: new Map()
  };
  let cursor = 0;
  const valuations: { date: string; value: number }[] = [];

  for (const date of dates) {
    const cutoff = endOfDayTimestamp(date);
    while (cursor < sorted.length && entrySortKey(sorted[cursor]) <= cutoff) {
      applyEntry(sorted[cursor], state);
      cursor += 1;
    }

    const symbols = Array.from(state.holdings.entries())
      .filter(([, quantity]) => quantity > 0)
      .map(([symbol]) => symbol);
    const prices = await getLatestPricesAsOf(marketDb, symbols, date);

    const missing = symbols.filter((symbol) => {
      const price = prices.get(symbol);
      return !price || price.close === null;
    });
    if (missing.length > 0) {
      return { reason: `缺少 ${missing.length} 个标的行情` };
    }

    let totalValue = 0;
    for (const [symbol, quantity] of state.holdings.entries()) {
      if (quantity <= 0) continue;
      const price = prices.get(symbol);
      if (!price || price.close === null) {
        return { reason: "缺少标的行情" };
      }
      totalValue += quantity * price.close;
    }
    for (const amount of state.cashBalances.values()) {
      totalValue += amount;
    }

    if (!Number.isFinite(totalValue)) {
      return { reason: "估值结果异常" };
    }
    valuations.push({ date, value: totalValue });
  }

  return { values: valuations };
}

function applyEntry(entry: LedgerEntry, state: LedgerState): void {
  if (entry.cashCurrency && entry.cashAmount !== null) {
    const next =
      (state.cashBalances.get(entry.cashCurrency) ?? 0) + entry.cashAmount;
    state.cashBalances.set(entry.cashCurrency, next);
  }

  if (entry.eventType !== "trade" && entry.eventType !== "adjustment") {
    if (entry.eventType === "corporate_action") {
      applyCorporateAction(entry, state);
    }
    return;
  }
  const symbol = entry.symbol;
  if (!symbol) return;
  if (!entry.side || !entry.quantity || entry.quantity <= 0) return;

  if (entry.eventType === "adjustment" && getAdjustmentMode(entry.meta) === "absolute") {
    state.holdings.set(symbol, entry.quantity);
    return;
  }

  const current = state.holdings.get(symbol) ?? 0;
  if (entry.side === "buy") {
    state.holdings.set(symbol, current + entry.quantity);
    return;
  }
  const reduced = Math.max(0, current - entry.quantity);
  if (reduced <= 0) {
    state.holdings.delete(symbol);
  } else {
    state.holdings.set(symbol, reduced);
  }
}

function applyCorporateAction(entry: LedgerEntry, state: LedgerState): void {
  const ratio = getCorporateActionRatio(entry.meta);
  if (!ratio) return;
  const symbol = entry.symbol;
  if (!symbol) return;
  const current = state.holdings.get(symbol);
  if (current === undefined) return;
  const next = current * ratio;
  if (!Number.isFinite(next) || next <= 0) {
    state.holdings.delete(symbol);
    return;
  }
  state.holdings.set(symbol, next);
}

function collectCashFlowsByDate(entries: LedgerEntry[]): Map<string, number> {
  const result = new Map<string, number>();
  entries.forEach((entry) => {
    if (entry.eventType !== "cash") return;
    if (entry.cashAmount === null) return;
    const existing = result.get(entry.tradeDate) ?? 0;
    result.set(entry.tradeDate, existing + entry.cashAmount);
  });
  return result;
}

function uniqueSortedDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort(compareDate);
}

function compareDate(a: string, b: string): number {
  return a.localeCompare(b);
}

function findEarliestDate(entries: LedgerEntry[]): string | null {
  return entries.reduce<string | null>((current, entry) => {
    if (!current) return entry.tradeDate;
    return compareDate(entry.tradeDate, current) < 0 ? entry.tradeDate : current;
  }, null);
}

function findLatestDate(entries: LedgerEntry[]): string | null {
  return entries.reduce<string | null>((current, entry) => {
    if (!current) return entry.tradeDate;
    return compareDate(entry.tradeDate, current) > 0 ? entry.tradeDate : current;
  }, null);
}

function pickLatestDate(a: string | null | undefined, b: string | null | undefined): string | null {
  if (a && b) return compareDate(a, b) >= 0 ? a : b;
  return a ?? b ?? null;
}

function endOfDayTimestamp(date: string): number {
  return Date.parse(`${date}T23:59:59.999Z`);
}

function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY;
}

function entrySortKey(entry: LedgerEntry): number {
  if (entry.eventTs && entry.eventTs > 0) return entry.eventTs;
  return Date.parse(`${entry.tradeDate}T00:00:00Z`);
}

function compareLedgerEntries(a: LedgerEntry, b: LedgerEntry): number {
  const aKey = entrySortKey(a);
  const bKey = entrySortKey(b);
  if (aKey !== bKey) return aKey - bKey;
  const aSeq = a.sequence ?? 0;
  const bSeq = b.sequence ?? 0;
  if (aSeq !== bSeq) return aSeq - bSeq;
  return a.createdAt - b.createdAt;
}

function getAdjustmentMode(meta: LedgerEntry["meta"]): "absolute" | "delta" {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "delta";
  const data = meta as Record<string, unknown>;
  const raw = data.adjustment_mode;
  if (raw === "absolute" || raw === "delta") return raw;
  if (data.baseline === true) return "absolute";
  return "delta";
}

function getCorporateActionRatio(meta: LedgerEntry["meta"]): number | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const data = meta as Record<string, unknown>;
  const kind = data.kind;
  if (kind !== "split" && kind !== "reverse_split") return null;
  const numerator = Number(data.numerator);
  const denominator = Number(data.denominator);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (numerator <= 0 || denominator <= 0) return null;
  return numerator / denominator;
}

function hasPositiveAndNegative(flows: CashFlow[]): boolean {
  let hasPositive = false;
  let hasNegative = false;
  flows.forEach((flow) => {
    if (flow.amount > 0) hasPositive = true;
    if (flow.amount < 0) hasNegative = true;
  });
  return hasPositive && hasNegative;
}

function computeIrr(flows: CashFlow[]): number | null {
  const sorted = [...flows].sort((a, b) => compareDate(a.date, b.date));
  const start = Date.parse(`${sorted[0].date}T00:00:00Z`);
  const times = sorted.map(
    (flow) => (Date.parse(`${flow.date}T00:00:00Z`) - start) / MS_PER_DAY / 365
  );

  const npv = (rate: number) => {
    if (rate <= -1) return Number.POSITIVE_INFINITY;
    return sorted.reduce((sum, flow, index) => {
      return sum + flow.amount / Math.pow(1 + rate, times[index]);
    }, 0);
  };

  let low = -0.9999;
  let high = 1;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  while (npvLow * npvHigh > 0 && high < 1000) {
    high *= 2;
    npvHigh = npv(high);
  }
  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh)) return null;
  if (npvLow * npvHigh > 0) return null;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (!Number.isFinite(npvMid)) return null;
    if (Math.abs(npvMid) < 1e-8) return mid;
    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return (low + high) / 2;
}
