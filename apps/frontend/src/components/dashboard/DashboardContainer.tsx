import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import type {
  AssetClass,
  CorporateActionKind,
  LedgerEntry,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  MarketDailyBar,
  MarketUniversePoolBucketStatus,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioSnapshot,
  RiskLimitType,
} from "@mytrader/shared";
import {
  DEFAULT_LEDGER_END_DATE,
  DEFAULT_LEDGER_START_DATE,
  MARKET_EXPLORER_DEFAULT_WIDTH,
  MARKET_EXPLORER_MAX_WIDTH,
  MARKET_EXPLORER_MIN_WIDTH,
  MARKET_EXPLORER_WIDTH_STORAGE_KEY,
  TARGETS_EDITOR_SPLIT_DEFAULT,
  TARGETS_EDITOR_SPLIT_MAX,
  TARGETS_EDITOR_SPLIT_MIN,
  TARGETS_EDITOR_SPLIT_STORAGE_KEY,
  analysisTabs,
  marketChartRanges,
  navItems,
  otherTabs,
  performanceRanges,
  portfolioTabs,
  schedulerTimezoneDefaults
} from "./constants";
import type {
  DashboardProps,
  PortfolioTab,
  WorkspaceView
} from "./types";
import {
  Panel,
  PlaceholderPanel,
  Modal,
  FormGroup,
  Input,
  Select,
  PopoverSelect,
  Button,
  IconButton,
  Badge,
  MarketQuoteHeader,
  ChartErrorBoundary,
  MarketAreaChart,
  MarketVolumeMiniChart,
  SummaryCard,
  EmptyState,
  ErrorState,
  HelpHint,
  ConfirmDialog,
  LedgerTable,
  LedgerForm,
  DataQualityCard,
  clampNumber,
  formatNumber,
  formatCnWanYiNullable,
  formatSignedCnWanYiNullable,
  formatCurrency,
  formatPct,
  formatPctNullable,
  formatSignedPctNullable,
  getCnChangeTone,
  getCnToneTextClass,
  formatPerformanceMethod,
  formatDateRange,
  computeTagAggregate,
  sortTagMembersByChangePct,
  formatAssetClassLabel,
  formatRiskLimitTypeLabel,
  formatLedgerEventType,
  formatDateTime,
  formatDurationMs,
  formatMarketTokenSource,
  formatTagSourceLabel,
  formatIngestRunStatusLabel,
  formatIngestRunScopeLabel,
  formatIngestRunModeLabel,
  formatTargetsReasons,
  formatIngestRunTone,
  formatIngestControlStateLabel,
  getIngestControlStateDotClass,
  getUniversePoolBucketLabel,
  isSameSchedulerConfig,
  isSameUniversePoolConfig,
  isSameTargetsConfig,
  sanitizeToastMessage,
  toUserErrorMessage,
  formatInputDate,
  formatCnDate,
  parseTargetPriceFromTags,
  formatThemeLabel,
  computeFifoUnitCost,
  resolveMarketChartDateRange,
  createEmptyLedgerForm,
  DescriptionItem,
  PerformanceChart,
  ContributionTable,
  RiskMetricCard
} from "./shared";
import { AccountView } from "./views/AccountView";
import { DataAnalysisView } from "./views/DataAnalysisView";
import { DashboardOverlays } from "./views/DashboardOverlays";
import { MarketView } from "./views/MarketView";
import { OtherView } from "./views/OtherView";
import { PortfolioView } from "./views/PortfolioView";
import { RiskView } from "./views/RiskView";
import { SidebarNav } from "./views/SidebarNav";
import { TopToolbar } from "./views/TopToolbar";
import { useDashboardAnalysis } from "./hooks/use-dashboard-analysis";
import { useDashboardAnalysisRuntime } from "./hooks/use-dashboard-analysis-runtime";
import {
  useDashboardMarket,
  useDashboardMarketManagementActions,
  useDashboardMarketRuntimeEffects
} from "./hooks/use-dashboard-market";
import { useDashboardMarketInstrumentActions } from "./hooks/use-dashboard-market-instrument-actions";
import { useDashboardMarketAdminRefresh } from "./hooks/use-dashboard-market-admin-refresh";
import { useDashboardMarketAdminActions } from "./hooks/use-dashboard-market-admin-actions";
import { useDashboardMarketTargetActions } from "./hooks/use-dashboard-market-target-actions";
import { useDashboardMarketTargetPoolStats } from "./hooks/use-dashboard-market-target-pool-stats";
import { useDashboardMarketTargetPoolDetail } from "./hooks/use-dashboard-market-target-pool-detail";
import { useDashboardMarketDataLoaders } from "./hooks/use-dashboard-market-data-loaders";
import { useDashboardMarketResize } from "./hooks/use-dashboard-market-resize";
import { useDashboardPortfolioActions } from "./hooks/use-dashboard-portfolio-actions";
import { useDashboardLedgerActions } from "./hooks/use-dashboard-ledger-actions";
import {
  useDashboardPortfolio
} from "./hooks/use-dashboard-portfolio";
import { useDashboardPortfolioRuntime } from "./hooks/use-dashboard-portfolio-runtime";
import { useDashboardUiEffects } from "./hooks/use-dashboard-ui-effects";
import { useDashboardUi } from "./hooks/use-dashboard-ui";

interface PositionFormState {
  id?: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  market: string;
  currency: string;
  quantity: string;
  cost: string;
  openDate: string;
}

interface RiskFormState {
  id?: string;
  limitType: RiskLimitType;
  target: string;
  thresholdPct: string;
}

interface LedgerFormState {
  id?: string;
  eventType: LedgerEventType;
  tradeDate: string;
  eventTime: string;
  sequence: string;
  accountKey: string;
  instrumentId: string;
  symbol: string;
  side: LedgerSide | "";
  quantity: string;
  price: string;
  priceCurrency: string;
  cashAmount: string;
  cashCurrency: string;
  fee: string;
  tax: string;
  feeRate: string;
  taxRate: string;
  cashAmountAuto: boolean;
  note: string;
  source: LedgerSource;
  externalId: string;
  corporateKind: CorporateActionKindUi;
  corporateAfterShares: string;
}

type LedgerFilter = "all" | LedgerEventType;
type CorporateActionKindUi = CorporateActionKind | "dividend";
type MarketScope = "tags" | "holdings" | "search";
type MarketChartRangeKey =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "2Y"
  | "5Y"
  | "10Y";

type MarketFilterMarket = "all" | "CN";
type TargetPoolStatsScope = "universe" | "focus";
type UniversePoolBucketId = MarketUniversePoolBucketStatus["bucket"];

interface TargetPoolCategoryDetail {
  key: string;
  label: string;
  symbols: string[];
}

interface TargetPoolStructureStats {
  totalSymbols: number;
  industryL1Count: number;
  industryL2Count: number;
  conceptCount: number;
  unclassifiedCount: number;
  classificationCoverage: number | null;
  allSymbols: string[];
  classifiedSymbols: string[];
  industryL1Details: TargetPoolCategoryDetail[];
  industryL2Details: TargetPoolCategoryDetail[];
  conceptDetails: TargetPoolCategoryDetail[];
  unclassifiedSymbols: string[];
  symbolNames: Record<string, string | null>;
  loading: boolean;
  error: string | null;
}

const UNIVERSE_POOL_BUCKET_ORDER: UniversePoolBucketId[] = [
  "cn_a",
  "etf",
  "precious_metal"
];

const emptyPositionForm: PositionFormState = {
  symbol: "",
  name: "",
  assetClass: "stock",
  market: "CN",
  currency: "CNY",
  quantity: "",
  cost: "",
  openDate: ""
};

const emptyRiskForm: RiskFormState = {
  limitType: "position_weight",
  target: "",
  thresholdPct: ""
};

const assetClassLabels: Record<AssetClass, string> = {
  stock: "股票",
  etf: "ETF",
  cash: "现金"
};

const riskLimitTypeLabels: Record<RiskLimitType, string> = {
  position_weight: "持仓权重",
  asset_class_weight: "资产类别权重"
};

const ledgerEventTypeLabels: Record<LedgerEventType, string> = {
  trade: "交易",
  cash: "现金流",
  fee: "费用（历史）",
  tax: "税费（历史）",
  dividend: "公司行为·分红",
  adjustment: "调整（历史）",
  corporate_action: "公司行为"
};

const ledgerEventTypeOptions: { value: LedgerEventType; label: string }[] = [
  { value: "trade", label: ledgerEventTypeLabels.trade },
  { value: "cash", label: ledgerEventTypeLabels.cash },
  { value: "corporate_action", label: ledgerEventTypeLabels.corporate_action }
];
const TARGET_POOL_STRUCTURE_EMPTY: TargetPoolStructureStats = {
  totalSymbols: 0,
  industryL1Count: 0,
  industryL2Count: 0,
  conceptCount: 0,
  unclassifiedCount: 0,
  classificationCoverage: null,
  allSymbols: [],
  classifiedSymbols: [],
  industryL1Details: [],
  industryL2Details: [],
  conceptDetails: [],
  unclassifiedSymbols: [],
  symbolNames: {},
  loading: false,
  error: null
};

const CONTRIBUTION_TOP_N = 5;
const HHI_WARN_THRESHOLD = 0.25;

export function Dashboard({ account, onLock, onActivePortfolioChange }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const {
    error,
    setError,
    notice,
    setNotice,
    activeView,
    setActiveView,
    otherTab,
    setOtherTab,
    analysisTab,
    setAnalysisTab,
    isNavCollapsed,
    setIsNavCollapsed
  } = useDashboardUi();
  const {
    analysisInstrumentQuery,
    setAnalysisInstrumentQuery,
    analysisInstrumentSearchResults,
    setAnalysisInstrumentSearchResults,
    analysisInstrumentSearchLoading,
    setAnalysisInstrumentSearchLoading,
    analysisInstrumentSymbol,
    setAnalysisInstrumentSymbol,
    analysisInstrumentRange,
    setAnalysisInstrumentRange,
    analysisInstrumentProfile,
    setAnalysisInstrumentProfile,
    analysisInstrumentUserTags,
    setAnalysisInstrumentUserTags,
    analysisInstrumentQuote,
    setAnalysisInstrumentQuote,
    analysisInstrumentBars,
    setAnalysisInstrumentBars,
    analysisInstrumentLoading,
    setAnalysisInstrumentLoading,
    analysisInstrumentError,
    setAnalysisInstrumentError
  } = useDashboardAnalysis<MarketChartRangeKey>({
    defaultInstrumentRange: "6M"
  });
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("overview");
  const [performanceRange, setPerformanceRange] = useState<PerformanceRangeKey>(
    "1Y"
  );
  const [performanceResult, setPerformanceResult] =
    useState<PortfolioPerformanceRangeResult | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [showAllSymbolContribution, setShowAllSymbolContribution] =
    useState(false);
  const [showAllAssetContribution, setShowAllAssetContribution] =
    useState(false);
  const [riskAnnualized, setRiskAnnualized] = useState(true);

  const {
    marketCatalogSyncing,
    setMarketCatalogSyncing,
    marketCatalogSyncSummary,
    setMarketCatalogSyncSummary,
    marketSearchQuery,
    setMarketSearchQuery,
    marketSearchResults,
    marketSearchLoading,
    marketScope,
    setMarketScope,
    marketExplorerWidth,
    setMarketExplorerWidth,
    targetsEditorLeftPct,
    setTargetsEditorLeftPct,
    marketTags,
    setMarketTags,
    marketTagsLoading,
    setMarketTagsLoading,
    marketTagPickerOpen,
    setMarketTagPickerOpen,
    marketTagPickerQuery,
    setMarketTagPickerQuery,
    marketSelectedTag,
    setMarketSelectedTag,
    marketTagMembers,
    setMarketTagMembers,
    marketTagMembersLoading,
    setMarketTagMembersLoading,
    marketFiltersOpen,
    setMarketFiltersOpen,
    marketFilterMarket,
    setMarketFilterMarket,
    marketFilterAssetClasses,
    setMarketFilterAssetClasses,
    marketFilterKinds,
    setMarketFilterKinds,
    marketQuotesBySymbol,
    setMarketQuotesBySymbol,
    marketQuotesLoading,
    setMarketQuotesLoading,
    marketChartRange,
    setMarketChartRange,
    marketChartBars,
    setMarketChartBars,
    marketChartLoading,
    setMarketChartLoading,
    marketVolumeMode,
    setMarketVolumeMode,
    marketDemoSeeding,
    setMarketDemoSeeding,
    marketTagSeriesResult,
    marketTagSeriesBars,
    marketTagSeriesLoading,
    marketTagSeriesError,
    marketTagChartHoverDate,
    setMarketTagChartHoverDate,
    marketTagChartHoverPrice,
    setMarketTagChartHoverPrice,
    marketInstrumentDetailsOpen,
    setMarketInstrumentDetailsOpen,
    marketTagMembersModalOpen,
    setMarketTagMembersModalOpen,
    marketTokenStatus,
    setMarketTokenStatus,
    marketTokenDraft,
    setMarketTokenDraft,
    marketTokenProvider,
    setMarketTokenProvider,
    marketTokenSaving,
    setMarketTokenSaving,
    marketTokenTesting,
    setMarketTokenTesting,
    marketIngestRuns,
    setMarketIngestRuns,
    marketIngestRunsLoading,
    setMarketIngestRunsLoading,
    marketIngestTriggering,
    setMarketIngestTriggering,
    marketSelectedSymbol,
    setMarketSelectedSymbol,
    marketSelectedProfile,
    setMarketSelectedProfile,
    marketSelectedUserTags,
    setMarketSelectedUserTags,
    marketUserTagDraft,
    setMarketUserTagDraft,
    marketShowProviderData,
    setMarketShowProviderData,
    marketManualThemeOptions,
    setMarketManualThemeOptions,
    marketManualThemeLoading,
    setMarketManualThemeLoading,
    marketManualThemeDraft,
    setMarketManualThemeDraft,
    marketWatchlistItems,
    setMarketWatchlistItems,
    marketWatchlistLoading,
    setMarketWatchlistLoading,
    marketWatchlistGroupDraft,
    setMarketWatchlistGroupDraft,
    marketTargetsConfig,
    setMarketTargetsConfig,
    marketTargetsSavedConfig,
    setMarketTargetsSavedConfig,
    marketTargetsPreview,
    setMarketTargetsPreview,
    marketTargetsDiffPreview,
    setMarketTargetsDiffPreview,
    marketTargetsLoading,
    setMarketTargetsLoading,
    marketTargetsSaving,
    setMarketTargetsSaving,
    marketTargetsSymbolDraft,
    setMarketTargetsSymbolDraft,
    marketManualSymbolPreview,
    setMarketManualSymbolPreview,
    marketTargetsTagDraft,
    setMarketTargetsTagDraft,
    marketTagManagementQuery,
    setMarketTagManagementQuery,
    marketCurrentTargetsModalOpen,
    setMarketCurrentTargetsModalOpen,
    marketCurrentTargetsFilter,
    setMarketCurrentTargetsFilter,
    marketTargetPoolDetailMetric,
    setMarketTargetPoolDetailMetric,
    marketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailCategoryKey,
    marketTargetPoolDetailMemberFilter,
    setMarketTargetPoolDetailMemberFilter,
    marketTargetsSectionOpen,
    setMarketTargetsSectionOpen,
    marketDiffSectionOpen,
    setMarketDiffSectionOpen,
    marketTargetPoolStatsScope,
    setMarketTargetPoolStatsScope,
    marketTargetPoolStatsByScope,
    setMarketTargetPoolStatsByScope,
    marketTempTargets,
    setMarketTempTargets,
    marketTempTargetsLoading,
    setMarketTempTargetsLoading,
    marketSelectedTempTargetSymbols,
    setMarketSelectedTempTargetSymbols,
    marketIngestControlStatus,
    setMarketIngestControlStatus,
    marketIngestControlUpdating,
    setMarketIngestControlUpdating,
    marketSchedulerConfig,
    setMarketSchedulerConfig,
    marketSchedulerSavedConfig,
    setMarketSchedulerSavedConfig,
    marketSchedulerLoading,
    setMarketSchedulerLoading,
    marketSchedulerSaving,
    setMarketSchedulerSaving,
    marketUniversePoolConfig,
    setMarketUniversePoolConfig,
    marketUniversePoolSavedConfig,
    setMarketUniversePoolSavedConfig,
    marketUniversePoolOverview,
    setMarketUniversePoolOverview,
    marketUniversePoolLoading,
    setMarketUniversePoolLoading,
    marketUniversePoolSaving,
    setMarketUniversePoolSaving,
    marketSchedulerAdvancedOpen,
    setMarketSchedulerAdvancedOpen,
    marketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedOpen,
    marketTriggerIngestBlockedMessage,
    setMarketTriggerIngestBlockedMessage,
    marketRegistryResult,
    setMarketRegistryResult,
    marketRegistryLoading,
    setMarketRegistryLoading,
    marketRegistryQuery,
    setMarketRegistryQuery,
    marketRegistryAutoFilter,
    setMarketRegistryAutoFilter,
    marketRegistrySelectedSymbols,
    setMarketRegistrySelectedSymbols,
    marketRegistryUpdating,
    setMarketRegistryUpdating,
    marketSelectedIngestRunId,
    setMarketSelectedIngestRunId,
    marketSelectedIngestRun,
    setMarketSelectedIngestRun,
    marketSelectedIngestRunLoading,
    setMarketSelectedIngestRunLoading,
    marketChartHoverDate,
    setMarketChartHoverDate,
    marketChartHoverPrice,
    setMarketChartHoverPrice
  } = useDashboardMarket({
    clampNumber,
    defaultMarketScope: "holdings" as MarketScope,
    defaultMarketFilterMarket: "all" as MarketFilterMarket,
    defaultMarketChartRange: "6M" as MarketChartRangeKey,
    defaultTokenProvider: "tushare",
    marketExplorerDefaultWidth: MARKET_EXPLORER_DEFAULT_WIDTH,
    marketExplorerMinWidth: MARKET_EXPLORER_MIN_WIDTH,
    marketExplorerMaxWidth: MARKET_EXPLORER_MAX_WIDTH,
    marketExplorerStorageKey: MARKET_EXPLORER_WIDTH_STORAGE_KEY,
    targetsEditorSplitDefault: TARGETS_EDITOR_SPLIT_DEFAULT,
    targetsEditorSplitMin: TARGETS_EDITOR_SPLIT_MIN,
    targetsEditorSplitMax: TARGETS_EDITOR_SPLIT_MAX,
    targetsEditorSplitStorageKey: TARGETS_EDITOR_SPLIT_STORAGE_KEY,
    defaultTargetsConfig: {
      includeHoldings: true,
      includeRegistryAutoIngest: false,
      includeWatchlist: true,
      portfolioIds: null,
      explicitSymbols: [],
      tagFilters: []
    },
    defaultManualSymbolPreview: {
      addable: [],
      existing: [],
      invalid: [],
      duplicates: 0
    },
    defaultTargetsSectionOpen: {
      scope: true,
      symbols: true
    },
    defaultDiffSectionOpen: {
      added: false,
      removed: false,
      reasonChanged: false
    },
    defaultTargetPoolStatsScope: "focus" as TargetPoolStatsScope,
    defaultTargetPoolStatsByScope: {
      universe: { ...TARGET_POOL_STRUCTURE_EMPTY },
      focus: { ...TARGET_POOL_STRUCTURE_EMPTY }
    } as Record<TargetPoolStatsScope, TargetPoolStructureStats>,
    defaultRegistryAutoFilter: "all",
    activeView,
    snapshotPriceAsOf: snapshot?.priceAsOf ?? null,
    toUserErrorMessage,
    reportError: (message) => setError(message),
    resolveMarketChartDateRange,
    formatInputDate
  });
  const {
    targetsEditorGridRef,
    handleMarketExplorerResizePointerDown,
    handleMarketExplorerResizeKeyDown,
    handleTargetsEditorResizePointerDown,
    handleTargetsEditorResizeKeyDown
  } = useDashboardMarketResize({
    clampNumber,
    marketExplorerWidth,
    marketExplorerMinWidth: MARKET_EXPLORER_MIN_WIDTH,
    marketExplorerMaxWidth: MARKET_EXPLORER_MAX_WIDTH,
    targetsEditorLeftPct,
    targetsEditorSplitMin: TARGETS_EDITOR_SPLIT_MIN,
    targetsEditorSplitMax: TARGETS_EDITOR_SPLIT_MAX,
    setMarketExplorerWidth,
    setTargetsEditorLeftPct
  });

  const latestMarketIngestRun = useMemo(() => {
    if (marketIngestRuns.length === 0) return null;
    return marketIngestRuns.reduce((latest, candidate) =>
      candidate.startedAt > latest.startedAt ? candidate : latest
    );
  }, [marketIngestRuns]);

  const marketSelectedIndustry = marketSelectedProfile?.tagFacets?.industry ?? [];
  const marketSelectedThemes = marketSelectedProfile?.tagFacets?.themes ?? [];
  const marketSelectedManualThemes = useMemo(
    () => marketSelectedUserTags.filter((tag) => tag.startsWith("theme:manual:")),
    [marketSelectedUserTags]
  );
  const marketSelectedPlainUserTags = useMemo(
    () => marketSelectedUserTags.filter((tag) => !tag.startsWith("theme:manual:")),
    [marketSelectedUserTags]
  );

  const marketTargetsDirty = useMemo(() => {
    if (!marketTargetsSavedConfig) return false;
    return !isSameTargetsConfig(marketTargetsSavedConfig, marketTargetsConfig);
  }, [marketTargetsConfig, marketTargetsSavedConfig]);

  const marketSchedulerDirty = useMemo(() => {
    if (!marketSchedulerConfig || !marketSchedulerSavedConfig) return false;
    return !isSameSchedulerConfig(marketSchedulerSavedConfig, marketSchedulerConfig);
  }, [marketSchedulerConfig, marketSchedulerSavedConfig]);

  const marketUniversePoolDirty = useMemo(() => {
    if (!marketUniversePoolConfig || !marketUniversePoolSavedConfig) return false;
    return !isSameUniversePoolConfig(
      marketUniversePoolSavedConfig,
      marketUniversePoolConfig
    );
  }, [marketUniversePoolConfig, marketUniversePoolSavedConfig]);

  const marketIngestControlState = marketIngestControlStatus?.state ?? "idle";
  const marketCanTriggerIngestNow =
    !marketIngestControlUpdating && Boolean(marketTokenStatus?.configured);
  const marketCanPauseIngest =
    !marketIngestControlUpdating && marketIngestControlState === "running";
  const marketCanResumeIngest =
    !marketIngestControlUpdating && marketIngestControlState === "paused";
  const marketCanCancelIngest =
    !marketIngestControlUpdating &&
    (marketIngestControlState === "running" ||
      marketIngestControlState === "paused");

  const marketSchedulerTimezoneOptions = useMemo(() => {
    const values = [...schedulerTimezoneDefaults];
    const current = marketSchedulerConfig?.timezone?.trim();
    if (current && !values.includes(current)) {
      values.unshift(current);
    }
    return values.map((value) => ({ value, label: value }));
  }, [marketSchedulerConfig?.timezone]);

  const marketRegistryEntryEnabled = false;

  const marketCurrentTargetsSource = useMemo(
    () => marketTargetsDiffPreview?.draft.symbols ?? marketTargetsPreview?.symbols ?? [],
    [marketTargetsDiffPreview?.draft.symbols, marketTargetsPreview?.symbols]
  );

  const marketCurrentTargetsKeyword = marketCurrentTargetsFilter
    .trim()
    .toLowerCase();

  const marketFilteredCurrentTargets = useMemo(() => {
    if (!marketCurrentTargetsKeyword) return marketCurrentTargetsSource;
    return marketCurrentTargetsSource.filter((row) =>
      row.symbol.toLowerCase().includes(marketCurrentTargetsKeyword)
    );
  }, [marketCurrentTargetsKeyword, marketCurrentTargetsSource]);

  const marketFilteredAddedSymbols = useMemo(() => {
    return marketTargetsDiffPreview?.addedSymbols ?? [];
  }, [marketTargetsDiffPreview?.addedSymbols]);

  const marketFilteredRemovedSymbols = useMemo(() => {
    return marketTargetsDiffPreview?.removedSymbols ?? [];
  }, [marketTargetsDiffPreview?.removedSymbols]);

  const marketFilteredReasonChangedSymbols = useMemo(() => {
    return marketTargetsDiffPreview?.reasonChangedSymbols ?? [];
  }, [marketTargetsDiffPreview?.reasonChangedSymbols]);

  const marketFocusTargetSymbols = useMemo(
    () =>
      Array.from(
        new Set(
          (marketTargetsDiffPreview?.draft.symbols ?? marketTargetsPreview?.symbols ?? [])
            .map((item) => item.symbol.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [marketTargetsDiffPreview?.draft.symbols, marketTargetsPreview?.symbols]
  );

  const marketActiveTargetPoolStats = useMemo(
    () => marketTargetPoolStatsByScope[marketTargetPoolStatsScope],
    [marketTargetPoolStatsByScope, marketTargetPoolStatsScope]
  );

  const marketUniverseEnabledBuckets = useMemo(() => {
    const source = marketUniversePoolConfig?.enabledBuckets ?? UNIVERSE_POOL_BUCKET_ORDER;
    return new Set(source);
  }, [marketUniversePoolConfig?.enabledBuckets]);

  const marketUniverseBucketStatusById = useMemo(() => {
    const map = new Map<UniversePoolBucketId, MarketUniversePoolBucketStatus>();
    marketUniversePoolOverview?.buckets.forEach((item) => map.set(item.bucket, item));
    return map;
  }, [marketUniversePoolOverview?.buckets]);

  const {
    marketTargetPoolMetricCards,
    marketTargetPoolDetailTitle,
    marketTargetPoolDetailValue,
    marketTargetPoolDetailDescription,
    marketTargetPoolDetailCategoryRows,
    marketTargetPoolActiveCategoryRow,
    marketTargetPoolDetailMembers,
    handleToggleTargetsSection,
    handleToggleDiffSection
  } = useDashboardMarketTargetPoolDetail({
    marketTargetPoolStatsScope,
    marketActiveTargetPoolStats,
    marketTargetPoolDetailMetric,
    marketTargetPoolDetailCategoryKey,
    marketTargetPoolDetailMemberFilter,
    formatPct,
    setMarketTargetPoolDetailCategoryKey,
    setMarketTargetPoolDetailMemberFilter,
    setMarketTargetsSectionOpen,
    setMarketDiffSectionOpen
  });

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [portfolios, activePortfolioId]
  );

  const {
    portfolioName,
    setPortfolioName,
    portfolioBaseCurrency,
    setPortfolioBaseCurrency,
    portfolioRename,
    setPortfolioRename,
    positionForm,
    setPositionForm,
    riskForm,
    setRiskForm,
    ledgerEntries,
    setLedgerEntries,
    ledgerLoading,
    setLedgerLoading,
    ledgerError,
    setLedgerError,
    ledgerFilter,
    setLedgerFilter,
    ledgerStartDate,
    setLedgerStartDate,
    ledgerEndDate,
    setLedgerEndDate,
    ledgerForm,
    setLedgerForm,
    isLedgerFormOpen,
    setIsLedgerFormOpen,
    ledgerDeleteTarget,
    setLedgerDeleteTarget,
    holdingsCsvPath,
    setHoldingsCsvPath,
    pricesCsvPath,
    setPricesCsvPath
  } = useDashboardPortfolio<
    PositionFormState,
    RiskFormState,
    LedgerFormState,
    LedgerEntry,
    LedgerFilter
  >({
    activePortfolioName: activePortfolio?.name ?? null,
    activePortfolioBaseCurrency: activePortfolio?.baseCurrency ?? null,
    activePortfolioResetKey: activePortfolio?.id ?? null,
    emptyPositionForm,
    emptyRiskForm,
    createEmptyLedgerForm,
    defaultBaseCurrency: "CNY",
    defaultLedgerFilter: "all",
    defaultLedgerStartDate: DEFAULT_LEDGER_START_DATE,
    defaultLedgerEndDate: DEFAULT_LEDGER_END_DATE
  });

  const {
    loadPortfolios,
    loadSnapshot,
    loadLedgerEntries,
    loadPerformance
  } = useDashboardPortfolioRuntime({
    activePortfolioId,
    activeView,
    analysisTab,
    portfolioTab,
    performanceRange,
    toUserErrorMessage,
    setError,
    setIsLoading,
    setPortfolios,
    setActivePortfolioId,
    setPortfolioRename,
    setSnapshot,
    setLedgerEntries,
    setLedgerLoading,
    setLedgerError,
    setPerformanceLoading,
    setPerformanceError,
    setPerformanceResult
  });

  useEffect(() => {
    if (!onActivePortfolioChange) return;
    onActivePortfolioChange({
      id: activePortfolio?.id ?? null,
      name: activePortfolio?.name ?? null
    });
  }, [activePortfolio?.id, activePortfolio?.name, onActivePortfolioChange]);

  const marketHoldingsSymbols = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.positions
      .filter((pos) => pos.position.assetClass !== "cash")
      .map((pos) => pos.position.symbol)
      .filter(Boolean);
  }, [snapshot]);

  const marketHoldingsMetaBySymbol = useMemo(() => {
    const map = new Map<
      string,
      { assetClass: AssetClass | null; market: string | null }
    >();
    snapshot?.positions.forEach((pos) => {
      if (pos.position.assetClass === "cash") return;
      const symbol = pos.position.symbol;
      if (!symbol) return;
      map.set(symbol, {
        assetClass: pos.position.assetClass ?? null,
        market: pos.position.market ?? null
      });
    });
    return map;
  }, [snapshot]);

  const marketHoldingsSymbolsFiltered = useMemo(() => {
    return marketHoldingsSymbols.filter((symbol) => {
      const meta = marketHoldingsMetaBySymbol.get(symbol) ?? null;
      if (marketFilterMarket !== "all") {
        if (!meta?.market || meta.market !== marketFilterMarket) return false;
      }
      if (marketFilterAssetClasses.length > 0) {
        if (!meta?.assetClass) return false;
        if (!marketFilterAssetClasses.includes(meta.assetClass)) return false;
      }
      return true;
    });
  }, [
    marketFilterAssetClasses,
    marketFilterMarket,
    marketHoldingsMetaBySymbol,
    marketHoldingsSymbols
  ]);

  const marketSelectedQuote = useMemo(() => {
    if (!marketSelectedSymbol) return null;
    return marketQuotesBySymbol[marketSelectedSymbol] ?? null;
  }, [marketQuotesBySymbol, marketSelectedSymbol]);

  const marketBarsByDate = useMemo(() => {
    const map = new Map<string, MarketDailyBar>();
    marketChartBars.forEach((bar) => {
      map.set(bar.date, bar);
    });
    return map;
  }, [marketChartBars]);

  const marketActiveVolume = useMemo(() => {
    if (!marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(marketChartHoverDate) ?? null;
    return bar?.volume ?? null;
  }, [marketBarsByDate, marketChartHoverDate]);

  const marketActiveMoneyflowVol = useMemo(() => {
    if (!marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(marketChartHoverDate) ?? null;
    const value = bar?.netMfVol ?? null;
    return value !== null && Number.isFinite(value) ? value : null;
  }, [marketBarsByDate, marketChartHoverDate]);

  const marketActiveMoneyflowRatio = useMemo(() => {
    if (!marketChartHoverDate) return null;
    const bar = marketBarsByDate.get(marketChartHoverDate) ?? null;
    const volume = bar?.volume ?? null;
    const mf = bar?.netMfVol ?? null;
    if (
      volume === null ||
      !Number.isFinite(volume) ||
      volume <= 0 ||
      mf === null ||
      !Number.isFinite(mf)
    ) {
      return null;
    }
    return Math.abs(mf) / volume;
  }, [marketBarsByDate, marketChartHoverDate]);

  const marketNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.positions.forEach((pos) => {
      const symbol = pos.position.symbol;
      if (symbol) map.set(symbol, pos.position.name ?? symbol);
    });
    marketWatchlistItems.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    marketSearchResults.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    if (marketSelectedProfile) {
      map.set(
        marketSelectedProfile.symbol,
        marketSelectedProfile.name ?? marketSelectedProfile.symbol
      );
    }
    return map;
  }, [marketSearchResults, marketSelectedProfile, marketWatchlistItems, snapshot]);

  const marketListFilter = marketSearchQuery.trim().toLowerCase();
  const marketEffectiveScope: MarketScope =
    marketListFilter.length > 0 ? "search" : marketScope;
  const marketCollectionSelectValue = useMemo(() => {
    if (marketScope === "holdings") return "builtin:holdings";
    if (marketScope === "tags") {
      if (marketSelectedTag === "watchlist:all") return "builtin:watchlist";
      if (marketSelectedTag) return `tag:${marketSelectedTag}`;
    }
    return "builtin:holdings";
  }, [marketScope, marketSelectedTag]);

  const marketSearchResultsFiltered = useMemo(() => {
    return marketSearchResults.filter((item) => {
      if (marketFilterMarket !== "all") {
        if (!item.market || item.market !== marketFilterMarket) return false;
      }
      if (marketFilterKinds.length > 0) {
        if (!marketFilterKinds.includes(item.kind)) return false;
      }
      if (marketFilterAssetClasses.length > 0) {
        if (!item.assetClass) return false;
        if (!marketFilterAssetClasses.includes(item.assetClass)) return false;
      }
      return true;
    });
  }, [marketFilterAssetClasses, marketFilterKinds, marketFilterMarket, marketSearchResults]);

  const marketSearchResultSymbols = useMemo(
    () => marketSearchResultsFiltered.map((item) => item.symbol),
    [marketSearchResultsFiltered]
  );

  const marketCurrentListSymbols = useMemo(() => {
    if (marketEffectiveScope === "holdings") return marketHoldingsSymbolsFiltered;
    if (marketEffectiveScope === "search")
      return marketSearchResults.map((item) => item.symbol);
    if (marketEffectiveScope === "tags") return marketSelectedTag ? marketTagMembers : [];
    return [];
  }, [
    marketHoldingsSymbolsFiltered,
    marketEffectiveScope,
    marketSearchResults,
    marketSelectedTag,
    marketTagMembers
  ]);

  const marketFilteredListSymbols = useMemo(() => {
    if (!marketListFilter || marketEffectiveScope === "search") return marketCurrentListSymbols;
    return marketCurrentListSymbols.filter((symbol) => {
      const name = marketNameBySymbol.get(symbol) ?? "";
      return (
        symbol.toLowerCase().includes(marketListFilter) ||
        name.toLowerCase().includes(marketListFilter)
      );
    });
  }, [marketCurrentListSymbols, marketListFilter, marketNameBySymbol, marketEffectiveScope]);

  const marketSelectedTagAggregate = useMemo(() => {
    if (!marketSelectedTag) return null;
    return computeTagAggregate(marketTagMembers, marketQuotesBySymbol);
  }, [marketQuotesBySymbol, marketSelectedTag, marketTagMembers]);

  const marketSelectedTagSeriesReturnPct = useMemo(() => {
    const closes = marketTagSeriesBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (closes.length < 2) return null;
    const first = closes[0];
    const last = closes[closes.length - 1];
    if (first === 0) return null;
    return (last - first) / first;
  }, [marketTagSeriesBars]);

  const marketSelectedTagSeriesTone = useMemo(() => {
    return getCnChangeTone(marketSelectedTagSeriesReturnPct);
  }, [marketSelectedTagSeriesReturnPct]);

  const marketTagSeriesLatestCoverageLabel = useMemo(() => {
    const points = marketTagSeriesResult?.points ?? [];
    if (points.length === 0) return "--";
    const last = points[points.length - 1];
    return `覆盖 ${last.includedCount}/${last.totalCount}`;
  }, [marketTagSeriesResult]);

  const marketFiltersActiveCount = useMemo(() => {
    let count = 0;
    if (marketFilterMarket !== "all") count += 1;
    if (marketFilterAssetClasses.length > 0) count += 1;
    if (marketFilterKinds.length > 0) count += 1;
    return count;
  }, [marketFilterAssetClasses, marketFilterKinds, marketFilterMarket]);

  const marketLatestBar = useMemo(() => {
    for (let idx = marketChartBars.length - 1; idx >= 0; idx -= 1) {
      const bar = marketChartBars[idx];
      if (bar.close !== null) return bar;
    }
    return null;
  }, [marketChartBars]);

  const marketChartHasEnoughData = useMemo(() => {
    let count = 0;
    for (const bar of marketChartBars) {
      const close = bar.close;
      if (close !== null && Number.isFinite(close)) count += 1;
      if (count >= 2) return true;
    }
    return false;
  }, [marketChartBars]);

  const marketRangeSummary = useMemo(() => {
    const closes = marketChartBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const highs = marketChartBars
      .map((bar) => bar.high)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const lows = marketChartBars
      .map((bar) => bar.low)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const volumes = marketChartBars
      .map((bar) => bar.volume)
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const firstClose = closes.length > 0 ? closes[0] : null;
    const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
    const rangeReturn =
      firstClose !== null && lastClose !== null && firstClose !== 0
        ? (lastClose - firstClose) / firstClose
        : null;

    const rangeHigh = highs.length > 0 ? Math.max(...highs) : null;
    const rangeLow = lows.length > 0 ? Math.min(...lows) : null;
    const avgVolume =
      volumes.length > 0
        ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
        : null;

    return { rangeHigh, rangeLow, avgVolume, rangeReturn };
  }, [marketChartBars]);

  const marketSelectedPositionValuation = useMemo(() => {
    if (!snapshot || !marketSelectedSymbol) return null;
    return (
      snapshot.positions.find((pos) => pos.position.symbol === marketSelectedSymbol) ??
      null
    );
  }, [marketSelectedSymbol, snapshot]);

  const marketHoldingUnitCost = useMemo(() => {
    if (!marketSelectedSymbol) return null;
    const position = marketSelectedPositionValuation?.position ?? null;
    if (!position || position.quantity <= 0) return null;

    const direct = position.cost;
    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    const fifo = computeFifoUnitCost(ledgerEntries, marketSelectedSymbol);
    if (fifo !== null && Number.isFinite(fifo) && fifo > 0) return fifo;
    return null;
  }, [ledgerEntries, marketSelectedPositionValuation, marketSelectedSymbol]);

  const marketTargetPrice = useMemo(() => {
    return parseTargetPriceFromTags(marketSelectedUserTags);
  }, [marketSelectedUserTags]);

  const analysisInstrumentNameBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    snapshot?.positions.forEach((pos) => {
      const symbol = pos.position.symbol;
      if (symbol) map.set(symbol, pos.position.name ?? symbol);
    });
    marketWatchlistItems.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    analysisInstrumentSearchResults.forEach((item) => {
      map.set(item.symbol, item.name ?? item.symbol);
    });
    if (analysisInstrumentProfile) {
      map.set(
        analysisInstrumentProfile.symbol,
        analysisInstrumentProfile.name ?? analysisInstrumentProfile.symbol
      );
    }
    return map;
  }, [
    analysisInstrumentProfile,
    analysisInstrumentSearchResults,
    marketWatchlistItems,
    snapshot
  ]);

  const analysisInstrumentQuickSymbols = useMemo(() => {
    const set = new Set<string>();
    snapshot?.positions.forEach((pos) => {
      if (pos.position.assetClass === "cash") return;
      if (!pos.position.symbol) return;
      set.add(pos.position.symbol);
    });
    marketWatchlistItems.forEach((item) => {
      if (item.symbol) set.add(item.symbol);
    });
    return Array.from(set).slice(0, 16);
  }, [marketWatchlistItems, snapshot]);

  const { loadAnalysisInstrument } = useDashboardAnalysisRuntime({
    activeView,
    analysisTab,
    analysisInstrumentQuery,
    analysisInstrumentSymbol,
    analysisInstrumentRange,
    analysisInstrumentQuickSymbols,
    snapshotPriceAsOf: snapshot?.priceAsOf,
    toUserErrorMessage,
    resolveMarketChartDateRange,
    formatInputDate,
    setAnalysisInstrumentSearchResults,
    setAnalysisInstrumentSearchLoading,
    setAnalysisInstrumentSymbol,
    setAnalysisInstrumentLoading,
    setAnalysisInstrumentError,
    setAnalysisInstrumentProfile,
    setAnalysisInstrumentUserTags,
    setAnalysisInstrumentQuote,
    setAnalysisInstrumentBars
  });

  const analysisInstrumentLatestBar = useMemo(() => {
    for (let idx = analysisInstrumentBars.length - 1; idx >= 0; idx -= 1) {
      const bar = analysisInstrumentBars[idx];
      if (bar.close !== null) return bar;
    }
    return null;
  }, [analysisInstrumentBars]);

  const analysisInstrumentHasEnoughData = useMemo(() => {
    let count = 0;
    for (const bar of analysisInstrumentBars) {
      if (bar.close !== null && Number.isFinite(bar.close)) {
        count += 1;
      }
      if (count >= 2) return true;
    }
    return false;
  }, [analysisInstrumentBars]);

  const analysisInstrumentRangeSummary = useMemo(() => {
    const closes = analysisInstrumentBars
      .map((bar) => bar.close)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const highs = analysisInstrumentBars
      .map((bar) => bar.high)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const lows = analysisInstrumentBars
      .map((bar) => bar.low)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const volumes = analysisInstrumentBars
      .map((bar) => bar.volume)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const firstClose = closes.length > 0 ? closes[0] : null;
    const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;
    const rangeReturn =
      firstClose !== null && lastClose !== null && firstClose !== 0
        ? (lastClose - firstClose) / firstClose
        : null;
    const rangeHigh = highs.length > 0 ? Math.max(...highs) : null;
    const rangeLow = lows.length > 0 ? Math.min(...lows) : null;
    const avgVolume =
      volumes.length > 0
        ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length
        : null;
    const startDate = analysisInstrumentBars[0]?.date ?? null;
    const endDate = analysisInstrumentBars[analysisInstrumentBars.length - 1]?.date ?? null;
    return { rangeHigh, rangeLow, avgVolume, rangeReturn, startDate, endDate };
  }, [analysisInstrumentBars]);

  const analysisInstrumentPositionValuation = useMemo(() => {
    if (!snapshot || !analysisInstrumentSymbol) return null;
    return (
      snapshot.positions.find((pos) => pos.position.symbol === analysisInstrumentSymbol) ??
      null
    );
  }, [analysisInstrumentSymbol, snapshot]);

  const analysisInstrumentHoldingUnitCost = useMemo(() => {
    if (!analysisInstrumentSymbol) return null;
    const position = analysisInstrumentPositionValuation?.position ?? null;
    if (!position || position.quantity <= 0) return null;

    const direct = position.cost;
    if (direct !== null && Number.isFinite(direct) && direct > 0) return direct;

    const fifo = computeFifoUnitCost(ledgerEntries, analysisInstrumentSymbol);
    if (fifo !== null && Number.isFinite(fifo) && fifo > 0) return fifo;
    return null;
  }, [analysisInstrumentPositionValuation, analysisInstrumentSymbol, ledgerEntries]);

  const analysisInstrumentTargetPrice = useMemo(() => {
    return parseTargetPriceFromTags(analysisInstrumentUserTags);
  }, [analysisInstrumentUserTags]);

  const analysisInstrumentTone = useMemo(() => {
    return getCnChangeTone(
      analysisInstrumentQuote?.changePct ?? analysisInstrumentRangeSummary.rangeReturn
    );
  }, [analysisInstrumentQuote?.changePct, analysisInstrumentRangeSummary.rangeReturn]);

  const cashTotal = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.positions.reduce((sum, valuation) => {
      if (valuation.position.assetClass !== "cash") return sum;
      return sum + (valuation.marketValue ?? valuation.position.quantity);
    }, 0);
  }, [snapshot]);

  const performance = performanceResult?.performance ?? null;
  const performanceSeries = performanceResult?.series ?? null;
  const performanceAnalysis = performanceResult?.analysis ?? null;
  const contributionBreakdown = performanceAnalysis?.contributions ?? null;
  const riskMetrics = performanceAnalysis?.riskMetrics ?? null;
  const dataQuality = snapshot?.dataQuality ?? null;
  const hhiValue = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.exposures.bySymbol.reduce((sum, entry) => {
      return sum + entry.weight * entry.weight;
    }, 0);
  }, [snapshot]);
  const filteredLedgerEntries = useMemo(() => {
    let entries = ledgerEntries;
    if (ledgerFilter !== "all") {
      entries = entries.filter((entry) => {
        if (ledgerFilter === "corporate_action") {
          return (
            entry.eventType === "corporate_action" ||
            entry.eventType === "dividend"
          );
        }
        return entry.eventType === ledgerFilter;
      });
    }
    if (ledgerStartDate) {
      entries = entries.filter((entry) => entry.tradeDate >= ledgerStartDate);
    }
    if (ledgerEndDate) {
      entries = entries.filter((entry) => entry.tradeDate <= ledgerEndDate);
    }
    return entries;
  }, [ledgerEntries, ledgerFilter, ledgerStartDate, ledgerEndDate]);
  const cashFlowTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredLedgerEntries.forEach((entry) => {
      if (entry.cashAmount === null || !entry.cashCurrency) return;
      totals.set(
        entry.cashCurrency,
        (totals.get(entry.cashCurrency) ?? 0) + entry.cashAmount
      );
    });
    return Array.from(totals.entries()).map(([currency, amount]) => ({
      currency,
      amount
    }));
  }, [filteredLedgerEntries]);

  const ledgerDeleteSummary = useMemo(() => {
    if (!ledgerDeleteTarget) return "";
    const symbolLabel =
      ledgerDeleteTarget.symbol ??
      ledgerDeleteTarget.instrumentId ??
      "\u65e0\u6807\u7684";
    return `${formatLedgerEventType(ledgerDeleteTarget.eventType)} · ${ledgerDeleteTarget.tradeDate} · ${symbolLabel}`;
  }, [ledgerDeleteTarget]);
  const toastMessage = useMemo(() => {
    if (error) return sanitizeToastMessage(error);
    return notice ?? "";
  }, [error, notice]);

  const selectedPerformance = useMemo(() => {
    if (!performance) return null;
    if (performance.selectedMethod === "twr") {
      return performance.twr;
    }
    if (performance.selectedMethod === "mwr") {
      return performance.mwr;
    }
    return null;
  }, [performance]);

  useDashboardUiEffects({
    activeView,
    activePortfolioId,
    performanceRange,
    error,
    notice,
    setMarketInstrumentDetailsOpen,
    setMarketTagMembersModalOpen,
    setPortfolioTab,
    setShowAllSymbolContribution,
    setShowAllAssetContribution,
    setError,
    setNotice
  });

  const {
    handleCreatePortfolio,
    handleRenamePortfolio,
    handleDeletePortfolio,
    handleEditPosition,
    handleCancelEditPosition,
    handleSubmitPosition,
    handleDeletePosition,
    handleEditRiskLimit,
    handleCancelRiskEdit,
    handleSubmitRiskLimit,
    handleDeleteRiskLimit
  } = useDashboardPortfolioActions({
    activePortfolio,
    portfolioName,
    portfolioBaseCurrency,
    portfolioRename,
    positionForm,
    riskForm,
    emptyPositionForm,
    emptyRiskForm,
    loadPortfolios,
    loadSnapshot,
    setError,
    setNotice,
    setPortfolioName,
    setPortfolioBaseCurrency,
    setPositionForm,
    setRiskForm
  });

  const {
    updateLedgerForm,
    handleOpenLedgerForm,
    handleEditLedgerEntry,
    handleCancelLedgerEdit,
    handleSubmitLedgerEntry,
    handleRequestDeleteLedgerEntry,
    handleConfirmDeleteLedgerEntry,
    handleCancelDeleteLedgerEntry,
    handleChooseCsv,
    handleImportHoldings,
    handleImportPrices
  } = useDashboardLedgerActions({
    activePortfolio,
    ledgerForm,
    ledgerDeleteTarget,
    holdingsCsvPath,
    pricesCsvPath,
    toUserErrorMessage,
    loadLedgerEntries,
    loadSnapshot,
    setError,
    setNotice,
    setLedgerForm,
    setIsLedgerFormOpen,
    setLedgerDeleteTarget,
    setHoldingsCsvPath,
    setPricesCsvPath
  });

  const {
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    resetMarketFilters,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketTargetsDiff
  } = useDashboardMarketDataLoaders({
    marketTargetsConfig,
    toUserErrorMessage,
    setError,
    setMarketWatchlistLoading,
    setMarketWatchlistItems,
    setMarketTagsLoading,
    setMarketTags,
    setMarketManualThemeLoading,
    setMarketManualThemeOptions,
    setMarketManualThemeDraft,
    setMarketFilterMarket,
    setMarketFilterAssetClasses,
    setMarketFilterKinds,
    setMarketQuotesLoading,
    setMarketQuotesBySymbol,
    setMarketTargetsLoading,
    setMarketTargetsSavedConfig,
    setMarketTargetsConfig,
    setMarketTargetsDiffPreview,
    setMarketTargetsPreview,
    setMarketTempTargetsLoading,
    setMarketTempTargets,
    setMarketManualSymbolPreview
  });

  const refreshMarketTargetPoolStats = useDashboardMarketTargetPoolStats({
    marketFocusTargetSymbols,
    marketUniversePoolEnabledBuckets: marketUniversePoolConfig?.enabledBuckets,
    universePoolBucketOrder: UNIVERSE_POOL_BUCKET_ORDER,
    toUserErrorMessage,
    setMarketTargetPoolStatsByScope
  });

  const {
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketUniversePoolOverview,
    refreshMarketRegistry,
    refreshMarketIngestRunDetail
  } = useDashboardMarketAdminRefresh({
    marketRegistryQuery,
    marketRegistryAutoFilter,
    toUserErrorMessage,
    setError,
    setMarketTokenStatus,
    setMarketIngestRuns,
    setMarketIngestRunsLoading,
    setMarketIngestControlStatus,
    setMarketSchedulerConfig,
    setMarketSchedulerSavedConfig,
    setMarketSchedulerLoading,
    setMarketUniversePoolConfig,
    setMarketUniversePoolSavedConfig,
    setMarketUniversePoolOverview,
    setMarketUniversePoolLoading,
    setMarketRegistryResult,
    setMarketRegistryLoading,
    setMarketRegistrySelectedSymbols,
    setMarketSelectedIngestRunId,
    setMarketSelectedIngestRun,
    setMarketSelectedIngestRunLoading
  });

  const {
    handleOpenMarketProvider,
    handleSaveMarketToken,
    handleClearMarketToken,
    handleTestMarketToken,
    handleToggleUniversePoolBucket,
    handleSaveUniversePoolConfig,
    handleTriggerMarketIngest
  } = useDashboardMarketAdminActions({
    marketTokenProvider,
    marketTokenDraft,
    marketUniversePoolConfig,
    refreshMarketTokenStatus,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketTargetPoolStats,
    toUserErrorMessage,
    universePoolBucketOrder: UNIVERSE_POOL_BUCKET_ORDER,
    setError,
    setNotice,
    setMarketTokenStatus,
    setMarketTokenDraft,
    setMarketTokenSaving,
    setMarketTokenTesting,
    setMarketUniversePoolConfig,
    setMarketUniversePoolSavedConfig,
    setMarketUniversePoolOverview,
    setMarketUniversePoolSaving,
    setMarketIngestTriggering
  });

  const setMarketScopeToTags = useCallback(() => {
    setMarketScope("tags");
  }, [setMarketScope]);

  const {
    handleSyncInstrumentCatalog,
    handleSelectInstrument,
    handleSelectTag,
    handleSeedMarketDemoData,
    handleAddUserTag,
    handleRemoveUserTag,
    handleAddManualTheme,
    handleAddSelectedToWatchlist,
    handleRemoveWatchlistItem
  } = useDashboardMarketInstrumentActions({
    activePortfolioId,
    marketSelectedSymbol,
    marketUserTagDraft,
    marketManualThemeDraft,
    marketManualThemeOptions,
    marketSelectedUserTags,
    marketSelectedProfile,
    marketWatchlistGroupDraft,
    toUserErrorMessage,
    loadSnapshot,
    loadMarketQuotes,
    refreshMarketTargets,
    refreshMarketWatchlist,
    refreshMarketTags,
    setMarketScopeToTags,
    setError,
    setNotice,
    setMarketCatalogSyncing,
    setMarketCatalogSyncSummary,
    setMarketInstrumentDetailsOpen,
    setMarketTagMembersModalOpen,
    setMarketSelectedSymbol,
    setMarketSelectedProfile,
    setMarketSelectedUserTags,
    setMarketShowProviderData,
    setMarketChartHoverDate,
    setMarketChartHoverPrice,
    setMarketChartLoading,
    setMarketTempTargets,
    setMarketTargetsPreview,
    setMarketSelectedTag,
    setMarketTagMembers,
    setMarketChartBars,
    setMarketTagMembersLoading,
    setMarketDemoSeeding,
    setMarketUserTagDraft
  });

  const handleAddTargetTag = useCallback(
    (raw?: string) => {
      const tag = (raw ?? marketTargetsTagDraft).trim();
      if (!tag) return;
      if (!tag.includes(":")) {
        setError("标签必须包含命名空间，例如 industry:白酒。");
        return;
      }
      setMarketTargetsConfig((prev) => {
        if (prev.tagFilters.includes(tag)) return prev;
        return { ...prev, tagFilters: [...prev.tagFilters, tag] };
      });
      setError(null);
      if (raw === undefined) setMarketTargetsTagDraft("");
    },
    [marketTargetsTagDraft]
  );

  const {
    handlePreviewManualTargetSymbols,
    handleApplyManualTargetSymbols,
    handleRemoveManualPreviewSymbol,
    handleRemoveTempTarget,
    handlePromoteTempTarget,
    handleSaveTargets,
    handleResetTargetsDraft,
    handleToggleTempTargetSelection,
    handleSelectAllTempTargets,
    handleBatchPromoteTempTargets,
    handleBatchRemoveTempTargets,
    handleBatchExtendTempTargets
  } = useDashboardMarketTargetActions({
    marketTargetsConfig,
    marketTargetsSavedConfig,
    marketTargetsSymbolDraft,
    marketManualSymbolPreview,
    marketSelectedTempTargetSymbols,
    marketTempTargets,
    toUserErrorMessage,
    refreshMarketTargets,
    refreshMarketTargetsDiff,
    setError,
    setNotice,
    setMarketTargetsConfig,
    setMarketTargetsSavedConfig,
    setMarketTargetsSymbolDraft,
    setMarketManualSymbolPreview,
    setMarketTargetsDiffPreview,
    setMarketTargetsPreview,
    setMarketTargetsSaving,
    setMarketTempTargets,
    setMarketTempTargetsLoading,
    setMarketSelectedTempTargetSymbols
  });

  const {
    handlePauseMarketIngest,
    handleResumeMarketIngest,
    handleCancelMarketIngest,
    updateMarketSchedulerConfig,
    handleSaveMarketSchedulerConfig,
    handleRunMarketIngestNow,
    handleToggleRegistrySymbol,
    handleToggleSelectAllRegistry,
    handleSetRegistryAutoIngest,
    handleBatchSetRegistryAutoIngest
  } = useDashboardMarketManagementActions({
    marketSchedulerConfig,
    marketIngestControlState,
    marketIngestTriggering,
    marketRegistryResult,
    marketRegistrySelectedSymbols,
    toUserErrorMessage,
    handleTriggerMarketIngest,
    refreshMarketIngestRuns,
    refreshMarketRegistry,
    refreshMarketTargetsDiff,
    setError,
    setNotice,
    setMarketIngestControlStatus,
    setMarketIngestControlUpdating,
    setMarketSchedulerConfig,
    setMarketSchedulerSavedConfig,
    setMarketSchedulerSaving,
    setMarketTriggerIngestBlockedOpen,
    setMarketTriggerIngestBlockedMessage,
    setMarketRegistrySelectedSymbols,
    setMarketRegistryUpdating
  });

  const restoreDataManagementView = useCallback(() => {
    setActiveView("other");
    setOtherTab("data-management");
  }, []);

  useDashboardMarketRuntimeEffects({
    activeView,
    otherTab,
    analysisInstrumentViewActive:
      activeView === "data-analysis" && analysisTab === "instrument",
    marketEffectiveScope,
    holdingsScopeValue: "holdings",
    searchScopeValue: "search",
    tagsScopeValue: "tags",
    holdingsSymbols: marketHoldingsSymbolsFiltered,
    searchSymbols: marketSearchResultSymbols,
    loadMarketQuotes,
    marketSelectedSymbol,
    marketSelectedTag,
    marketSearchQuery,
    marketTagManagementQuery,
    marketWatchlistCount: marketWatchlistItems.length,
    marketInstrumentDetailsOpen,
    marketIngestRuns,
    marketSelectedIngestRunId,
    marketRegistryEntryEnabled,
    marketRegistryAutoFilter,
    marketRegistryQuery,
    marketTargetsConfig,
    marketFocusTargetSymbols,
    marketTargetsDirty,
    restoreDataManagementView,
    setMarketSelectedIngestRunId,
    setMarketSelectedIngestRun,
    setMarketScope,
    selectDefaultTag: handleSelectTag,
    refreshMarketTokenStatus,
    refreshMarketTargets,
    refreshMarketIngestRuns,
    refreshMarketIngestControl,
    refreshMarketSchedulerConfig,
    refreshMarketUniversePool,
    refreshMarketRegistry,
    refreshMarketTargetsDiff,
    refreshMarketTargetPoolStats,
    refreshMarketUniversePoolOverview,
    refreshMarketWatchlist,
    refreshMarketTags,
    refreshManualThemeOptions,
    refreshMarketIngestRunDetail
  });

  return (
    <div className="flex h-full bg-white/90 dark:bg-background-dark/80 backdrop-blur-xl overflow-hidden">
      <SidebarNav
        activeView={activeView}
        isNavCollapsed={isNavCollapsed}
        items={navItems}
        onSelectView={(view) => setActiveView(view as WorkspaceView)}
        onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
      />

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white/85 dark:bg-background-dark/70 backdrop-blur-lg">
        <TopToolbar
          activeView={activeView}
          otherTab={otherTab}
          navItems={navItems}
          marketPriceAsOf={snapshot?.priceAsOf ?? null}
          onLock={onLock}
        />

        {activeView === "portfolio" && (
          <div className="border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-background-dark/75">
            <div className="flex items-center gap-0 overflow-x-auto px-3">
              {portfolioTabs.map((tab) => {
                const isActive = portfolioTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
	                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
	                      isActive
	                        ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-surface-dark"
	                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-background-dark/80"
	                    }`}
                    onClick={() => setPortfolioTab(tab.key)}
                  >
                    <span className="material-icons-outlined text-base">{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className={`flex-1 p-0 scroll-smooth ${
            activeView === "market" ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          
          {/* View: Account */}
          {activeView === "account" && (
            <AccountView account={account} formatDateTime={formatDateTime} />
          )}

          {/* View: Portfolio */}
          {activeView === "portfolio" && (
            <PortfolioView
              {...{
                Badge,
                Button,
                DataQualityCard,
                DescriptionItem,
                EmptyState,
                ErrorState,
                FormGroup,
                HHI_WARN_THRESHOLD,
                IconButton,
                Input,
                LedgerForm,
                LedgerTable,
                Panel,
                PerformanceChart,
                PlaceholderPanel,
                RiskMetricCard,
                Select,
                SummaryCard,
                activePortfolio,
                activePortfolioId,
                assetClassLabels,
                cashFlowTotals,
                cashTotal,
                dataQuality,
                filteredLedgerEntries,
                formatAssetClassLabel,
                formatCurrency,
                formatDateRange,
                formatNumber,
                formatPct,
                formatPctNullable,
                formatPerformanceMethod,
                handleCancelEditPosition,
                handleCancelLedgerEdit,
                handleCreatePortfolio,
                handleDeletePortfolio,
                handleDeletePosition,
                handleEditLedgerEntry,
                handleEditPosition,
                handleOpenLedgerForm,
                handleRenamePortfolio,
                handleRequestDeleteLedgerEntry,
                handleSubmitLedgerEntry,
                handleSubmitPosition,
                hhiValue,
                isLedgerFormOpen,
                isLoading,
                ledgerEndDate,
                ledgerEntries,
                ledgerError,
                ledgerEventTypeOptions,
                ledgerFilter,
                ledgerForm,
                ledgerLoading,
                ledgerStartDate,
                loadLedgerEntries,
                loadPerformance,
                performanceError,
                performanceLoading,
                performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries,
                portfolioBaseCurrency,
                portfolioName,
                portfolioRename,
                portfolioTab,
                portfolioTabs,
                portfolios,
                positionForm,
                riskAnnualized,
                riskMetrics,
                selectedPerformance,
                setActivePortfolioId,
                setActiveView,
                setAnalysisTab,
                setLedgerEndDate,
                setLedgerError,
                setLedgerFilter,
                setLedgerStartDate,
                setOtherTab,
                setPerformanceError,
                setPerformanceRange,
                setPortfolioBaseCurrency,
                setPortfolioName,
                setPortfolioRename,
                setPositionForm,
                setRiskAnnualized,
                snapshot,
                toUserErrorMessage,
                updateLedgerForm,
              }}
            />
          )}

          {/* View: Risk */}
          {activeView === "risk" && (
            <RiskView
              snapshot={snapshot}
              formatAssetClassLabel={formatAssetClassLabel}
              formatPct={formatPct}
              formatCurrency={formatCurrency}
              formatRiskLimitTypeLabel={formatRiskLimitTypeLabel}
              handleEditRiskLimit={handleEditRiskLimit}
              handleDeleteRiskLimit={handleDeleteRiskLimit}
              riskForm={riskForm}
              setRiskForm={setRiskForm}
              riskLimitTypeLabels={riskLimitTypeLabels}
              handleSubmitRiskLimit={handleSubmitRiskLimit}
              handleCancelRiskEdit={handleCancelRiskEdit}
            />
          )}

          {/* View: Data Analysis */}
          {activeView === "data-analysis" && (
            <DataAnalysisView
              {...{
                Badge,
                CONTRIBUTION_TOP_N,
                ChartErrorBoundary,
                ContributionTable,
                EmptyState,
                ErrorState,
                Input,
                MarketAreaChart,
                Panel,
                PerformanceChart,
                PlaceholderPanel,
                RiskMetricCard,
                SummaryCard,
                activePortfolio,
                activePortfolioId,
                analysisInstrumentBars,
                analysisInstrumentError,
                analysisInstrumentHasEnoughData,
                analysisInstrumentHoldingUnitCost,
                analysisInstrumentLatestBar,
                analysisInstrumentLoading,
                analysisInstrumentNameBySymbol,
                analysisInstrumentPositionValuation,
                analysisInstrumentProfile,
                analysisInstrumentQuery,
                analysisInstrumentQuickSymbols,
                analysisInstrumentQuote,
                analysisInstrumentRange,
                analysisInstrumentRangeSummary,
                analysisInstrumentSearchLoading,
                analysisInstrumentSearchResults,
                analysisInstrumentSymbol,
                analysisInstrumentTargetPrice,
                analysisInstrumentTone,
                analysisInstrumentUserTags,
                analysisTab,
                analysisTabs,
                contributionBreakdown,
                formatCnWanYiNullable,
                formatDateRange,
                formatNumber,
                formatPctNullable,
                formatPerformanceMethod,
                formatSignedPctNullable,
                loadAnalysisInstrument,
                loadPerformance,
                marketChartRanges,
                performanceError,
                performanceLoading,
                performance,
                performanceRange,
                performanceRanges,
                performanceResult,
                performanceSeries,
                riskAnnualized,
                riskMetrics,
                selectedPerformance,
                setAnalysisInstrumentQuery,
                setAnalysisInstrumentRange,
                setAnalysisInstrumentSymbol,
                setAnalysisTab,
                setPerformanceError,
                setPerformanceRange,
                setRiskAnnualized,
                setShowAllAssetContribution,
                setShowAllSymbolContribution,
                showAllAssetContribution,
                showAllSymbolContribution,
                toUserErrorMessage
              }}
            />
          )}

          {/* View: Market */}
          {activeView === "market" && (
            <MarketView
              {...{
                Button,
                ChartErrorBoundary,
                FormGroup,
                IconButton,
                Input,
                MarketAreaChart,
                MarketQuoteHeader,
                MarketVolumeMiniChart,
                Modal,
                PopoverSelect,
                formatCnDate,
                formatCnWanYiNullable,
                formatNumber,
                formatSignedCnWanYiNullable,
                formatSignedPctNullable,
                formatThemeLabel,
                getCnChangeTone,
                getCnToneTextClass,
                handleAddManualTheme,
                handleAddSelectedToWatchlist,
                handleAddTargetTag,
                handleAddUserTag,
                handleMarketExplorerResizeKeyDown,
                handleMarketExplorerResizePointerDown,
                handleRemoveUserTag,
                handleRemoveWatchlistItem,
                handleSelectInstrument,
                handleSelectTag,
                handleSyncInstrumentCatalog,
                marketActiveMoneyflowRatio,
                marketActiveMoneyflowVol,
                marketActiveVolume,
                marketCatalogSyncSummary,
                marketCatalogSyncing,
                marketChartBars,
                marketChartHasEnoughData,
                marketChartHoverDate,
                marketChartHoverPrice,
                marketChartLoading,
                marketChartRange,
                marketChartRanges,
                marketCollectionSelectValue,
                marketEffectiveScope,
                marketExplorerWidth,
                marketFilterAssetClasses,
                marketFilterKinds,
                marketFilterMarket,
                marketFilteredListSymbols,
                marketFiltersActiveCount,
                marketFiltersOpen,
                marketHoldingUnitCost,
                marketHoldingsSymbols,
                marketHoldingsSymbolsFiltered,
                marketInstrumentDetailsOpen,
                marketLatestBar,
                marketManualThemeDraft,
                marketManualThemeLoading,
                marketManualThemeOptions,
                marketNameBySymbol,
                marketQuotesBySymbol,
                marketQuotesLoading,
                marketRangeSummary,
                marketSearchLoading,
                marketSearchQuery,
                marketSearchResults,
                marketSearchResultsFiltered,
                marketSelectedIndustry,
                marketSelectedManualThemes,
                marketSelectedPlainUserTags,
                marketSelectedProfile,
                marketSelectedQuote,
                marketSelectedSymbol,
                marketSelectedTag,
                marketSelectedTagAggregate,
                marketSelectedTagSeriesReturnPct,
                marketSelectedTagSeriesTone,
                marketSelectedThemes,
                marketShowProviderData,
                marketTagChartHoverDate,
                marketTagChartHoverPrice,
                marketTagMembers,
                marketTagMembersLoading,
                marketTagMembersModalOpen,
                marketTagPickerOpen,
                marketTagPickerQuery,
                marketTagSeriesBars,
                marketTagSeriesError,
                marketTagSeriesLatestCoverageLabel,
                marketTagSeriesLoading,
                marketTagSeriesResult,
                marketTags,
                marketTagsLoading,
                marketTargetPrice,
                marketUserTagDraft,
                marketVolumeMode,
                marketWatchlistGroupDraft,
                marketWatchlistLoading,
                refreshMarketTags,
                resetMarketFilters,
                setMarketChartHoverDate,
                setMarketChartHoverPrice,
                setMarketChartRange,
                setMarketFilterAssetClasses,
                setMarketFilterKinds,
                setMarketFilterMarket,
                setMarketFiltersOpen,
                setMarketInstrumentDetailsOpen,
                setMarketManualThemeDraft,
                setMarketScope,
                setMarketSearchQuery,
                setMarketSelectedSymbol,
                setMarketSelectedTag,
                setMarketShowProviderData,
                setMarketTagChartHoverDate,
                setMarketTagChartHoverPrice,
                setMarketTagMembersModalOpen,
                setMarketTagPickerOpen,
                setMarketTagPickerQuery,
                setMarketUserTagDraft,
                setMarketVolumeMode,
                setMarketWatchlistGroupDraft,
                snapshot,
                sortTagMembersByChangePct,
              }}
            />
          )}

          {/* View: Other */}
          {activeView === "other" && (
            <OtherView
              {...{
                Button,
                FormGroup,
                HelpHint,
                Input,
                Modal,
                Panel,
                PopoverSelect,
                UNIVERSE_POOL_BUCKET_ORDER,
                activePortfolio,
                dataQuality,
                formatCnDate,
                formatDateTime,
                formatDurationMs,
                formatIngestControlStateLabel,
                formatIngestRunModeLabel,
                formatIngestRunScopeLabel,
                formatIngestRunStatusLabel,
                formatIngestRunTone,
                formatMarketTokenSource,
                formatPctNullable,
                formatTagSourceLabel,
                formatTargetsReasons,
                getIngestControlStateDotClass,
                getUniversePoolBucketLabel,
                handleApplyManualTargetSymbols,
                handleBatchExtendTempTargets,
                handleBatchPromoteTempTargets,
                handleBatchRemoveTempTargets,
                handleBatchSetRegistryAutoIngest,
                handleCancelMarketIngest,
                handleChooseCsv,
                handleClearMarketToken,
                handleImportHoldings,
                handleImportPrices,
                handleOpenMarketProvider,
                handlePauseMarketIngest,
                handlePreviewManualTargetSymbols,
                handlePromoteTempTarget,
                handleRemoveManualPreviewSymbol,
                handleRemoveTempTarget,
                handleResetTargetsDraft,
                handleResumeMarketIngest,
                handleRunMarketIngestNow,
                handleSaveMarketSchedulerConfig,
                handleSaveMarketToken,
                handleSaveTargets,
                handleSaveUniversePoolConfig,
                handleSeedMarketDemoData,
                handleSelectAllTempTargets,
                handleSetRegistryAutoIngest,
                handleTargetsEditorResizeKeyDown,
                handleTargetsEditorResizePointerDown,
                handleTestMarketToken,
                handleToggleDiffSection,
                handleToggleRegistrySymbol,
                handleToggleSelectAllRegistry,
                handleToggleTargetsSection,
                handleToggleTempTargetSelection,
                handleToggleUniversePoolBucket,
                handleTriggerMarketIngest,
                holdingsCsvPath,
                latestMarketIngestRun,
                marketActiveTargetPoolStats,
                marketCanCancelIngest,
                marketCanPauseIngest,
                marketCanResumeIngest,
                marketCanTriggerIngestNow,
                marketDemoSeeding,
                marketDiffSectionOpen,
                marketFilteredAddedSymbols,
                marketFilteredReasonChangedSymbols,
                marketFilteredRemovedSymbols,
                marketIngestControlStatus,
                marketIngestRuns,
                marketIngestRunsLoading,
                marketIngestTriggering,
                marketManualSymbolPreview,
                marketRegistryAutoFilter,
                marketRegistryEntryEnabled,
                marketRegistryLoading,
                marketRegistryQuery,
                marketRegistryResult,
                marketRegistrySelectedSymbols,
                marketRegistryUpdating,
                marketSchedulerAdvancedOpen,
                marketSchedulerConfig,
                marketSchedulerDirty,
                marketSchedulerLoading,
                marketSchedulerSaving,
                marketSchedulerTimezoneOptions,
                marketSelectedIngestRun,
                marketSelectedIngestRunId,
                marketSelectedIngestRunLoading,
                marketSelectedTempTargetSymbols,
                marketTagManagementQuery,
                marketTags,
                marketTagsLoading,
                marketTargetPoolMetricCards,
                marketTargetPoolStatsScope,
                marketTargetsConfig,
                marketTargetsDiffPreview,
                marketTargetsDirty,
                marketTargetsLoading,
                marketTargetsPreview,
                marketTargetsSaving,
                marketTargetsSectionOpen,
                marketTargetsSymbolDraft,
                marketTempTargets,
                marketTempTargetsLoading,
                marketTokenDraft,
                marketTokenProvider,
                marketTokenSaving,
                marketTokenStatus,
                marketTokenTesting,
                marketTriggerIngestBlockedMessage,
                marketTriggerIngestBlockedOpen,
                marketUniverseBucketStatusById,
                marketUniverseEnabledBuckets,
                marketUniversePoolConfig,
                marketUniversePoolDirty,
                marketUniversePoolLoading,
                marketUniversePoolSaving,
                otherTab,
                otherTabs,
                pricesCsvPath,
                refreshMarketIngestRunDetail,
                refreshMarketIngestRuns,
                refreshMarketRegistry,
                refreshMarketTags,
                refreshMarketTargets,
                refreshMarketTargetsDiff,
                setActiveView,
                setMarketCurrentTargetsModalOpen,
                setMarketManualSymbolPreview,
                setMarketRegistryAutoFilter,
                setMarketRegistryQuery,
                setMarketSchedulerAdvancedOpen,
                setMarketTagManagementQuery,
                setMarketTargetPoolDetailMetric,
                setMarketTargetPoolStatsScope,
                setMarketTargetsConfig,
                setMarketTargetsSymbolDraft,
                setMarketTokenDraft,
                setMarketTokenProvider,
                setMarketTriggerIngestBlockedOpen,
                setOtherTab,
                snapshot,
                targetsEditorGridRef,
                targetsEditorLeftPct,
                updateMarketSchedulerConfig,
              }}
            />
          )}

          {/* Placeholders */}
          {["opportunities", "backtest", "insights", "alerts", "index-tracking"].includes(activeView) && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

        </div>

        <DashboardOverlays
          {...{
            Button,
            ConfirmDialog,
            Input,
            error,
            formatPct,
            formatTargetsReasons,
            handleCancelDeleteLedgerEntry,
            handleConfirmDeleteLedgerEntry,
            ledgerDeleteSummary,
            ledgerDeleteTarget,
            marketActiveTargetPoolStats,
            marketCurrentTargetsFilter,
            marketCurrentTargetsModalOpen,
            marketCurrentTargetsSource,
            marketFilteredCurrentTargets,
            marketTargetPoolActiveCategoryRow,
            marketTargetPoolDetailCategoryRows,
            marketTargetPoolDetailDescription,
            marketTargetPoolDetailMemberFilter,
            marketTargetPoolDetailMembers,
            marketTargetPoolDetailMetric,
            marketTargetPoolDetailTitle,
            marketTargetPoolDetailValue,
            notice,
            setError,
            setMarketCurrentTargetsFilter,
            setMarketCurrentTargetsModalOpen,
            setMarketTargetPoolDetailCategoryKey,
            setMarketTargetPoolDetailMemberFilter,
            setMarketTargetPoolDetailMetric,
            setNotice,
            toastMessage,
          }}
        />

      </section>
    </div>
  );
}
