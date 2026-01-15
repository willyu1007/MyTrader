import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AccountSummary,
  AssetClass,
  CreatePositionInput,
  CreateRiskLimitInput,
  DataQualityLevel,
  MarketDataQuality,
  PerformanceMethod,
  PerformanceRangeKey,
  Portfolio,
  PortfolioPerformanceRangeResult,
  PortfolioPerformanceSeries,
  PortfolioSnapshot,
  PositionValuation,
  RiskLimit,
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

  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioBaseCurrency, setPortfolioBaseCurrency] = useState("CNY");
  const [portfolioRename, setPortfolioRename] = useState("");

  const [positionForm, setPositionForm] = useState<PositionFormState>(
    emptyPositionForm
  );
  const [riskForm, setRiskForm] = useState<RiskFormState>(emptyRiskForm);

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
  const dataQuality = snapshot?.dataQuality ?? null;

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
        setError("未检测到桌面端后端（preload API）。");
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
      setError("未检测到桌面端后端（preload API）。");
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

  const loadPerformance = useCallback(
    async (portfolioId: string, range: PerformanceRangeKey) => {
      if (!window.mytrader) {
        setPerformanceError("未检测到桌面端后端（preload API）。");
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
    if (portfolioTab !== "performance") return;
    loadPerformance(activePortfolioId, performanceRange).catch((err) =>
      setPerformanceError(toUserErrorMessage(err))
    );
  }, [activePortfolioId, loadPerformance, performanceRange, portfolioTab]);

  useEffect(() => {
    if (!activePortfolio) return;
    setPortfolioRename(activePortfolio.name);
  }, [activePortfolio]);

  useEffect(() => {
    if (activeView === "portfolio") {
      setPortfolioTab("overview");
    }
  }, [activeView]);

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
    setNotice(`Tushare 拉取：新增 ${result.inserted} 条。`);
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
              {activeView === "portfolio" && (
                 <Button variant="secondary" size="sm" onClick={() => loadPortfolios(activePortfolioId)} icon="refresh">刷新</Button>
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

              {["trades", "risk", "allocation", "corporate"].includes(portfolioTab) && (
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

        {/* Global Notifications */}
        {(error || notice) && (
           <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
              <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
                 error 
                 ? "bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800 text-red-800 dark:text-red-100" 
                 : "bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-100"
              }`}>
                 <span className="material-icons-outlined">{error ? "error" : "check_circle"}</span>
                 <span className="text-sm font-medium">{error ?? notice}</span>
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

function FormGroup({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
function Input({ className, ...props }: InputProps) {
  return (
    <input 
      className={`block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-1.5 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm sm:leading-6 placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-800 ${className}`}
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

  return (
    <button 
      className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className={`material-icons-outlined ${size === 'sm' ? 'text-sm mr-1.5' : 'text-base mr-2'}`}>{icon}</span>}
      {children}
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

function formatAssetClassLabel(value: string): string {
  if (value in assetClassLabels) {
    return assetClassLabels[value as AssetClass];
  }
  return value;
}

function formatRiskLimitTypeLabel(value: RiskLimitType): string {
  return riskLimitTypeLabels[value] ?? value;
}

function formatDateTime(value: number | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN");
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
