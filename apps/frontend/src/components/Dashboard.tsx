import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AccountSummary,
  AssetClass,
  CorporateActionKind,
  CorporateActionMeta,
  ContributionEntry,
  CreateLedgerEntryInput,
  CreatePositionInput,
  CreateRiskLimitInput,
  DataQualityLevel,
  LedgerEntry,
  LedgerEntryMeta,
  LedgerEventType,
  LedgerSide,
  LedgerSource,
  MarketDataQuality,
  PerformanceMethod,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioPerformanceSeries,
  PortfolioSnapshot,
  PositionValuation,
  RiskLimit,
  RiskSeriesMetrics,
  RiskLimitType
} from "@mytrader/shared";

interface DashboardProps {
  account: AccountSummary;
  onLock: () => Promise<void>;
}

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

const ledgerSideLabels: Record<LedgerSide, string> = {
  buy: "买入",
  sell: "卖出"
};

const ledgerSourceLabels: Record<LedgerSource, string> = {
  manual: "手动",
  csv: "CSV",
  broker_import: "券商导入",
  system: "系统"
};

const DEFAULT_LEDGER_START_DATE = "2000-01-01";
const DEFAULT_LEDGER_END_DATE = "2099-12-31";

const corporateActionKindLabels: Record<CorporateActionKindUi, string> = {
  split: "拆股",
  reverse_split: "合股",
  info: "信息",
  dividend: "分红"
};

const corporateActionCategoryLabels: Record<string, string> = {
  decision: "关键决策",
  org_change: "组织调整",
  policy_support: "政策支持",
  other: "其他"
};

const navItems = [
  {
    key: "portfolio",
    label: "投资组合",
    meta: "概览",
    description: "集中查看组合、持仓与估值变化。",
    icon: "pie_chart"
  },
  {
    key: "risk",
    label: "风险管理",
    meta: "敞口/限额",
    description: "跟踪风险敞口、限额与预警。",
    icon: "shield"
  },
  {
    key: "market",
    label: "市场行情",
    meta: "数据/报价",
    description: "导入行情与价格数据，更新估值。",
    icon: "show_chart"
  },
  {
    key: "index-tracking",
    label: "\u6307\u6570\u8ddf\u8e2a",
    meta: "\u6307\u6570/\u5bf9\u6807",
    description: "\u8ddf\u8e2a\u6838\u5fc3\u6307\u6570\u4e0e\u5bf9\u6807\u8d70\u52bf\u3002",
    icon: "track_changes"
  },
  {
    key: "data-analysis",
    label: "\u6570\u636e\u5206\u6790",
    meta: "\u5206\u6790/\u6d1e\u5bdf",
    description: "\u5bf9\u7ec4\u5408\u4e0e\u884c\u60c5\u8fdb\u884c\u6307\u6807\u5206\u6790\u3002",
    icon: "functions"
  },
  {
    key: "opportunities",
    label: "机会",
    meta: "扫描/策略",
    description: "聚合潜在机会与策略提示。",
    icon: "lightbulb"
  },
  {
    key: "backtest",
    label: "回测",
    meta: "历史验证",
    description: "回测策略并对比历史表现。",
    icon: "query_stats"
  },
  {
    key: "insights",
    label: "观点",
    meta: "研究/复盘",
    description: "记录观点、研究与复盘笔记。",
    icon: "psychology"
  },
  {
    key: "alerts",
    label: "提醒",
    meta: "预警/到价",
    description: "集中管理交易提醒与到价预警。",
    icon: "notifications_active"
  },
  {
    key: "other",
    label: "其他",
    meta: "工具箱",
    description: "工具与实验功能入口。",
    icon: "more_horiz"
  },
  {
    key: "account",
    label: "账号",
    meta: "权限/锁定",
    description: "账号信息、权限与锁定管理。",
    icon: "manage_accounts"
  }
] as const;

const portfolioTabs = [
  { key: "overview", label: "总览", icon: "dashboard", description: "资产、现金、估值与关键预警。" },
  { key: "holdings", label: "持仓", icon: "view_list", description: "当前持仓、成本与权重。" },
  { key: "trades", label: "交易", icon: "swap_horiz", description: "流水、现金流与对账。" },
  { key: "performance", label: "收益", icon: "timeline", description: "收益率与区间表现。" },
  { key: "risk", label: "风险", icon: "shield", description: "风险指标与回撤。" },
  { key: "allocation", label: "目标配置", icon: "tune", description: "目标权重与再平衡。" },
  { key: "corporate", label: "公司行为", icon: "corporate_fare", description: "分红、拆合股与事件追溯。" }
] as const;

const otherTabs = [
  { key: "data-import", label: "\u6570\u636e\u5bfc\u5165" }
] as const;

const performanceRanges = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "YTD", label: "YTD" },
  { key: "ALL", label: "\u5168\u90e8" }
] as const;

const CONTRIBUTION_TOP_N = 5;
const HHI_WARN_THRESHOLD = 0.25;

type OtherTab = (typeof otherTabs)[number]["key"];

type WorkspaceView = (typeof navItems)[number]["key"];
type PortfolioTab = (typeof portfolioTabs)[number]["key"];

export function Dashboard({ account, onLock }: DashboardProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("portfolio");
  const [otherTab, setOtherTab] = useState<OtherTab>("data-import");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
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

  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioBaseCurrency, setPortfolioBaseCurrency] = useState("CNY");
  const [portfolioRename, setPortfolioRename] = useState("");

  const [positionForm, setPositionForm] = useState<PositionFormState>(
    emptyPositionForm
  );
  const [riskForm, setRiskForm] = useState<RiskFormState>(emptyRiskForm);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");
  const [ledgerStartDate, setLedgerStartDate] = useState(
    DEFAULT_LEDGER_START_DATE
  );
  const [ledgerEndDate, setLedgerEndDate] = useState(DEFAULT_LEDGER_END_DATE);
  const [ledgerForm, setLedgerForm] = useState<LedgerFormState>(() =>
    createEmptyLedgerForm("CNY")
  );
  const [isLedgerFormOpen, setIsLedgerFormOpen] = useState(false);
  const [ledgerDeleteTarget, setLedgerDeleteTarget] = useState<LedgerEntry | null>(
    null
  );

  const [holdingsCsvPath, setHoldingsCsvPath] = useState<string | null>(null);
  const [pricesCsvPath, setPricesCsvPath] = useState<string | null>(null);
  const [ingestStartDate, setIngestStartDate] = useState(
    formatInputDate(daysAgo(30))
  );
  const [ingestEndDate, setIngestEndDate] = useState(
    formatInputDate(new Date())
  );

  const activePortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === activePortfolioId) ?? null,
    [portfolios, activePortfolioId]
  );

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

  const loadPortfolios = useCallback(
    async (preferredId?: string | null) => {
      if (!window.mytrader) {
        setError("未检测到桌面端后端接口。");
        return;
      }
      const list = await window.mytrader.portfolio.list();
      setPortfolios(list);
      const nextId = preferredId ?? list[0]?.id ?? null;
      setActivePortfolioId(nextId);
      if (nextId) {
        const selected = list.find((item) => item.id === nextId);
        setPortfolioRename(selected?.name ?? "");
      }
    },
    []
  );

  const loadSnapshot = useCallback(async (portfolioId: string) => {
    if (!window.mytrader) {
      setError("未检测到桌面端后端接口。");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await window.mytrader.portfolio.getSnapshot(portfolioId);
      setSnapshot(data);
    } catch (err) {
      setError(toUserErrorMessage(err));
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLedgerEntries = useCallback(async (portfolioId: string) => {
    if (!window.mytrader) {
      setLedgerError("未检测到桌面端后端接口。");
      return;
    }
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const entries = await window.mytrader.ledger.list(portfolioId);
      setLedgerEntries(entries);
    } catch (err) {
      setLedgerError(toUserErrorMessage(err));
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadPerformance = useCallback(
    async (portfolioId: string, range: PerformanceRangeKey) => {
      if (!window.mytrader) {
        setPerformanceError("未检测到桌面端后端接口。");
        return;
      }
      setPerformanceLoading(true);
      setPerformanceError(null);
      try {
        const data = await window.mytrader.portfolio.getPerformance({
          portfolioId,
          range
        });
        setPerformanceResult(data);
      } catch (err) {
        setPerformanceError(toUserErrorMessage(err));
        setPerformanceResult(null);
      } finally {
        setPerformanceLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadPortfolios().catch((err) => setError(toUserErrorMessage(err)));
  }, [loadPortfolios]);

  useEffect(() => {
    if (!activePortfolioId) {
      setSnapshot(null);
      return;
    }
    loadSnapshot(activePortfolioId).catch((err) =>
      setError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadSnapshot]);

  useEffect(() => {
    if (!activePortfolioId) {
      setPerformanceResult(null);
      return;
    }
    if (portfolioTab !== "performance" && portfolioTab !== "risk") return;
    loadPerformance(activePortfolioId, performanceRange).catch((err) =>
      setPerformanceError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadPerformance, performanceRange, portfolioTab]);

  useEffect(() => {
    if (!activePortfolioId) {
      setLedgerEntries([]);
      return;
    }
    if (portfolioTab !== "trades") return;
    loadLedgerEntries(activePortfolioId).catch((err) =>
      setLedgerError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadLedgerEntries, portfolioTab]);

  useEffect(() => {
    if (!activePortfolio) return;
    setPortfolioRename(activePortfolio.name);
  }, [activePortfolio]);

  useEffect(() => {
    if (!activePortfolio) {
      setLedgerForm(createEmptyLedgerForm("CNY"));
      setIsLedgerFormOpen(false);
      setLedgerDeleteTarget(null);
      setLedgerStartDate(DEFAULT_LEDGER_START_DATE);
      setLedgerEndDate(DEFAULT_LEDGER_END_DATE);
      return;
    }
    setLedgerForm(createEmptyLedgerForm(activePortfolio.baseCurrency));
    setLedgerFilter("all");
    setIsLedgerFormOpen(false);
    setLedgerDeleteTarget(null);
    setLedgerStartDate(DEFAULT_LEDGER_START_DATE);
    setLedgerEndDate(DEFAULT_LEDGER_END_DATE);
  }, [activePortfolio?.id, activePortfolio?.baseCurrency]);

  useEffect(() => {
    if (activeView === "portfolio") {
      setPortfolioTab("overview");
    }
  }, [activeView]);

  useEffect(() => {
    setShowAllSymbolContribution(false);
    setShowAllAssetContribution(false);
  }, [performanceRange, activePortfolioId]);

  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => {
      setError(null);
      setNotice(null);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const handleCreatePortfolio = useCallback(async () => {
    if (!window.mytrader) return;
    setError(null);
    setNotice(null);
    const name = portfolioName.trim();
    if (!name) {
      setError("请输入组合名称。");
      return;
    }
    const created = await window.mytrader.portfolio.create({
      name,
      baseCurrency: portfolioBaseCurrency.trim() || "CNY"
    });
    setPortfolioName("");
    setPortfolioBaseCurrency("CNY");
    await loadPortfolios(created.id);
    setNotice(`组合已创建：${created.name}。`);
  }, [portfolioName, portfolioBaseCurrency, loadPortfolios]);

  const handleRenamePortfolio = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);
    const name = portfolioRename.trim();
    if (!name) {
      setError("请输入组合名称。");
      return;
    }
    const updated = await window.mytrader.portfolio.update({
      id: activePortfolio.id,
      name,
      baseCurrency: activePortfolio.baseCurrency
    });
    await loadPortfolios(updated.id);
    setNotice(`组合已重命名为：${updated.name}。`);
  }, [activePortfolio, portfolioRename, loadPortfolios]);

  const handleDeletePortfolio = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);
    await window.mytrader.portfolio.remove(activePortfolio.id);
    await loadPortfolios();
    setNotice("组合已删除。");
  }, [activePortfolio, loadPortfolios]);

  const handleEditPosition = useCallback((position: PositionValuation) => {
    setPositionForm({
      id: position.position.id,
      symbol: position.position.symbol,
      name: position.position.name ?? "",
      assetClass: position.position.assetClass,
      market: position.position.market,
      currency: position.position.currency,
      quantity: String(position.position.quantity),
      cost: position.position.cost?.toString() ?? "",
      openDate: position.position.openDate ?? ""
    });
  }, []);

  const handleCancelEditPosition = useCallback(() => {
    setPositionForm(emptyPositionForm);
  }, []);

  const handleSubmitPosition = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const quantity = Number(positionForm.quantity);
    const costValue = positionForm.cost ? Number(positionForm.cost) : null;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("数量必须大于 0。");
      return;
    }
    if (positionForm.cost && !Number.isFinite(costValue)) {
      setError("成本必须是数字。");
      return;
    }
    if (!positionForm.symbol.trim()) {
      setError("请输入代码。");
      return;
    }
    if (!positionForm.market.trim() || !positionForm.currency.trim()) {
      setError("请输入市场与币种。");
      return;
    }

    const payload: CreatePositionInput = {
      portfolioId: activePortfolio.id,
      symbol: positionForm.symbol.trim(),
      name: positionForm.name.trim() || null,
      assetClass: positionForm.assetClass,
      market: positionForm.market.trim(),
      currency: positionForm.currency.trim(),
      quantity,
      cost: costValue,
      openDate: positionForm.openDate.trim() || null
    };

    if (positionForm.id) {
      await window.mytrader.position.update({ ...payload, id: positionForm.id });
      setNotice("持仓已更新。");
    } else {
      await window.mytrader.position.create(payload);
      setNotice("持仓已新增。");
    }

    setPositionForm(emptyPositionForm);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, positionForm, loadSnapshot]);

  const handleDeletePosition = useCallback(
    async (positionId: string) => {
      if (!window.mytrader || !activePortfolio) return;
      setError(null);
      setNotice(null);
      await window.mytrader.position.remove(positionId);
      await loadSnapshot(activePortfolio.id);
      setNotice("持仓已删除。");
    },
    [activePortfolio, loadSnapshot]
  );

  const handleEditRiskLimit = useCallback((limit: RiskLimit) => {
    setRiskForm({
      id: limit.id,
      limitType: limit.limitType,
      target: limit.target,
      thresholdPct: (limit.threshold * 100).toFixed(2)
    });
  }, []);

  const handleCancelRiskEdit = useCallback(() => {
    setRiskForm(emptyRiskForm);
  }, []);

  const handleSubmitRiskLimit = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const threshold = Number(riskForm.thresholdPct) / 100;
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      setError("阈值必须在 0 到 100 之间。");
      return;
    }
    if (!riskForm.target.trim()) {
      setError("请输入目标。");
      return;
    }

    const payload: CreateRiskLimitInput = {
      portfolioId: activePortfolio.id,
      limitType: riskForm.limitType,
      target: riskForm.target.trim(),
      threshold
    };

    if (riskForm.id) {
      await window.mytrader.risk.update({ ...payload, id: riskForm.id });
      setNotice("风险限额已更新。");
    } else {
      await window.mytrader.risk.create(payload);
      setNotice("风险限额已新增。");
    }

    setRiskForm(emptyRiskForm);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, riskForm, loadSnapshot]);

  const handleDeleteRiskLimit = useCallback(
    async (riskLimitId: string) => {
      if (!window.mytrader || !activePortfolio) return;
      setError(null);
      setNotice(null);
      await window.mytrader.risk.remove(riskLimitId);
      await loadSnapshot(activePortfolio.id);
      setNotice("风险限额已删除。");
    },
    [activePortfolio, loadSnapshot]
  );

  const updateLedgerForm = useCallback((patch: Partial<LedgerFormState>) => {
    setLedgerForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleOpenLedgerForm = useCallback(() => {
    if (!activePortfolio) return;
    setLedgerForm(createEmptyLedgerForm(activePortfolio.baseCurrency));
    setIsLedgerFormOpen(true);
  }, [activePortfolio]);

  const handleEditLedgerEntry = useCallback((entry: LedgerEntry) => {
    const storedRates = loadStoredRates(entry.eventType);
    const derivedFeeRate = deriveRateValue(entry.fee, entry.quantity, entry.price);
    const derivedTaxRate = deriveRateValue(entry.tax, entry.quantity, entry.price);
    const isDividendEntry = entry.eventType === "dividend";
    const corporateMeta = isCorporateActionMeta(entry.meta) ? entry.meta : null;
    const corporateAfterShares =
      !isDividendEntry && corporateMeta && corporateMeta.kind !== "info"
        ? formatCorporateAfterShares(corporateMeta.numerator, corporateMeta.denominator)
        : "";
    setLedgerForm({
      id: entry.id,
      eventType: isDividendEntry ? "corporate_action" : entry.eventType,
      tradeDate: entry.tradeDate,
      eventTime: formatDateTimeInput(entry.eventTs),
      sequence: entry.sequence?.toString() ?? "",
      accountKey: entry.accountKey ?? "",
      instrumentId: entry.instrumentId ?? "",
      symbol: entry.symbol ?? "",
      side: entry.side ?? "",
      quantity: entry.quantity?.toString() ?? "",
      price: entry.price?.toString() ?? "",
      priceCurrency: entry.priceCurrency ?? "",
      cashAmount: entry.cashAmount?.toString() ?? "",
      cashCurrency: entry.cashCurrency ?? "",
      fee: entry.fee?.toString() ?? "",
      tax: entry.tax?.toString() ?? "",
      feeRate: derivedFeeRate || storedRates.feeRate,
      taxRate: derivedTaxRate || storedRates.taxRate,
      cashAmountAuto: entry.cashAmount === null,
      note: entry.note ?? "",
      source: entry.source,
      externalId: entry.externalId ?? "",
      corporateKind: isDividendEntry ? "dividend" : corporateMeta?.kind ?? "split",
      corporateAfterShares
    });
    setIsLedgerFormOpen(true);
  }, []);

  const handleCancelLedgerEdit = useCallback(() => {
    setLedgerForm(createEmptyLedgerForm(activePortfolio?.baseCurrency ?? "CNY"));
    setIsLedgerFormOpen(false);
  }, [activePortfolio]);

  const handleSubmitLedgerEntry = useCallback(async () => {
    if (!window.mytrader || !activePortfolio) return;
    setError(null);
    setNotice(null);

    const tradeDate = ledgerForm.tradeDate.trim();
    if (!tradeDate) {
      setError("请输入交易日期。");
      return;
    }

    const eventType = ledgerForm.eventType;
    const isCorporateDividend =
      eventType === "corporate_action" && ledgerForm.corporateKind === "dividend";
    const effectiveEventType: LedgerEventType = isCorporateDividend
      ? "dividend"
      : eventType;
    const symbol = ledgerForm.symbol.trim();
    const instrumentId = ledgerForm.instrumentId.trim();
    const side = ledgerForm.side || null;
    const cashCurrency = ledgerForm.cashCurrency.trim();
    const priceCurrency = ledgerForm.priceCurrency.trim();
    const autoFeeTaxEnabled = effectiveEventType === "trade";
    const normalizedCurrency =
      effectiveEventType === "trade"
        ? priceCurrency || cashCurrency || activePortfolio.baseCurrency
        : cashCurrency || activePortfolio.baseCurrency;
    const normalizedPriceCurrency =
      effectiveEventType === "trade" ? normalizedCurrency : priceCurrency;
    const normalizedCashCurrency =
      effectiveEventType === "trade" ? normalizedCurrency : cashCurrency;

    let eventTs: number | null;
    let sequence: number | null;
    let quantity: number | null;
    let price: number | null;
    let cashAmount: number | null;
    let fee: number | null;
    let tax: number | null;
    let feeRate: number | null = null;
    let taxRate: number | null = null;

    try {
      eventTs = parseOptionalDateTimeInput(ledgerForm.eventTime, "事件时间");
      sequence = parseOptionalIntegerInput(ledgerForm.sequence, "排序序号");
      quantity = parseOptionalNumberInput(ledgerForm.quantity, "数量");
      price = parseOptionalNumberInput(ledgerForm.price, "价格");
      cashAmount = parseOptionalNumberInput(ledgerForm.cashAmount, "现金腿");
      fee = parseOptionalNumberInput(ledgerForm.fee, "费用");
      tax = parseOptionalNumberInput(ledgerForm.tax, "税费");
      if (autoFeeTaxEnabled) {
        feeRate = parseOptionalNumberInput(ledgerForm.feeRate, "费用费率");
        taxRate = parseOptionalNumberInput(ledgerForm.taxRate, "税费率");
      }
    } catch (err) {
      setError(toUserErrorMessage(err));
      return;
    }

    if (eventTs !== null && eventTs <= 0) {
      setError("事件时间格式不正确。");
      return;
    }
    if (sequence !== null && sequence < 0) {
      setError("排序序号不能为负数。");
      return;
    }
    if (quantity !== null && quantity < 0) {
      setError("数量不能为负数。");
      return;
    }
    if (price !== null && price < 0) {
      setError("价格不能为负数。");
      return;
    }
    if (fee !== null && fee < 0) {
      setError("费用必须为非负数。");
      return;
    }
    if (tax !== null && tax < 0) {
      setError("税费必须为非负数。");
      return;
    }
    if (autoFeeTaxEnabled) {
      if (feeRate === null || taxRate === null) {
        setError("请填写费用费率与税费率。");
        return;
      }
      if (feeRate < 0 || taxRate < 0) {
        setError("费率与税率不能为负数。");
        return;
      }
      if (quantity === null || price === null || quantity <= 0 || price < 0) {
        setError("自动计算费用/税费需要填写有效的数量与价格。");
        return;
      }
      const baseAmount = quantity * price;
      if (!Number.isFinite(baseAmount)) {
        setError("自动计算费用/税费需要有效的数量与价格。");
        return;
      }
      fee = Number((baseAmount * (feeRate / 100)).toFixed(2));
      tax = Number((baseAmount * (taxRate / 100)).toFixed(2));
    }

    if (
      ["trade", "dividend", "adjustment", "corporate_action"].includes(effectiveEventType) &&
      !symbol &&
      !instrumentId
    ) {
      setError("请输入代码或 instrumentId。");
      return;
    }

    if ((ledgerForm.source === "csv" || ledgerForm.source === "broker_import") && sequence === null) {
      setError("CSV/券商导入需要填写排序序号。");
      return;
    }

    if (effectiveEventType === "trade") {
      if (!side) {
        setError("交易需要填写方向。");
        return;
      }
      if (!quantity || quantity <= 0) {
        setError("交易数量必须大于 0。");
        return;
      }
      if (price === null) {
        setError("交易需要填写价格。");
        return;
      }
      if (cashAmount === null || cashAmount === 0) {
        setError("交易需要填写现金腿金额。");
        return;
      }
      if (side === "buy" && cashAmount > 0) {
        setError("买入交易现金腿必须为负数。");
        return;
      }
      if (side === "sell" && cashAmount < 0) {
        setError("卖出交易现金腿必须为正数。");
        return;
      }
    }

    if (effectiveEventType === "cash") {
      if (cashAmount === null || cashAmount === 0) {
        setError("现金流需要填写金额。");
        return;
      }
      if (!normalizedCashCurrency) {
        setError("现金流需要填写币种。");
        return;
      }
    }

    if (effectiveEventType === "fee" || effectiveEventType === "tax") {
      if (cashAmount === null || cashAmount >= 0) {
        setError(`${formatLedgerEventType(effectiveEventType)} 需要填写负数金额。`);
        return;
      }
      if (!normalizedCashCurrency) {
        setError(`${formatLedgerEventType(effectiveEventType)} 需要填写币种。`);
        return;
      }
    }

    if (effectiveEventType === "dividend") {
      if (cashAmount === null || cashAmount <= 0) {
        setError("分红需要填写正数金额。");
        return;
      }
      if (!normalizedCashCurrency) {
        setError("分红需要填写币种。");
        return;
      }
    }

    if (effectiveEventType === "adjustment") {
      if (!side) {
        setError("持仓调整需要填写方向。");
        return;
      }
      if (!quantity || quantity <= 0) {
        setError("持仓调整数量必须大于 0。");
        return;
      }
    }

    let meta: CreateLedgerEntryInput["meta"] = null;
    if (eventType === "corporate_action" && !isCorporateDividend) {
      if (ledgerForm.corporateKind === "info") {
        setError("公司行为不支持信息类型。");
        return;
      }
      let ratio: { numerator: number; denominator: number };
      try {
        ratio = parseCorporateAfterShares(ledgerForm.corporateAfterShares);
      } catch (err) {
        setError(toUserErrorMessage(err));
        return;
      }
      meta = {
        kind: ledgerForm.corporateKind,
        numerator: ratio.numerator,
        denominator: ratio.denominator
      };
    }

    const payloadEventType = isCorporateDividend ? "dividend" : eventType;
    const payload: CreateLedgerEntryInput = {
      portfolioId: activePortfolio.id,
      accountKey: ledgerForm.accountKey.trim() || null,
      eventType: payloadEventType,
      tradeDate,
      eventTs,
      sequence,
      instrumentId: instrumentId || null,
      symbol: symbol || null,
      side,
      quantity,
      price,
      priceCurrency: normalizedPriceCurrency || null,
      cashAmount,
      cashCurrency: normalizedCashCurrency || null,
      fee,
      tax,
      note: ledgerForm.note.trim() || null,
      source: ledgerForm.source,
      externalId: ledgerForm.externalId.trim() || null,
      meta
    };

    if (ledgerForm.id) {
      await window.mytrader.ledger.update({ ...payload, id: ledgerForm.id });
      setNotice("流水已更新。");
    } else {
      await window.mytrader.ledger.create(payload);
      setNotice("流水已新增。");
    }

    setLedgerForm(createEmptyLedgerForm(activePortfolio.baseCurrency));
    setIsLedgerFormOpen(false);
    await loadLedgerEntries(activePortfolio.id);
    await loadSnapshot(activePortfolio.id);
  }, [activePortfolio, ledgerForm, loadLedgerEntries, loadSnapshot]);

  const handleRequestDeleteLedgerEntry = useCallback((entry: LedgerEntry) => {
    setLedgerDeleteTarget(entry);
  }, []);

  const handleConfirmDeleteLedgerEntry = useCallback(async () => {
    if (!window.mytrader || !activePortfolio || !ledgerDeleteTarget) return;
    setError(null);
    setNotice(null);
    const entryId = ledgerDeleteTarget.id;
    setLedgerDeleteTarget(null);
    await window.mytrader.ledger.remove(entryId);
    await loadLedgerEntries(activePortfolio.id);
    await loadSnapshot(activePortfolio.id);
    setNotice("流水已删除。");
  }, [activePortfolio, ledgerDeleteTarget, loadLedgerEntries, loadSnapshot]);

  const handleCancelDeleteLedgerEntry = useCallback(() => {
    setLedgerDeleteTarget(null);
  }, []);

  const handleChooseCsv = useCallback(async (kind: "holdings" | "prices") => {
    if (!window.mytrader) return;
    setError(null);
    const selected = await window.mytrader.market.chooseCsvFile(kind);
    if (kind === "holdings") setHoldingsCsvPath(selected);
    else setPricesCsvPath(selected);
  }, []);

  const handleImportHoldings = useCallback(async () => {
    if (!window.mytrader || !activePortfolio || !holdingsCsvPath) return;
    setError(null);
    setNotice(null);
    const result = await window.mytrader.market.importHoldingsCsv({
      portfolioId: activePortfolio.id,
      filePath: holdingsCsvPath
    });
    await loadSnapshot(activePortfolio.id);
    setNotice(
      `持仓导入：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}。`
    );
  }, [activePortfolio, holdingsCsvPath, loadSnapshot]);

  const handleImportPrices = useCallback(async () => {
    if (!window.mytrader || !pricesCsvPath) return;
    setError(null);
    setNotice(null);
    const result = await window.mytrader.market.importPricesCsv({
      filePath: pricesCsvPath,
      source: "csv"
    });
    if (activePortfolio) await loadSnapshot(activePortfolio.id);
    setNotice(`行情导入：新增 ${result.inserted} 条，跳过 ${result.skipped} 条。`);
  }, [pricesCsvPath, activePortfolio, loadSnapshot]);

  const handleIngestTushare = useCallback(async () => {
    if (!window.mytrader || !snapshot) return;
    setError(null);
    setNotice(null);
    const items = snapshot.positions
      .filter((pos) => pos.position.assetClass !== "cash")
      .map((pos) => ({
        symbol: pos.position.symbol,
        assetClass: pos.position.assetClass
      }));
    if (!items.length) {
      setNotice("当前组合没有可拉取行情的标的。");
      return;
    }
    const result = await window.mytrader.market.ingestTushare({
      items,
      startDate: ingestStartDate,
      endDate: ingestEndDate || null
    });
    await loadSnapshot(snapshot.portfolio.id);
    setNotice(`行情拉取：新增 ${result.inserted} 条。`);
  }, [snapshot, ingestStartDate, ingestEndDate, loadSnapshot]);

  return (
    <div className="flex h-full bg-white/90 dark:bg-background-dark/80 backdrop-blur-xl overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isNavCollapsed ? "w-16" : "w-40"
        } flex-shrink-0 bg-surface-light/95 dark:bg-surface-dark/90 backdrop-blur-xl border-r border-border-light dark:border-border-dark flex flex-col transition-all duration-300 z-20`}
      >
        <div className="flex items-center justify-between p-2 border-b border-border-light dark:border-border-dark h-10">
          <p className={`text-xs font-semibold text-slate-400 ${isNavCollapsed ? "hidden" : "block"}`}>
            导航
          </p>
          <button
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            type="button"
            onClick={() => setIsNavCollapsed((prev) => !prev)}
            aria-label={isNavCollapsed ? "展开导航" : "收起导航"}
          >
            <span className="material-icons-outlined text-lg">
              {isNavCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>
        
        {/* Account info moved to global top bar */}

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.key === activeView;
            return (
              <button
                key={item.key}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                  ${isActive 
                    ? "bg-primary text-white font-medium" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                  ${isNavCollapsed ? "justify-center px-2" : ""}
                `}
                type="button"
                onClick={() => setActiveView(item.key)}
                title={item.label}
              >
                <span className={`material-icons-outlined ${isNavCollapsed ? "text-xl" : "text-lg"} ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
                  {item.icon}
                </span>
                {!isNavCollapsed && (
                  <div className="flex flex-col items-start text-left leading-tight">
                    <span>{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white/85 dark:bg-background-dark/70 backdrop-blur-lg">
        {/* Top Navigation / Toolbar */}
        <div className="h-10 border-b border-border-light dark:border-border-dark flex items-center justify-between px-3 flex-shrink-0 bg-white/85 dark:bg-background-dark/75 backdrop-blur-lg">
           <div className="flex items-center gap-4">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {navItems.find(n => n.key === activeView)?.label}
              </h2>
              {/* Optional: Breadcrumbs or View Switcher here */}
           </div>
           <div className="flex items-center gap-2">
              {activeView === "account" && (
                 <Button variant="secondary" size="sm" onClick={onLock} icon="lock">锁定</Button>
              )}
           </div>
        </div>

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
                        ? "text-slate-900 dark:text-white border-primary bg-slate-100 dark:bg-slate-900/60"
                        : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900/40"
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

        <div className="flex-1 overflow-y-auto p-0 scroll-smooth">
          
          {/* View: Account */}
          {activeView === "account" && (
            <Panel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-4xl">
                 <DescriptionItem label="当前账号" value={account.label} />
                 <DescriptionItem label="账号 ID" value={<span className="font-mono text-xs">{account.id}</span>} />
                 <DescriptionItem label="数据目录" value={<span className="font-mono text-xs">{account.dataDir}</span>} />
                 <DescriptionItem label="创建时间" value={formatDateTime(account.createdAt)} />
                 <DescriptionItem label="最近登录" value={formatDateTime(account.lastLoginAt)} />
              </div>
            </Panel>
          )}

          {/* View: Portfolio */}
          {activeView === "portfolio" && (
            <>
              {portfolioTab === "overview" && (
                <>
                  <Panel>
                    {isLoading && <EmptyState message="正在加载组合数据..." />}
                    {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                    {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}

                    {snapshot && (
                        <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <SummaryCard label="总资产" value={formatCurrency(snapshot.totals.marketValue)} />
                          <SummaryCard label="现金余额" value={formatCurrency(cashTotal)} />
                          <SummaryCard
                            label="总盈亏"
                            value={formatCurrency(snapshot.totals.pnl)}
                            trend={snapshot.totals.pnl >= 0 ? "up" : "down"}
                          />
                          <SummaryCard label="成本合计" value={formatCurrency(snapshot.totals.costValue)} />
                          <SummaryCard label="行情更新" value={snapshot.priceAsOf ?? "--"} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">数据状态</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {snapshot.priceAsOf ? `价格更新至 ${snapshot.priceAsOf}` : "暂无行情数据"}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">风险提示</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {snapshot.riskWarnings.length > 0
                                ? `${snapshot.riskWarnings.length} 条风险预警`
                                : "暂无触发预警"}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">快速动作</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">刷新行情 / 导入流水</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Panel>

                  <Panel>
                    <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">组合管理</h3>
                    <div className="space-y-6 max-w-5xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormGroup label="切换组合">
                          <Select
                            value={activePortfolioId ?? ""}
                            onChange={(e) => setActivePortfolioId(e.target.value)}
                            options={[
                              { value: "", label: "请选择组合", disabled: true },
                              ...portfolios.map((p) => ({ value: p.id, label: p.name }))
                            ]}
                            className="w-full"
                          />
                        </FormGroup>

                        <FormGroup label="重命名当前组合">
                          <div className="flex gap-2">
                            <Input
                              value={portfolioRename}
                              onChange={(e) => setPortfolioRename(e.target.value)}
                              placeholder="组合名称"
                              className="flex-1"
                            />
                            <Button variant="secondary" onClick={handleRenamePortfolio} disabled={!activePortfolio}>
                              更新
                            </Button>
                            <Button variant="danger" onClick={handleDeletePortfolio} disabled={!activePortfolio}>
                              删除
                            </Button>
                          </div>
                        </FormGroup>
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800" />

                      <FormGroup label="新建组合">
                        <div className="flex gap-2 items-center">
                          <Input
                            value={portfolioName}
                            onChange={(e) => setPortfolioName(e.target.value)}
                            placeholder="例如：核心持仓"
                            className="flex-[2]"
                          />
                          <Input
                            value={portfolioBaseCurrency}
                            onChange={(e) => setPortfolioBaseCurrency(e.target.value)}
                            placeholder="基准币种"
                            className="flex-1"
                          />
                          <Button
                            variant="primary"
                            onClick={handleCreatePortfolio}
                            disabled={!portfolioName.trim()}
                            icon="add"
                          >
                            创建
                          </Button>
                        </div>
                      </FormGroup>
                    </div>
                  </Panel>
                </>
              )}

              {portfolioTab === "holdings" && (
                <Panel>
                  <h3 className="text-sm font-semibold mb-4 text-slate-800 dark:text-slate-200">持仓明细</h3>

                  {isLoading && <EmptyState message="正在加载组合数据..." />}
                  {!isLoading && !activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                  {!isLoading && activePortfolio && !snapshot && <EmptyState message="暂无估值快照。" />}

                  {snapshot && (
                    <>
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 mb-6">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                          <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                              {["代码", "名称", "类型", "数量", "成本", "现价", "市值", "盈亏", "权重", "操作"].map((h) => (
                                <th
                                  key={h}
                                  className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
                            {snapshot.positions.length === 0 ? (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                                  暂无持仓
                                </td>
                              </tr>
                            ) : (
                              snapshot.positions.map((pos) => (
                                <tr
                                  key={pos.position.id}
                                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                                >
                                  <td className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 font-mono">
                                    {pos.position.symbol}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                                    {pos.position.name ?? "-"}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500">
                                    <Badge>{formatAssetClassLabel(pos.position.assetClass)}</Badge>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono text-right">
                                    {formatNumber(pos.position.quantity)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                    {formatCurrency(pos.position.cost)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-mono text-right">
                                    {formatCurrency(pos.latestPrice)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100 font-medium font-mono text-right">
                                    {formatCurrency(pos.marketValue)}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-sm font-mono text-right ${
                                      pos.pnl && pos.pnl < 0 ? "text-red-500" : "text-emerald-500"
                                    }`}
                                  >
                                    {formatCurrency(pos.pnl)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-500 dark:text-slate-500 font-mono text-right">
                                    {formatPct(
                                      snapshot.exposures.bySymbol.find((e) => e.key === pos.position.symbol)
                                        ?.weight ?? 0
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleEditPosition(pos)}
                                        className="p-1 text-slate-400 hover:text-primary transition-colors"
                                        title="编辑"
                                      >
                                        <span className="material-icons-outlined text-base">edit</span>
                                      </button>
                                      <button
                                        onClick={() => handleDeletePosition(pos.position.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                        title="删除"
                                      >
                                        <span className="material-icons-outlined text-base">delete</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span className="material-icons-outlined text-primary text-base">edit_note</span>
                            {positionForm.id ? "编辑持仓" : "新增持仓"}
                          </h3>
                          {positionForm.id && (
                            <Button variant="secondary" size="sm" onClick={handleCancelEditPosition}>
                              取消编辑
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <FormGroup label="代码">
                            <Input
                              value={positionForm.symbol}
                              onChange={(e) => setPositionForm((p) => ({ ...p, symbol: e.target.value }))}
                              placeholder="例如: 600519.SH"
                            />
                          </FormGroup>
                          <FormGroup label="名称">
                            <Input
                              value={positionForm.name}
                              onChange={(e) => setPositionForm((p) => ({ ...p, name: e.target.value }))}
                              placeholder="可选"
                            />
                          </FormGroup>
                          <FormGroup label="资产类别">
                            <Select
                              value={positionForm.assetClass}
                              onChange={(e) =>
                                setPositionForm((p) => ({ ...p, assetClass: e.target.value as AssetClass }))
                              }
                              options={Object.entries(assetClassLabels).map(([v, l]) => ({
                                value: v,
                                label: l
                              }))}
                            />
                          </FormGroup>
                          <FormGroup label="市场 / 币种">
                            <div className="flex gap-2">
                              <Input
                                value={positionForm.market}
                                onChange={(e) => setPositionForm((p) => ({ ...p, market: e.target.value }))}
                                placeholder="CN"
                              />
                              <Input
                                value={positionForm.currency}
                                onChange={(e) => setPositionForm((p) => ({ ...p, currency: e.target.value }))}
                                placeholder="CNY"
                              />
                            </div>
                          </FormGroup>
                          <FormGroup label="数量">
                            <Input
                              type="number"
                              value={positionForm.quantity}
                              onChange={(e) => setPositionForm((p) => ({ ...p, quantity: e.target.value }))}
                              placeholder="0"
                            />
                          </FormGroup>
                          <FormGroup label="成本单价">
                            <Input
                              type="number"
                              value={positionForm.cost}
                              onChange={(e) => setPositionForm((p) => ({ ...p, cost: e.target.value }))}
                              placeholder="0.00"
                            />
                          </FormGroup>
                          <FormGroup label="建仓日期">
                            <Input
                              type="date"
                              value={positionForm.openDate}
                              onChange={(e) => setPositionForm((p) => ({ ...p, openDate: e.target.value }))}
                            />
                          </FormGroup>
                          <div className="flex items-end">
                            <Button variant="primary" onClick={handleSubmitPosition} className="w-full">
                              {positionForm.id ? "保存更改" : "添加持仓"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </Panel>
              )}

              {portfolioTab === "performance" && (
                <Panel>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">收益表现</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        收益曲线与口径区间保持一致。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {performanceRanges.map((range) => {
                        const isActive = performanceRange === range.key;
                        return (
                          <button
                            key={range.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isActive
                                ? "bg-primary text-white border-primary"
                                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            onClick={() => setPerformanceRange(range.key)}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {performanceLoading && <EmptyState message="正在加载收益曲线..." />}
                  {!performanceLoading && performanceError && (
                    <ErrorState
                      message={performanceError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadPerformance(activePortfolioId, performanceRange).catch((err) =>
                          setPerformanceError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}
                  {!performanceLoading && !performanceError && !activePortfolio && (
                    <EmptyState message="请先选择或创建组合。" />
                  )}
                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio &&
                    !performanceResult && <EmptyState message="暂无收益数据。" />}

                  {!performanceLoading && !performanceError && performance && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard
                          label="当前口径"
                          value={formatPerformanceMethod(performance.selectedMethod)}
                        />
                        <SummaryCard
                          label="区间"
                          value={formatDateRange(
                            selectedPerformance?.startDate,
                            selectedPerformance?.endDate
                          )}
                        />
                        <SummaryCard
                          label="总收益率"
                          value={formatPctNullable(selectedPerformance?.totalReturn ?? null)}
                        />
                        <SummaryCard
                          label="年化收益率"
                          value={formatPctNullable(selectedPerformance?.annualizedReturn ?? null)}
                        />
                      </div>

                      {dataQuality && <DataQualityCard quality={dataQuality} />}

                      {performance.reason && (
                        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-300">
                          {performance.reason}
                        </div>
                      )}

                      {performanceSeries ? (
                        <PerformanceChart series={performanceSeries} />
                      ) : (
                        <EmptyState message="暂无收益曲线。" />
                      )}

                      {contributionBreakdown ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-slate-500">
                                收益贡献
                              </div>
                              <div className="text-[11px] text-slate-400">
                                区间 {contributionBreakdown.startDate} ~ {contributionBreakdown.endDate}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              默认展示 Top {CONTRIBUTION_TOP_N}
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            按区间起止价格与期末持仓估算。
                          </div>
                          {contributionBreakdown.reason && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {contributionBreakdown.reason}
                            </div>
                          )}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ContributionTable
                              title="标的贡献"
                              entries={contributionBreakdown.bySymbol}
                              showAll={showAllSymbolContribution}
                              topCount={CONTRIBUTION_TOP_N}
                              onToggle={() =>
                                setShowAllSymbolContribution((prev) => !prev)
                              }
                              showMarketValue={showAllSymbolContribution}
                            />
                            <ContributionTable
                              title="资产类别贡献"
                              labelHeader="类别"
                              entries={contributionBreakdown.byAssetClass}
                              showAll={showAllAssetContribution}
                              topCount={CONTRIBUTION_TOP_N}
                              onToggle={() =>
                                setShowAllAssetContribution((prev) => !prev)
                              }
                              showMarketValue={showAllAssetContribution}
                            />
                          </div>
                        </div>
                      ) : (
                        <EmptyState message="暂无贡献数据。" />
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">TWR</div>
                          <DescriptionItem
                            label="区间"
                            value={formatDateRange(
                              performance.twr?.startDate,
                              performance.twr?.endDate
                            )}
                          />
                          <DescriptionItem
                            label="总收益率"
                            value={formatPctNullable(performance.twr?.totalReturn ?? null)}
                          />
                          <DescriptionItem
                            label="年化收益率"
                            value={formatPctNullable(
                              performance.twr?.annualizedReturn ?? null
                            )}
                          />
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                          <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">MWR</div>
                          <DescriptionItem
                            label="区间"
                            value={formatDateRange(
                              performance.mwr?.startDate,
                              performance.mwr?.endDate
                            )}
                          />
                          <DescriptionItem
                            label="总收益率"
                            value={formatPctNullable(performance.mwr?.totalReturn ?? null)}
                          />
                          <DescriptionItem
                            label="年化收益率"
                            value={formatPctNullable(
                              performance.mwr?.annualizedReturn ?? null
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </Panel>
              )}

              {portfolioTab === "trades" && (
                <Panel>
                  <div className="mb-2 rounded-none border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-base text-primary">
                          swap_horiz
                        </span>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          交易流水
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 rounded-none bg-transparent px-2 py-0.5">
                        <Input
                          type="date"
                          value={ledgerStartDate}
                          onChange={(e) => setLedgerStartDate(e.target.value)}
                          className="text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                          disabled={!activePortfolio}
                        />
                        <span className="text-xs text-slate-400">至</span>
                        <Input
                          type="date"
                          value={ledgerEndDate}
                          onChange={(e) => setLedgerEndDate(e.target.value)}
                          className="text-xs w-32 border-0 bg-transparent dark:bg-transparent focus:ring-0 focus:border-transparent rounded-none"
                          disabled={!activePortfolio}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <Select
                          value={ledgerFilter}
                          onChange={(e) => setLedgerFilter(e.target.value as LedgerFilter)}
                          options={[
                            { value: "all", label: "全部交易类型" },
                            ...ledgerEventTypeOptions
                          ]}
                          className="text-[11px] w-40 rounded-none border-0 !bg-transparent dark:!bg-transparent text-primary focus:ring-0 focus:border-transparent pl-2 pr-6"
                          disabled={!activePortfolio}
                        />
                        <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                        <span>
                          筛选结果 {filteredLedgerEntries.length} / {ledgerEntries.length}
                        </span>
                        {cashFlowTotals.map((item) => (
                          <span
                            key={item.currency}
                            className="text-[11px] font-mono text-emerald-500 dark:text-emerald-300"
                          >
                            现金净流 {item.currency} {formatCurrency(item.amount)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton
                          icon="refresh"
                          label="刷新流水"
                          size="sm"
                          className="rounded-none"
                          onClick={() => {
                            if (!activePortfolioId) return;
                            loadLedgerEntries(activePortfolioId).catch((err) =>
                              setLedgerError(toUserErrorMessage(err))
                            );
                          }}
                          disabled={!activePortfolioId || ledgerLoading}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon="add"
                          className={`rounded-none px-2 py-1 text-[11px] ${
                            isLedgerFormOpen || Boolean(ledgerForm.id)
                              ? "bg-slate-400 border-slate-400 hover:bg-slate-400 text-white"
                              : ""
                          }`}
                          onClick={handleOpenLedgerForm}
                          disabled={!activePortfolio || isLedgerFormOpen || Boolean(ledgerForm.id)}
                        >
                          录入
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!activePortfolio && <EmptyState message="请先选择或创建组合。" />}
                  {activePortfolio && ledgerLoading && <EmptyState message="正在加载流水..." />}
                  {activePortfolio && ledgerError && (
                    <ErrorState
                      message={ledgerError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadLedgerEntries(activePortfolioId).catch((err) =>
                          setLedgerError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}

                  {activePortfolio && (isLedgerFormOpen || Boolean(ledgerForm.id)) && (
                    <div className="mb-3 bg-cyan-50/45 dark:bg-cyan-950/20 border border-slate-200 dark:border-slate-800 border-t-0 border-l-2 border-r-2 border-b-2 border-l-cyan-300 border-r-cyan-300 border-b-cyan-300 dark:border-l-cyan-800 dark:border-r-cyan-800 dark:border-b-cyan-800 rounded-none p-3">
                      <LedgerForm
                        form={ledgerForm}
                        baseCurrency={activePortfolio.baseCurrency}
                        onChange={updateLedgerForm}
                        onSubmit={handleSubmitLedgerEntry}
                        onCancel={handleCancelLedgerEdit}
                      />
                    </div>
                  )}

                  {activePortfolio && !ledgerLoading && !ledgerError && (
                    <>
                      {filteredLedgerEntries.length === 0 ? (
                        <EmptyState message="暂无流水记录。" />
                      ) : (
                        <LedgerTable
                          entries={filteredLedgerEntries}
                          onEdit={handleEditLedgerEntry}
                          onDelete={handleRequestDeleteLedgerEntry}
                        />
                      )}
                    </>
                  )}
                </Panel>
              )}

              {portfolioTab === "risk" && (
                <Panel>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">风险指标</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        波动率与最大回撤基于区间曲线计算。
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {performanceRanges.map((range) => {
                        const isActive = performanceRange === range.key;
                        return (
                          <button
                            key={range.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isActive
                                ? "bg-primary text-white border-primary"
                                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            onClick={() => setPerformanceRange(range.key)}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300 ml-2">
                        <input
                          type="checkbox"
                          checked={riskAnnualized}
                          onChange={(e) => setRiskAnnualized(e.target.checked)}
                          className="h-3.5 w-3.5 rounded-none border-slate-300 text-primary focus:ring-primary"
                        />
                        年化波动
                      </label>
                    </div>
                  </div>

                  {performanceLoading && <EmptyState message="正在加载风险指标..." />}
                  {!performanceLoading && performanceError && (
                    <ErrorState
                      message={performanceError}
                      onRetry={() => {
                        if (!activePortfolioId) return;
                        loadPerformance(activePortfolioId, performanceRange).catch((err) =>
                          setPerformanceError(toUserErrorMessage(err))
                        );
                      }}
                    />
                  )}
                  {!performanceLoading && !performanceError && !activePortfolio && (
                    <EmptyState message="请先选择或创建组合。" />
                  )}
                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio &&
                    !performanceResult && <EmptyState message="暂无风险数据。" />}

                  {!performanceLoading &&
                    !performanceError &&
                    activePortfolio && (
                      <div className="space-y-4">
                        {riskMetrics ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <RiskMetricCard
                              title="估值曲线"
                              metrics={riskMetrics.nav}
                              annualized={riskAnnualized}
                            />
                            <RiskMetricCard
                              title="TWR 曲线"
                              metrics={riskMetrics.twr}
                              annualized={riskAnnualized}
                            />
                          </div>
                        ) : (
                          <EmptyState message="暂无风险指标。" />
                        )}
                        {snapshot && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 rounded-lg p-4">
                              <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                                集中度 (HHI)
                              </div>
                              <div className="text-2xl font-mono text-slate-800 dark:text-slate-100">
                                {hhiValue === null ? "--" : hhiValue.toFixed(3)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                阈值 {HHI_WARN_THRESHOLD.toFixed(2)}
                              </div>
                              {hhiValue !== null && hhiValue >= HHI_WARN_THRESHOLD && (
                                <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                                  集中度偏高，请关注单一标的风险。
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                </Panel>
              )}

              {["allocation", "corporate"].includes(portfolioTab) && (
                <PlaceholderPanel
                  title={portfolioTabs.find((tab) => tab.key === portfolioTab)?.label ?? ""}
                  description={portfolioTabs.find((tab) => tab.key === portfolioTab)?.description ?? ""}
                />
              )}
            </>
          )}

          {/* View: Risk */}
          {activeView === "risk" && (
            <Panel>
              {!snapshot ? <EmptyState message="暂无风险数据。" /> : (
                <div className="space-y-8 max-w-6xl">
                  {/* Exposure Table */}
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 pl-1">资产敞口分布</h3>
                    <div className="overflow-hidden border border-slate-200 dark:border-slate-800">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                         <thead className="bg-slate-50 dark:bg-slate-900">
                           <tr>
                             <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">资产类别</th>
                             <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">权重</th>
                             <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">市值</th>
                           </tr>
                         </thead>
                         <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
                           {snapshot.exposures.byAssetClass.map(e => (
                             <tr key={e.key}>
                               <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{formatAssetClassLabel(e.key)}</td>
                               <td className="px-4 py-2 text-sm text-right font-mono text-slate-600 dark:text-slate-400">{formatPct(e.weight)}</td>
                               <td className="px-4 py-2 text-sm text-right font-mono text-slate-900 dark:text-white">{formatCurrency(e.marketValue)}</td>
                             </tr>
                           ))}
                         </tbody>
                      </table>
                    </div>
                  </section>
                  
                  {/* Risk Limits */}
                  <section>
                     <div className="flex justify-between items-center mb-3 px-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">限额监控</h3>
                        {snapshot.riskWarnings.length > 0 && (
                          <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                            {snapshot.riskWarnings.length} 个预警
                          </span>
                        )}
                     </div>
                     <div className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {snapshot.riskLimits.map(limit => (
                           <div key={limit.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                 <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatRiskLimitTypeLabel(limit.limitType)}</div>
                                    <div className="font-medium text-slate-900 dark:text-white mt-1 text-lg">{limit.target}</div>
                                 </div>
                                 <div className="text-xl font-mono font-light text-slate-700 dark:text-slate-300">{formatPct(limit.threshold)}</div>
                              </div>
                              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                 <button onClick={() => handleEditRiskLimit(limit)} className="text-xs font-medium text-slate-500 hover:text-primary transition-colors">编辑</button>
                                 <button onClick={() => handleDeleteRiskLimit(limit.id)} className="text-xs font-medium text-slate-500 hover:text-red-500 transition-colors">删除</button>
                              </div>
                           </div>
                         ))}
                         {/* Add New Limit Form */}
                         <div className="bg-slate-50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-700 p-4 flex flex-col gap-3">
                           <div className="text-xs font-bold text-slate-400 uppercase text-center">{riskForm.id ? "编辑限额" : "新增限额"}</div>
                           <Select 
                              value={riskForm.limitType} 
                              onChange={(e) => setRiskForm(p => ({ ...p, limitType: e.target.value as RiskLimitType }))}
                              options={Object.entries(riskLimitTypeLabels).map(([v, l]) => ({ value: v, label: l }))}
                              className="text-xs"
                           />
                           <Input 
                              value={riskForm.target} 
                              onChange={(e) => setRiskForm(p => ({ ...p, target: e.target.value }))}
                              placeholder="目标 (如 600519)"
                              className="text-xs"
                           />
                           <Input 
                              type="number"
                              value={riskForm.thresholdPct} 
                              onChange={(e) => setRiskForm(p => ({ ...p, thresholdPct: e.target.value }))}
                              placeholder="阈值 %"
                              className="text-xs"
                           />
                           <div className="flex gap-2 mt-auto pt-2">
                              <Button variant="primary" size="sm" onClick={handleSubmitRiskLimit} className="w-full">{riskForm.id ? "保存" : "添加"}</Button>
                              {riskForm.id && <Button variant="secondary" size="sm" onClick={handleCancelRiskEdit}>取消</Button>}
                           </div>
                         </div>
                       </div>
                     </div>
                  </section>
                </div>
              )}
            </Panel>
          )}

          {/* View: Market */}
          {activeView === "market" && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

          {/* View: Other Tabs */}
          {activeView === "other" && (
            <Panel>
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-border-dark pb-2">
                <div role="tablist" aria-label="\u5176\u4ed6\u529f\u80fd" className="flex items-center gap-2">
                  {otherTabs.map((tab) => {
                    const isActive = otherTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors ${
                          isActive
                            ? "text-primary border-primary"
                            : "text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200"
                        }`}
                        onClick={() => setOtherTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>
          )}

          {/* View: Other / Data Import */}
          {activeView === "other" && otherTab === "data-import" && (
            <Panel>
               <div className="mb-6 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 p-3 text-sm text-blue-800 dark:text-blue-300">
                  最新行情日期：<span className="font-mono font-medium">{snapshot?.priceAsOf ?? "--"}</span>
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
                  <section className="space-y-4">
                     <h3 className="font-bold text-slate-900 dark:text-white">CSV 导入</h3>
                     <FormGroup label="持仓 CSV">
                        <div className="flex gap-2">
                          <Input value={holdingsCsvPath ?? ""} readOnly className="flex-1 text-xs font-mono" />
                          <Button variant="secondary" onClick={() => handleChooseCsv("holdings")}>选择</Button>
                          <Button variant="primary" onClick={handleImportHoldings} disabled={!holdingsCsvPath || !activePortfolio}>导入</Button>
                        </div>
                     </FormGroup>
                     <FormGroup label="价格 CSV">
                        <div className="flex gap-2">
                          <Input value={pricesCsvPath ?? ""} readOnly className="flex-1 text-xs font-mono" />
                          <Button variant="secondary" onClick={() => handleChooseCsv("prices")}>选择</Button>
                          <Button variant="primary" onClick={handleImportPrices} disabled={!pricesCsvPath}>导入</Button>
                        </div>
                     </FormGroup>
                  </section>

                  <section className="space-y-4">
                     <h3 className="font-bold text-slate-900 dark:text-white">Tushare 拉取</h3>
                     <FormGroup label="日期范围">
                        <div className="flex gap-2 items-center">
                           <Input type="date" value={ingestStartDate} onChange={(e) => setIngestStartDate(e.target.value)} />
                           <span className="text-slate-400">-</span>
                           <Input type="date" value={ingestEndDate} onChange={(e) => setIngestEndDate(e.target.value)} />
                        </div>
                     </FormGroup>
                     <div className="pt-2">
                        <Button variant="primary" onClick={handleIngestTushare} disabled={!snapshot || snapshot.positions.length === 0} className="w-full">
                           开始拉取
                        </Button>
                        <p className="mt-2 text-xs text-slate-500">使用当前持仓代码拉取。请先设置 MYTRADER_TUSHARE_TOKEN。</p>
                     </div>
                  </section>
               </div>
            </Panel>
          )}

          {/* Placeholders */}
          {["opportunities", "backtest", "insights", "alerts", "index-tracking", "data-analysis"].includes(activeView) && (
            <PlaceholderPanel 
              title={navItems.find(n => n.key === activeView)?.label ?? ""}
              description={navItems.find(n => n.key === activeView)?.description ?? ""}
            />
          )}

        </div>

        {ledgerDeleteTarget && (
          <ConfirmDialog
            open={Boolean(ledgerDeleteTarget)}
            title="确认删除"
            message={
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>将删除以下流水记录，操作不可撤销。</p>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {ledgerDeleteSummary}
                </p>
              </div>
            }
            confirmLabel="删除"
            onConfirm={handleConfirmDeleteLedgerEntry}
            onCancel={handleCancelDeleteLedgerEntry}
          />
        )}

        {/* Global Notifications */}
        {(error || notice) && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
              <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
                 error 
                 ? "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100" 
                 : "bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100"
              }`}>
                 <span className="material-icons-outlined">{error ? "error" : "check_circle"}</span>
                 <span className="text-sm font-medium">{toastMessage}</span>
                 <button onClick={() => { setError(null); setNotice(null); }} className="ml-2 opacity-60 hover:opacity-100">
                    <span className="material-icons-outlined text-sm">close</span>
                 </button>
              </div>
           </div>
        )}
      </section>
    </div>
  );
}

// --- UI Components ---

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-transparent mb-4 last:mb-0">
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string, description: string }) {
   return (
      <Panel>
         <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-icons-outlined text-5xl mb-4 opacity-30">construction</span>
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">{title}</h3>
            <p className="text-sm opacity-80">{description}</p>
            <p className="text-xs mt-4 opacity-50">该模块为占位视图，将在后续版本逐步实现。</p>
         </div>
      </Panel>
   )
}

function FormGroup({ label, children }: { label: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
function Input({ className, ...props }: InputProps) {
  const isDateInput =
    props.type === "date" || props.type === "datetime-local";
  const isEmpty =
    props.value === "" || props.value === undefined || props.value === null;
  const dateHintClass =
    isDateInput && isEmpty ? "text-slate-500 dark:text-slate-400" : "";

  return (
    <input 
      className={`block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800 ${dateHintClass} ${className}`}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string, label: string, disabled?: boolean }[];
}
function Select({ className, options, ...props }: SelectProps) {
  return (
    <select
      className={`block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 pl-3 pr-10 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 ${className}`}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
      ))}
    </select>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
}
function Button({ children, variant = 'secondary', size = 'md', icon, className, ...props }: ButtonProps) {
  const baseClass = "inline-flex items-center justify-center rounded font-medium !text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:brightness-90 disabled:saturate-80 disabled:shadow-none";
  
  const variants = {
    primary: "bg-primary border border-primary/90 shadow-md hover:bg-[#14b8ca] focus:ring-primary/70",
    secondary: "bg-slate-500 border border-slate-400/80 shadow-md hover:bg-slate-400 dark:bg-slate-400 dark:hover:bg-slate-300 focus:ring-slate-300/70",
    danger: "bg-red-500 border border-red-400/90 shadow-md hover:bg-red-400 focus:ring-red-400/80"
  };
  
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2 text-sm"
  };
  const hasChildren = children !== undefined && children !== null && children !== false;

  return (
    <button 
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && (
        <span
          className={`material-icons-outlined ${
            size === "sm" ? "text-sm" : "text-base"
          } ${hasChildren ? (size === "sm" ? "mr-1.5" : "mr-2") : ""}`}
        >
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  size?: "sm" | "md";
}

function IconButton({
  icon,
  label,
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  const sizeClass = size === "sm" ? "p-1.5" : "p-2";
  const iconClass = size === "sm" ? "text-sm" : "text-base";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 ${sizeClass} text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <span className={`material-icons-outlined ${iconClass}`}>{icon}</span>
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10">
      {children}
    </span>
  );
}

function SummaryCard({ label, value, trend }: { label: string, value: string, trend?: 'up' | 'down' }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
       <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
       <div className={`text-xl font-bold font-mono ${
          trend === 'up' ? 'text-green-600 dark:text-green-500' : 
          trend === 'down' ? 'text-red-600 dark:text-red-500' : 
          'text-slate-900 dark:text-white'
       }`}>
          {value}
       </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
      <span className="material-icons-outlined text-3xl mb-2 opacity-50">inbox</span>
      <p className="text-sm">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-4 px-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-900/40">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-base">error_outline</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOpen = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setOpen(true), 500);
  };

  const closeHint = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={scheduleOpen}
      onMouseLeave={closeHint}
      onFocus={scheduleOpen}
      onBlur={closeHint}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-none border border-slate-300 dark:border-slate-600 text-[10px] text-slate-500 dark:text-slate-300 cursor-help"
        aria-label={text}
      >
        ?
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-max max-w-xs -translate-x-1/2 whitespace-normal rounded-none border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-5"
      >
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
          {title}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {message}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
}

function LedgerTable({ entries, onEdit, onDelete }: LedgerTableProps) {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 mb-4">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            {[
              "日期",
              "类型",
              "标的",
              "方向",
              "数量/价格",
              "现金腿",
              "费用/税费",
              "来源",
              "备注",
              "操作"
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
          {entries.map((entry) => {
            const isReadonly = entry.source === "system";
            const cashClass =
              entry.cashAmount === null
                ? "text-slate-500 dark:text-slate-400"
                : entry.cashAmount < 0
                  ? "text-red-500"
                  : "text-emerald-600";
            return (
              <tr
                key={entry.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
              >
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    {entry.tradeDate}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {entry.eventTs ? formatDateTime(entry.eventTs) : "无时间"}
                    {entry.sequence !== null ? ` / seq ${entry.sequence}` : ""}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatLedgerEventType(entry.eventType)}
                  </div>
                  {entry.eventType === "corporate_action" && (
                    <div className="text-[10px] text-slate-400">
                      {formatCorporateActionMeta(entry.meta)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-200">
                    {entry.symbol ?? entry.instrumentId ?? "--"}
                  </div>
                  {entry.symbol && entry.instrumentId && (
                    <div className="text-[10px] text-slate-400">
                      {entry.instrumentId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
                  {formatLedgerSide(entry.side)}
                </td>
                <td className="px-4 py-2">
                  <div className="text-sm font-mono text-right text-slate-700 dark:text-slate-200">
                    {formatNumber(entry.quantity)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {entry.price !== null ? formatCurrency(entry.price) : "--"}
                    {entry.priceCurrency ? ` ${entry.priceCurrency}` : ""}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className={`text-sm font-mono text-right ${cashClass}`}>
                    {formatCurrency(entry.cashAmount)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">
                    {entry.cashCurrency ?? "--"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-[11px] font-mono text-right text-slate-600 dark:text-slate-300">
                    {entry.fee !== null ? formatCurrency(entry.fee) : "--"}
                  </div>
                  <div className="text-[11px] font-mono text-right text-slate-600 dark:text-slate-300">
                    {entry.tax !== null ? formatCurrency(entry.tax) : "--"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {formatLedgerSource(entry.source)}
                  </div>
                  {entry.externalId && (
                    <div className="text-[10px] text-slate-400">
                      {entry.externalId}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {entry.note ?? "--"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(entry)}
                      className={`p-1 transition-colors ${
                        isReadonly
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-primary"
                      }`}
                      title={isReadonly ? "系统流水不可编辑" : "编辑"}
                      disabled={isReadonly}
                    >
                      <span className="material-icons-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => onDelete(entry)}
                      className={`p-1 transition-colors ${
                        isReadonly
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-red-500"
                      }`}
                      title={isReadonly ? "系统流水不可删除" : "删除"}
                      disabled={isReadonly}
                    >
                      <span className="material-icons-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface LedgerFormProps {
  form: LedgerFormState;
  baseCurrency: string;
  onChange: (patch: Partial<LedgerFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function LedgerForm({ form, baseCurrency, onChange, onSubmit, onCancel }: LedgerFormProps) {
  const isEditing = Boolean(form.id);
  const isCorporateDividend =
    form.eventType === "corporate_action" && form.corporateKind === "dividend";
  const effectiveEventType: LedgerEventType = isCorporateDividend
    ? "dividend"
    : form.eventType;
  const usesInstrument = [
    "trade",
    "dividend",
    "adjustment",
    "corporate_action"
  ].includes(effectiveEventType);
  const usesSide = ["trade", "adjustment"].includes(effectiveEventType);
  const usesQuantity = ["trade", "adjustment"].includes(effectiveEventType);
  const usesPrice = ["trade", "adjustment"].includes(effectiveEventType);
  const usesCash = ["trade", "cash", "fee", "tax", "dividend"].includes(
    effectiveEventType
  );
  const usesFeeTax = form.eventType === "trade";
  const tradeDateMissing = form.tradeDate.trim() === "";
  const instrumentMissing =
    usesInstrument &&
    form.symbol.trim() === "" &&
    form.instrumentId.trim() === "";
  const sideMissing = usesSide && !form.side;
  const quantityMissing = usesQuantity && form.quantity.trim() === "";
  const priceMissing = usesPrice && form.price.trim() === "";
  const cashAmountMissing = usesCash && form.cashAmount.trim() === "";
  const corporateAfterSharesMissing =
    form.eventType === "corporate_action" &&
    form.corporateKind !== "info" &&
    form.corporateKind !== "dividend" &&
    form.corporateAfterShares.trim() === "";
  const missingHintClass =
    "text-rose-600 dark:text-rose-400 placeholder:text-rose-500 dark:placeholder:text-rose-400";
  const compactInputClass = "h-8 py-1 text-xs sm:text-xs rounded-none";
  const compactSelectClass = "h-8 py-1 text-xs sm:text-xs rounded-none";
  const isDeprecatedEventType =
    form.eventType === "fee" ||
    form.eventType === "tax" ||
    form.eventType === "adjustment";
  const showCorporateControls = form.eventType === "corporate_action";
  const corporateKindOptions =
    form.corporateKind === "info"
      ? [
          { value: "split", label: corporateActionKindLabels.split },
          { value: "reverse_split", label: corporateActionKindLabels.reverse_split },
          { value: "info", label: "信息（历史）", disabled: true }
        ]
      : [
          { value: "split", label: corporateActionKindLabels.split },
          { value: "reverse_split", label: corporateActionKindLabels.reverse_split },
          { value: "dividend", label: corporateActionKindLabels.dividend }
        ];
  const eventTypeOptions = isDeprecatedEventType
    ? [
        ...ledgerEventTypeOptions,
        {
          value: form.eventType,
          label: ledgerEventTypeLabels[form.eventType],
          disabled: true
        }
      ]
    : ledgerEventTypeOptions;
  const showPrimaryInstrumentRow =
    usesInstrument || usesSide || usesQuantity || usesPrice;
  const shouldAutoFeeTax = form.eventType === "trade";
  const shouldAutoCashAmount = form.eventType === "trade" && form.cashAmountAuto;

  useEffect(() => {
    if (!shouldAutoFeeTax) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) {
      return;
    }
    const feeRateRaw =
      form.feeRate.trim() === "" ? null : Number(form.feeRate);
    const taxRateRaw =
      form.taxRate.trim() === "" ? null : Number(form.taxRate);
    const updates: Partial<LedgerFormState> = {};

    if (feeRateRaw !== null && Number.isFinite(feeRateRaw) && feeRateRaw >= 0) {
      const feeValue = (quantity * price * (feeRateRaw / 100)).toFixed(2);
      if (feeValue !== form.fee) {
        updates.fee = feeValue;
      }
    }
    if (taxRateRaw !== null && Number.isFinite(taxRateRaw) && taxRateRaw >= 0) {
      const taxValue = (quantity * price * (taxRateRaw / 100)).toFixed(2);
      if (taxValue !== form.tax) {
        updates.tax = taxValue;
      }
    }

    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [
    shouldAutoFeeTax,
    form.quantity,
    form.price,
    form.feeRate,
    form.taxRate,
    form.fee,
    form.tax,
    onChange
  ]);

  useEffect(() => {
    if (!shouldAutoCashAmount) return;
    if (!form.side) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity <= 0 || price < 0) {
      return;
    }
    const feeRaw = Number(form.fee);
    const taxRaw = Number(form.tax);
    const feeValue = Number.isFinite(feeRaw) ? feeRaw : 0;
    const taxValue = Number.isFinite(taxRaw) ? taxRaw : 0;
    const baseAmount = quantity * price;
    const signedAmount = form.side === "buy" ? -baseAmount : baseAmount;
    const nextCashAmount = (signedAmount - feeValue - taxValue).toFixed(2);
    if (nextCashAmount !== form.cashAmount) {
      onChange({ cashAmount: nextCashAmount });
    }
  }, [
    shouldAutoCashAmount,
    form.side,
    form.quantity,
    form.price,
    form.fee,
    form.tax,
    form.cashAmount,
    onChange
  ]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    if (form.feeRate.trim() || form.taxRate.trim()) return;
    const storedRates = loadStoredRates(form.eventType);
    if (storedRates.feeRate || storedRates.taxRate) {
      onChange({
        feeRate: storedRates.feeRate,
        taxRate: storedRates.taxRate
      });
    }
  }, [form.eventType, form.feeRate, form.taxRate, onChange]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    const feeRateValue =
      form.feeRate.trim() === "" ? null : Number(form.feeRate);
    const taxRateValue =
      form.taxRate.trim() === "" ? null : Number(form.taxRate);
    if (
      feeRateValue === null ||
      taxRateValue === null ||
      !Number.isFinite(feeRateValue) ||
      !Number.isFinite(taxRateValue) ||
      feeRateValue < 0 ||
      taxRateValue < 0
    ) {
      return;
    }
    saveStoredRates(form.eventType, form.feeRate.trim(), form.taxRate.trim());
  }, [form.eventType, form.feeRate, form.taxRate]);

  useEffect(() => {
    if (form.eventType !== "trade") return;
    if (!form.priceCurrency) return;
    if (form.cashCurrency !== form.priceCurrency) {
      onChange({ cashCurrency: form.priceCurrency });
    }
  }, [form.eventType, form.priceCurrency, form.cashCurrency, onChange]);

  const corporateKindField = showCorporateControls ? (
    <FormGroup label="事件类型">
      <Select
        value={form.corporateKind}
        onChange={(e) =>
          onChange({ corporateKind: e.target.value as CorporateActionKindUi })
        }
        options={corporateKindOptions}
        className={compactSelectClass}
      />
    </FormGroup>
  ) : null;

  const cashLegField = usesCash ? (
    <FormGroup
      label={
        <span className="inline-flex items-center gap-1">
          现金腿
          <HelpHint text="买入为负，卖出为正；费用/税费为负；分红为正。" />
        </span>
      }
    >
      <Input
        type="number"
        value={form.cashAmount}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange({
            cashAmount: nextValue,
            cashAmountAuto: nextValue.trim() === ""
          });
        }}
        placeholder="0.00"
        className={`${cashAmountMissing ? missingHintClass : ""} ${compactInputClass}`}
      />
    </FormGroup>
  ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <span
              className="material-icons-outlined text-primary text-base"
              aria-label={isEditing ? "编辑流水" : "新增流水"}
            >
              edit_note
            </span>
            <span className="sr-only">
              {isEditing ? "编辑流水" : "新增流水"}
            </span>
          </h3>
          <Select
            value={form.eventType}
            onChange={(e) =>
              {
                const nextCurrency =
                  form.priceCurrency || form.cashCurrency || baseCurrency;
                const nextEventType = e.target.value as LedgerEventType;
                onChange({
                  eventType: nextEventType,
                  cashCurrency: nextCurrency,
                  priceCurrency: nextCurrency,
                  cashAmountAuto: true
                });
              }
            }
            options={eventTypeOptions}
            className="h-6 w-32 rounded-none border-0 !bg-transparent dark:!bg-transparent py-0 pl-2 pr-6 text-[11px] focus:ring-0 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            className="rounded-none px-2 py-1 text-[11px]"
            onClick={onSubmit}
          >
            保存
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-none px-2 py-1 text-[11px]"
            onClick={onCancel}
          >
            取消
          </Button>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-800" />

      <div className="space-y-2">
        {showPrimaryInstrumentRow && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {usesInstrument && (
              <FormGroup label="代码">
                <Input
                  value={form.symbol}
                  onChange={(e) => onChange({ symbol: e.target.value })}
                  placeholder="例如: 600519.SH"
                  className={`${instrumentMissing ? missingHintClass : ""} ${compactInputClass}`}
                />
              </FormGroup>
            )}
              {usesSide && (
                <FormGroup label="方向">
                  <div
                    role="group"
                    aria-label="方向"
                    className={`grid grid-cols-2 overflow-hidden rounded-none border ${
                      sideMissing
                        ? "border-rose-500"
                        : "border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    <button
                      type="button"
                      aria-pressed={form.side === "buy"}
                      onClick={() => onChange({ side: "buy" })}
                      className={`h-8 px-2 text-xs ${
                        form.side === "buy"
                          ? "bg-primary text-white"
                          : "bg-transparent text-slate-500 dark:text-slate-400"
                      } border-r border-slate-300 dark:border-slate-700`}
                    >
                      买入
                    </button>
                    <button
                      type="button"
                      aria-pressed={form.side === "sell"}
                      onClick={() => onChange({ side: "sell" })}
                      className={`h-8 px-2 text-xs ${
                        form.side === "sell"
                          ? "bg-primary text-white"
                          : "bg-transparent text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      卖出
                    </button>
                  </div>
                </FormGroup>
              )}
              {usesQuantity && (
                <FormGroup label="数量">
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => onChange({ quantity: e.target.value })}
                    placeholder="0"
                    className={`${quantityMissing ? missingHintClass : ""} ${compactInputClass}`}
                  />
                </FormGroup>
              )}
              {usesPrice && (
                <FormGroup label="价格">
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => onChange({ price: e.target.value })}
                    placeholder="0.00"
                    className={`${priceMissing ? missingHintClass : ""} ${compactInputClass}`}
                  />
                </FormGroup>
              )}
              {usesPrice && (
                <FormGroup label="价格币种">
                  <Input
                    value={form.priceCurrency}
                    onChange={(e) => {
                      const nextCurrency = e.target.value;
                      onChange({ priceCurrency: nextCurrency, cashCurrency: nextCurrency });
                    }}
                    placeholder={baseCurrency}
                    className={compactInputClass}
                  />
                </FormGroup>
              )}
              {usesInstrument && (
                <FormGroup
                  label={
                    <span className="inline-flex items-center gap-1">
                      标的标识
                      <HelpHint text="用于绑定稳定标的编号；可选，留空时使用代码。"/>
                    </span>
                  }
                >
                  <Input
                    value={form.instrumentId}
                    onChange={(e) => onChange({ instrumentId: e.target.value })}
                    placeholder="可选"
                    className={compactInputClass}
                  />
              </FormGroup>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          {isCorporateDividend ? (
            <>
              {corporateKindField}
              {cashLegField}
            </>
          ) : (
            <>
              {cashLegField}
              {corporateKindField}
            </>
          )}
          {showCorporateControls &&
            !isCorporateDividend &&
            form.corporateKind !== "info" && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  调整后股数
                  <HelpHint text="当前 1 股调整后变为多少股。" />
                </span>
              }
            >
              <Input
                type="number"
                value={form.corporateAfterShares}
                onChange={(e) => onChange({ corporateAfterShares: e.target.value })}
                placeholder="例如: 2 或 0.5"
                className={`${corporateAfterSharesMissing ? missingHintClass : ""} ${compactInputClass}`}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup label="费率 %">
              <Input
                type="number"
                value={form.feeRate}
                onChange={(e) => onChange({ feeRate: e.target.value })}
                placeholder="0.03"
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup label="税率 %">
              <Input
                type="number"
                value={form.taxRate}
                onChange={(e) => onChange({ taxRate: e.target.value })}
                placeholder="0.1"
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  费用
                  <HelpHint text="交易手续费或佣金，通常为正数。"/>
                </span>
              }
            >
              <Input
                type="number"
                value={form.fee}
                onChange={(e) => onChange({ fee: e.target.value })}
                placeholder="0.00"
                disabled
                className={compactInputClass}
              />
            </FormGroup>
          )}
          {usesFeeTax && (
            <FormGroup
              label={
                <span className="inline-flex items-center gap-1">
                  税费
                  <HelpHint text="交易相关税费，通常为正数。"/>
                </span>
              }
            >
              <Input
                type="number"
                value={form.tax}
                onChange={(e) => onChange({ tax: e.target.value })}
                placeholder="0.00"
                disabled
                className={compactInputClass}
              />
            </FormGroup>
          )}
          <FormGroup
            label={
              <span className="inline-flex items-center gap-1">
                外部标识
                <HelpHint text="用于导入对账或去重的外部流水编号，可选。"/>
              </span>
            }
          >
            <Input
              value={form.externalId}
              onChange={(e) => onChange({ externalId: e.target.value })}
              placeholder="可选"
              className={compactInputClass}
            />
          </FormGroup>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <FormGroup label="交易日期">
          <Input
            type="date"
            value={form.tradeDate}
            onChange={(e) => onChange({ tradeDate: e.target.value })}
            className={`${tradeDateMissing ? missingHintClass : ""} ${compactInputClass}`}
          />
        </FormGroup>
        <FormGroup label="事件时间">
          <Input
            type="datetime-local"
            value={form.eventTime}
            onChange={(e) => onChange({ eventTime: e.target.value })}
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup label="排序序号">
          <Input
            type="number"
            value={form.sequence}
            onChange={(e) => onChange({ sequence: e.target.value })}
            placeholder="同日顺序"
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup
          label={
            <span className="inline-flex items-center gap-1">
              账户标识
              <HelpHint text="多账户预留字段，当前可留空。"/>
            </span>
          }
        >
          <Input
            value={form.accountKey}
            onChange={(e) => onChange({ accountKey: e.target.value })}
            placeholder="可选"
            className={compactInputClass}
          />
        </FormGroup>
        <FormGroup label="备注">
          <Input
            value={form.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="可选"
            className={compactInputClass}
          />
        </FormGroup>
      </div>

    </div>
  );
}

function DataQualityCard({ quality }: { quality: MarketDataQuality }) {
  const overall = describeDataQuality(quality.overallLevel);
  const coverage = describeDataQuality(quality.coverageLevel);
  const freshness = describeDataQuality(quality.freshnessLevel);
  const freshnessLabel =
    quality.freshnessDays === null ? "--" : `${quality.freshnessDays} 天`;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${overall.badgeClass}`}>
            {overall.label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">数据质量</span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          as-of {quality.asOfDate ?? "--"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">覆盖率</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {formatPctNullable(quality.coverageRatio ?? null)}
          </div>
          <div className={`text-[11px] font-semibold ${coverage.textClass}`}>
            {coverage.label}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">新鲜度</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {freshnessLabel}
          </div>
          <div className={`text-[11px] font-semibold ${freshness.textClass}`}>
            {freshness.label}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">缺失标的</div>
          <div className="font-mono text-slate-800 dark:text-slate-200">
            {quality.missingSymbols.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {quality.missingSymbols.length ? "需要补齐行情" : "覆盖完整"}
          </div>
        </div>
      </div>
      {quality.notes.length > 0 && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {quality.notes.join("；")}
        </div>
      )}
    </div>
  );
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatPctNullable(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return formatPct(value);
}

function formatPerformanceMethod(value: PerformanceMethod): string {
  switch (value) {
    case "twr":
      return "TWR";
    case "mwr":
      return "MWR";
    default:
      return "--";
  }
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "--";
  return `${start} ~ ${end}`;
}

function sortContributionEntries(entries: ContributionEntry[]): ContributionEntry[] {
  return [...entries].sort((a, b) => {
    const aScore = a.contribution === null ? -Infinity : Math.abs(a.contribution);
    const bScore = b.contribution === null ? -Infinity : Math.abs(b.contribution);
    if (aScore !== bScore) return bScore - aScore;
    return b.marketValue - a.marketValue;
  });
}

function formatAssetClassLabel(value: string): string {
  if (value in assetClassLabels) {
    return assetClassLabels[value as AssetClass];
  }
  return value;
}

function formatRiskLimitTypeLabel(value: RiskLimitType): string {
  return riskLimitTypeLabels[value] ?? value;
}

function formatLedgerEventType(value: LedgerEventType): string {
  return ledgerEventTypeLabels[value] ?? value;
}

function formatLedgerSide(value: LedgerSide | null): string {
  if (!value) return "--";
  return ledgerSideLabels[value] ?? value;
}

function formatLedgerSource(value: LedgerSource): string {
  return ledgerSourceLabels[value] ?? value;
}

function isCorporateActionMeta(
  meta: LedgerEntryMeta | null
): meta is CorporateActionMeta {
  if (!meta || typeof meta !== "object") return false;
  const kind = (meta as CorporateActionMeta).kind;
  return kind === "split" || kind === "reverse_split" || kind === "info";
}

function formatCorporateActionMeta(meta: LedgerEntryMeta | null): string {
  if (!isCorporateActionMeta(meta)) return "--";
  if (meta.kind === "info") {
    const category = corporateActionCategoryLabels[meta.category] ?? meta.category;
    return `${category} · ${meta.title}`;
  }
  const kindLabel = corporateActionKindLabels[meta.kind] ?? meta.kind;
  return `${kindLabel} ${meta.numerator}:${meta.denominator}`;
}

function formatDateTime(value: number | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
}

function formatDateTimeInput(value: number | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function sanitizeToastMessage(message: string): string {
  if (!message) return message;
  if (/[A-Za-z]/.test(message)) {
    return "操作失败，请检查输入后重试。";
  }
  return message;
}

function describeDataQuality(level: DataQualityLevel): {
  label: string;
  badgeClass: string;
  textClass: string;
} {
  switch (level) {
    case "ok":
      return {
        label: "可用",
        badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        textClass: "text-emerald-600 dark:text-emerald-400"
      };
    case "partial":
      return {
        label: "有缺口",
        badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        textClass: "text-amber-600 dark:text-amber-400"
      };
    default:
      return {
        label: "不可用",
        badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
        textClass: "text-rose-600 dark:text-rose-400"
      };
  }
}

function toUserErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message || "未知错误。";
  if (typeof error === "string") return error;
  return "未知错误。";
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const LEDGER_RATE_STORAGE_PREFIX = "mytrader:ledger:rates:";

function loadStoredRates(eventType: LedgerEventType): { feeRate: string; taxRate: string } {
  if (typeof window === "undefined" || !window.localStorage) {
    return { feeRate: "", taxRate: "" };
  }
  try {
    const raw = window.localStorage.getItem(`${LEDGER_RATE_STORAGE_PREFIX}${eventType}`);
    if (!raw) return { feeRate: "", taxRate: "" };
    const parsed = JSON.parse(raw) as { feeRate?: string; taxRate?: string };
    return {
      feeRate: typeof parsed.feeRate === "string" ? parsed.feeRate : "",
      taxRate: typeof parsed.taxRate === "string" ? parsed.taxRate : ""
    };
  } catch {
    return { feeRate: "", taxRate: "" };
  }
}

function saveStoredRates(eventType: LedgerEventType, feeRate: string, taxRate: string) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${LEDGER_RATE_STORAGE_PREFIX}${eventType}`,
      JSON.stringify({ feeRate, taxRate })
    );
  } catch {
    // ignore storage failures
  }
}

function deriveRateValue(
  amount: number | null | undefined,
  quantity: number | null | undefined,
  price: number | null | undefined
): string {
  if (amount === null || amount === undefined) return "";
  if (quantity === null || quantity === undefined) return "";
  if (price === null || price === undefined) return "";
  const base = quantity * price;
  if (!Number.isFinite(base) || base === 0) return "";
  const rate = (amount / base) * 100;
  if (!Number.isFinite(rate)) return "";
  return rate
    .toFixed(4)
    .replace(/\.?0+$/, "");
}

function parseOptionalNumberInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw new Error(`${field}必须是数字。`);
  }
  return num;
}

function parseOptionalIntegerInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error(`${field}必须是整数。`);
  }
  return num;
}

function formatCorporateAfterShares(numerator: number, denominator: number): string {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return "";
  }
  const value = numerator / denominator;
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function parseCorporateAfterShares(value: string): { numerator: number; denominator: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("调整后股数不能为空。");
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("调整后股数必须为正数。");
  }
  const scale = 10000;
  const scaled = Math.round(parsed * scale);
  if (!Number.isFinite(scaled) || scaled <= 0) {
    throw new Error("调整后股数必须为正数。");
  }
  const divisor = greatestCommonDivisor(scaled, scale);
  return {
    numerator: scaled / divisor,
    denominator: scale / divisor
  };
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function parseOptionalDateTimeInput(value: string, field: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) {
    throw new Error(`${field}格式不正确。`);
  }
  return ts;
}

function createEmptyLedgerForm(baseCurrency: string): LedgerFormState {
  const storedRates = loadStoredRates("trade");
  return {
    eventType: "trade",
    tradeDate: formatInputDate(new Date()),
    eventTime: "",
    sequence: "",
    accountKey: "",
    instrumentId: "",
    symbol: "",
    side: "",
    quantity: "",
    price: "",
    priceCurrency: baseCurrency,
    cashAmount: "",
    cashCurrency: baseCurrency,
    fee: "",
    tax: "",
    feeRate: storedRates.feeRate,
    taxRate: storedRates.taxRate,
    cashAmountAuto: true,
    note: "",
    source: "manual",
    externalId: "",
    corporateKind: "split",
    corporateAfterShares: ""
  };
}

function DescriptionItem({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-200">{value}</span>
    </div>
  )
}

function PerformanceChart({ series }: { series: PortfolioPerformanceSeries }) {
  if (series.points.length < 2) {
    return <EmptyState message={series.reason ?? "暂无收益曲线。"} />;
  }

  const width = 640;
  const height = 200;
  const returns = series.points.map((point) => point.returnPct);
  const min = Math.min(...returns, 0);
  const max = Math.max(...returns, 0);
  const range = max - min || 1;

  const toX = (index: number) =>
    (index / (series.points.length - 1)) * width;
  const toY = (value: number) => height - ((value - min) / range) * height;

  const path = series.points
    .map((point, index) => `${index === 0 ? "M" : "L"}${toX(index)},${toY(point.returnPct)}`)
    .join(" ");
  const baselineY = toY(0);
  const areaPath = `${path} L${width},${baselineY} L0,${baselineY} Z`;
  const endPoint = series.points[series.points.length - 1];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">收益曲线</div>
        <Badge>{formatPerformanceMethod(series.method)}</Badge>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="performanceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#performanceFill)" />
        <path d={path} fill="none" stroke="#0ea5e9" strokeWidth="2" />
        <line x1="0" y1={baselineY} x2={width} y2={baselineY} stroke="#94a3b8" strokeDasharray="4 4" />
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
        <span>{series.startDate}</span>
        <span className="font-mono">{formatPctNullable(endPoint?.returnPct)}</span>
        <span>{series.endDate}</span>
      </div>
      {series.reason && (
        <p className="text-xs text-slate-400 mt-2">{series.reason}</p>
      )}
    </div>
  );
}

interface ContributionTableProps {
  title: string;
  entries: ContributionEntry[];
  labelHeader?: string;
  showAll: boolean;
  topCount: number;
  showMarketValue: boolean;
  onToggle: () => void;
}

function ContributionTable({
  title,
  entries,
  labelHeader,
  showAll,
  topCount,
  showMarketValue,
  onToggle
}: ContributionTableProps) {
  const sorted = sortContributionEntries(entries);
  const visible = showAll ? sorted : sorted.slice(0, topCount);
  const canToggle = entries.length > topCount;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
        {canToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-primary hover:text-primary/80"
          >
            {showAll ? "收起" : "展开全部"}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <div className="text-xs text-slate-400">暂无数据</div>
      ) : (
        <div className="overflow-hidden border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase">
                  {labelHeader ?? "标的"}
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  权重
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  区间涨跌
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                  贡献
                </th>
                {showMarketValue && (
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase">
                    市值
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-dark/70 divide-y divide-slate-200 dark:divide-border-dark">
              {visible.map((entry) => (
                <tr key={entry.key}>
                  <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                    {entry.label}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                    {formatPct(entry.weight)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                    {formatPctNullable(entry.returnPct)}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono text-slate-700 dark:text-slate-100">
                    {formatPctNullable(entry.contribution)}
                  </td>
                  {showMarketValue && (
                    <td className="px-3 py-2 text-xs text-right font-mono text-slate-600 dark:text-slate-300">
                      {formatCurrency(entry.marketValue)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface RiskMetricCardProps {
  title: string;
  metrics: RiskSeriesMetrics;
  annualized: boolean;
}

function RiskMetricCard({ title, metrics, annualized }: RiskMetricCardProps) {
  const volatility = annualized ? metrics.volatilityAnnualized : metrics.volatility;
  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700/60 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">{title}</div>
        <div className="text-[11px] text-slate-400">{metrics.points} 点</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-slate-500">
            波动率{annualized ? "（年化）" : ""}
          </div>
          <div className="text-lg font-mono text-slate-800 dark:text-slate-100">
            {formatPctNullable(volatility)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">最大回撤</div>
          <div className="text-lg font-mono text-slate-800 dark:text-slate-100">
            {formatPctNullable(metrics.maxDrawdown)}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-400 mt-2">
        区间 {formatDateRange(metrics.startDate, metrics.endDate)}
      </div>
      {metrics.reason && (
        <div className="text-[11px] text-slate-400 mt-1">{metrics.reason}</div>
      )}
    </div>
  );
}
