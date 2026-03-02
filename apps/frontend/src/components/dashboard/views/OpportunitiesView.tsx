import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  FreeCompareSnapshot,
  FreeCompareWindowConfig,
  FreeCompareWorkspaceDraft,
  MultiCompareItem,
  MultiCompareResult,
  OpportunityDirection,
  OpportunityRankingProfile,
  OpportunityRankingResult,
  OpportunityRule,
  OpportunityRuleDirectionStrategy,
  OpportunityRuleRun,
  OpportunityRuleTemplate,
  OpportunitySignal,
  OpportunitySignalStatus,
  OpportunitySignalType,
  RunOpportunityRulesNowInput
} from "@mytrader/shared";

import type { OpportunitiesTab } from "../types";

interface OpportunitiesViewProps {
  Button: typeof import("../shared").Button;
  Panel: typeof import("../shared").Panel;
  formatDateTime: typeof import("../shared").formatDateTime;
  opportunitiesTab: OpportunitiesTab;
}

interface RuleEditorState {
  id: string | null;
  name: string;
  template: OpportunityRuleTemplate;
  directionStrategy: OpportunityRuleDirectionStrategy;
  priority: string;
  enabled: boolean;
  scoreFormula: string;
  paramsJson: string;
  includeHoldings: boolean;
  includeRegistryAutoIngest: boolean;
  includeWatchlist: boolean;
  explicitSymbols: string;
  tagFilters: string;
}

interface RankingEditorState {
  id: string | null;
  name: string;
  description: string;
  rangeDays: string;
  enabled: boolean;
  weightsJson: string;
  hardFiltersJson: string;
}

const SIGNAL_TYPE_OPTIONS: Array<{ value: OpportunitySignalType | "all"; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "opportunity", label: "机会" },
  { value: "risk", label: "风险" }
];

const DIRECTION_OPTIONS: Array<{ value: OpportunityDirection | "all"; label: string }> = [
  { value: "all", label: "全部方向" },
  { value: "long", label: "做多" },
  { value: "short_risk", label: "做空风险" }
];

const STATUS_OPTIONS: Array<{ value: OpportunitySignalStatus | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "活跃" },
  { value: "expired", label: "过期" },
  { value: "dismissed", label: "已忽略" }
];

const RULE_TEMPLATE_OPTIONS: Array<{ value: OpportunityRuleTemplate; label: string }> = [
  { value: "valuation_gap", label: "估值偏离" },
  { value: "momentum_breakout", label: "动量突破" },
  { value: "reversal_risk", label: "反转风险" },
  { value: "liquidity_anomaly", label: "流动性异常" }
];

const DIRECTION_STRATEGY_OPTIONS: Array<{
  value: OpportunityRuleDirectionStrategy;
  label: string;
}> = [
  { value: "both", label: "双向" },
  { value: "long", label: "仅做多" },
  { value: "short_risk", label: "仅风险" }
];

const FREE_WINDOW_LIMIT = 6;

function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return String(error ?? "未知错误");
}

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function formatPercent(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function parseJsonObject(raw: string, field: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${field} 必须为 JSON 对象。`);
  }
  return parsed as Record<string, unknown>;
}

function parseNumberRecord(raw: string, field: string): Record<string, number> {
  const object = parseJsonObject(raw, field);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(object)) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`${field} 中的 ${key} 必须是数字。`);
    }
    result[key] = n;
  }
  return result;
}

function parseSymbols(raw: string, maxCount?: number): string[] {
  const items = raw
    .split(/[\s,，;；\n]+/g)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  const deduped = Array.from(new Set(items));
  if (typeof maxCount === "number" && maxCount > 0) {
    return deduped.slice(0, maxCount);
  }
  return deduped;
}

function parseCsvTokens(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,，;；\n]+/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function buildDefaultRuleEditor(): RuleEditorState {
  return {
    id: null,
    name: "",
    template: "valuation_gap",
    directionStrategy: "both",
    priority: "100",
    enabled: true,
    scoreFormula: "clamp(baseScore, -200, 200)",
    paramsJson: "{\"targetPe\":15,\"minAbsGapPct\":0.1}",
    includeHoldings: true,
    includeRegistryAutoIngest: true,
    includeWatchlist: true,
    explicitSymbols: "",
    tagFilters: ""
  };
}

function buildDefaultRankingEditor(): RankingEditorState {
  return {
    id: null,
    name: "",
    description: "",
    rangeDays: "20",
    enabled: true,
    weightsJson: "{\"valuation\":0.35,\"momentum\":0.30,\"liquidity\":0.20,\"risk\":-0.15}",
    hardFiltersJson: "{}"
  };
}

function buildDefaultWindow(index: number): FreeCompareWindowConfig {
  return {
    id: `window-${index + 1}`,
    title: `窗口 ${index + 1}`,
    theme: null,
    symbols: [],
    baselineSymbol: null,
    ruleIds: [],
    asOfDate: null
  };
}

function buildDefaultDraft(): FreeCompareWorkspaceDraft {
  const windows = Array.from({ length: FREE_WINDOW_LIMIT }, (_unused, index) =>
    buildDefaultWindow(index)
  );
  return {
    windows,
    activeWindowId: windows[0]?.id ?? null,
    detailSymbol: null,
    updatedAt: Date.now()
  };
}

function normalizeDraft(draft: FreeCompareWorkspaceDraft): FreeCompareWorkspaceDraft {
  const windows = [...draft.windows].slice(0, FREE_WINDOW_LIMIT);
  while (windows.length < FREE_WINDOW_LIMIT) {
    windows.push(buildDefaultWindow(windows.length));
  }

  const activeWindowId =
    windows.some((item) => item.id === draft.activeWindowId) && draft.activeWindowId
      ? draft.activeWindowId
      : windows[0]?.id ?? null;

  return {
    windows,
    activeWindowId,
    detailSymbol: draft.detailSymbol ?? null,
    updatedAt: draft.updatedAt
  };
}

function getSignalTypeText(value: OpportunitySignalType): string {
  return value === "opportunity" ? "机会" : "风险";
}

function getDirectionText(value: OpportunityDirection): string {
  return value === "long" ? "做多" : "做空风险";
}

function getStatusText(value: OpportunitySignalStatus): string {
  if (value === "active") return "活跃";
  if (value === "expired") return "过期";
  return "已忽略";
}

function getRunTriggerText(value: OpportunityRuleRun["trigger"]): string {
  if (value === "data_update") return "数据更新";
  if (value === "schedule") return "定时兜底";
  return "手动";
}

function getScopeModeText(value: OpportunityRuleRun["scopeMode"]): string {
  return value === "full" ? "全量范围" : "降级范围";
}

export function OpportunitiesView(props: OpportunitiesViewProps) {
  const api = window.mytrader?.opportunities;
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [signalType, setSignalType] = useState<OpportunitySignalType | "all">("all");
  const [signalDirection, setSignalDirection] = useState<OpportunityDirection | "all">("all");
  const [signalStatus, setSignalStatus] = useState<OpportunitySignalStatus | "all">("active");
  const [signalRuleId, setSignalRuleId] = useState<string>("all");
  const [signalQuery, setSignalQuery] = useState("");
  const [signals, setSignals] = useState<OpportunitySignal[]>([]);
  const [signalTotal, setSignalTotal] = useState(0);

  const [rules, setRules] = useState<OpportunityRule[]>([]);
  const [ruleEditor, setRuleEditor] = useState<RuleEditorState>(() => buildDefaultRuleEditor());
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleRuns, setRuleRuns] = useState<OpportunityRuleRun[]>([]);

  const [rankingProfiles, setRankingProfiles] = useState<OpportunityRankingProfile[]>([]);
  const [rankingEditor, setRankingEditor] = useState<RankingEditorState>(() =>
    buildDefaultRankingEditor()
  );
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [rankingResult, setRankingResult] = useState<OpportunityRankingResult | null>(null);

  const [multiSymbolsInput, setMultiSymbolsInput] = useState("");
  const [multiBaselineInput, setMultiBaselineInput] = useState("");
  const [multiAsOfDate, setMultiAsOfDate] = useState("");
  const [multiResult, setMultiResult] = useState<MultiCompareResult | null>(null);

  const [freeInitialized, setFreeInitialized] = useState(false);
  const [freeDraft, setFreeDraft] = useState<FreeCompareWorkspaceDraft>(() => buildDefaultDraft());
  const [freeSnapshots, setFreeSnapshots] = useState<FreeCompareSnapshot[]>([]);
  const [freeSnapshotName, setFreeSnapshotName] = useState("");
  const [freeSnapshotDescription, setFreeSnapshotDescription] = useState("");
  const [freeRunningWindowId, setFreeRunningWindowId] = useState<string | null>(null);
  const [freeCompareByWindow, setFreeCompareByWindow] = useState<Record<string, MultiCompareResult>>(
    {}
  );
  const freeAutosaveReadyRef = useRef(false);

  const activeRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? null,
    [rules, selectedRuleId]
  );
  const activeRankingProfile = useMemo(
    () => rankingProfiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [rankingProfiles, selectedProfileId]
  );

  const activeFreeWindow = useMemo(() => {
    return (
      freeDraft.windows.find((item) => item.id === freeDraft.activeWindowId) ??
      freeDraft.windows[0] ??
      null
    );
  }, [freeDraft.activeWindowId, freeDraft.windows]);

  const resolvedDetailSymbol = useMemo(() => {
    if (freeDraft.detailSymbol) return freeDraft.detailSymbol;
    if (!activeFreeWindow) return null;
    const result = freeCompareByWindow[activeFreeWindow.id];
    return result?.items[0]?.symbol ?? activeFreeWindow.symbols[0] ?? null;
  }, [activeFreeWindow, freeCompareByWindow, freeDraft.detailSymbol]);

  const detailCompareItem = useMemo(() => {
    if (!resolvedDetailSymbol) return null;
    const activeResult = activeFreeWindow ? freeCompareByWindow[activeFreeWindow.id] : null;
    const fromActive =
      activeResult?.items.find((item) => item.symbol === resolvedDetailSymbol) ?? null;
    if (fromActive) return fromActive;
    for (const result of Object.values(freeCompareByWindow)) {
      const item = result.items.find((candidate) => candidate.symbol === resolvedDetailSymbol);
      if (item) return item;
    }
    return null;
  }, [activeFreeWindow, freeCompareByWindow, resolvedDetailSymbol]);

  const setToast = useCallback((kind: "notice" | "error", message: string) => {
    if (kind === "notice") {
      setNotice(message);
      setError(null);
      return;
    }
    setError(message);
    setNotice(null);
  }, []);

  const loadSignals = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const response = await api.listSignals({
        signalType,
        direction: signalDirection,
        status: signalStatus,
        ruleIds: signalRuleId === "all" ? null : [signalRuleId],
        query: signalQuery.trim() || null,
        limit: 100,
        offset: 0
      });
      setSignals(response.items);
      setSignalTotal(response.total);
    } catch (loadError) {
      setToast("error", toUserMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [api, signalDirection, signalQuery, signalRuleId, signalStatus, signalType, setToast]);

  const loadRules = useCallback(async () => {
    if (!api) return;
    try {
      const items = await api.listRules({ includeDisabled: true });
      setRules(items);
      if (items.length === 0) {
        setSelectedRuleId(null);
        return;
      }
      setSelectedRuleId((prev) => (prev && items.some((item) => item.id === prev) ? prev : items[0].id));
    } catch (loadError) {
      setToast("error", toUserMessage(loadError));
    }
  }, [api, setToast]);

  const loadRuleRuns = useCallback(
    async (ruleId: string | null) => {
      if (!api) return;
      if (!ruleId) {
        setRuleRuns([]);
        return;
      }
      try {
        const response = await api.listRuleRuns({ ruleId, limit: 50, offset: 0 });
        setRuleRuns(response.items);
      } catch (loadError) {
        setToast("error", toUserMessage(loadError));
      }
    },
    [api, setToast]
  );

  const loadRankingProfiles = useCallback(async () => {
    if (!api) return;
    try {
      const items = await api.listRankingProfiles({ includeDisabled: true });
      setRankingProfiles(items);
      if (items.length === 0) {
        setSelectedProfileId(null);
        return;
      }
      setSelectedProfileId((prev) =>
        prev && items.some((item) => item.id === prev) ? prev : items[0].id
      );
    } catch (loadError) {
      setToast("error", toUserMessage(loadError));
    }
  }, [api, setToast]);

  const loadLatestRanking = useCallback(async () => {
    if (!api || !selectedProfileId) return;
    try {
      const latest = await api.getLatestRanking({ profileId: selectedProfileId });
      setRankingResult(latest);
    } catch (loadError) {
      setToast("error", toUserMessage(loadError));
    }
  }, [api, selectedProfileId, setToast]);

  const loadFreeWorkspace = useCallback(async () => {
    if (!api) return;
    try {
      freeAutosaveReadyRef.current = false;
      const [draft, snapshots] = await Promise.all([
        api.getCompareDraft(),
        api.listCompareSnapshots()
      ]);
      setFreeDraft(normalizeDraft(draft));
      setFreeSnapshots(snapshots);
      setFreeInitialized(true);
      freeAutosaveReadyRef.current = true;
    } catch (loadError) {
      setToast("error", toUserMessage(loadError));
    }
  }, [api, setToast]);

  const saveFreeDraft = useCallback(
    async (draft: FreeCompareWorkspaceDraft, silent = false) => {
      if (!api) return;
      try {
        await api.saveCompareDraft({ draft });
        if (!silent) setToast("notice", "自由比对草稿已保存。");
      } catch (saveError) {
        setToast("error", toUserMessage(saveError));
      }
    },
    [api, setToast]
  );

  useEffect(() => {
    if (!api) return;
    void Promise.all([loadRules(), loadRankingProfiles()]);
  }, [api, loadRankingProfiles, loadRules]);

  useEffect(() => {
    if (props.opportunitiesTab !== "signals") return;
    if (!api) return;
    void loadSignals();
  }, [api, loadSignals, props.opportunitiesTab]);

  useEffect(() => {
    if (props.opportunitiesTab !== "rules") return;
    if (!selectedRuleId) {
      setRuleRuns([]);
      return;
    }
    void loadRuleRuns(selectedRuleId);
  }, [loadRuleRuns, props.opportunitiesTab, selectedRuleId]);

  useEffect(() => {
    if (!activeRule) return;
    setRuleEditor({
      id: activeRule.id,
      name: activeRule.name,
      template: activeRule.template,
      directionStrategy: activeRule.directionStrategy,
      priority: String(activeRule.priority),
      enabled: activeRule.enabled,
      scoreFormula: activeRule.scoreFormula ?? "",
      paramsJson: JSON.stringify(activeRule.params, null, 2),
      includeHoldings: activeRule.scopeConfig.includeHoldings,
      includeRegistryAutoIngest: activeRule.scopeConfig.includeRegistryAutoIngest,
      includeWatchlist: activeRule.scopeConfig.includeWatchlist,
      explicitSymbols: activeRule.scopeConfig.explicitSymbols.join(", "),
      tagFilters: activeRule.scopeConfig.tagFilters.join(", ")
    });
  }, [activeRule]);

  useEffect(() => {
    if (!activeRankingProfile) return;
    setRankingEditor({
      id: activeRankingProfile.id,
      name: activeRankingProfile.name,
      description: activeRankingProfile.description ?? "",
      rangeDays: String(activeRankingProfile.rangeDays),
      enabled: activeRankingProfile.enabled,
      weightsJson: JSON.stringify(activeRankingProfile.weights, null, 2),
      hardFiltersJson: JSON.stringify(activeRankingProfile.hardFilters, null, 2)
    });
  }, [activeRankingProfile]);

  useEffect(() => {
    if (props.opportunitiesTab !== "ranking") return;
    if (!selectedProfileId) return;
    void loadLatestRanking();
  }, [loadLatestRanking, props.opportunitiesTab, selectedProfileId]);

  useEffect(() => {
    if (props.opportunitiesTab !== "free-compare") return;
    if (freeInitialized) return;
    if (!api) return;
    void loadFreeWorkspace();
  }, [api, freeInitialized, loadFreeWorkspace, props.opportunitiesTab]);

  useEffect(() => {
    if (props.opportunitiesTab !== "free-compare") return;
    if (!freeInitialized) return;
    if (!freeAutosaveReadyRef.current) return;
    if (!api) return;
    const timer = window.setTimeout(() => {
      void saveFreeDraft(freeDraft, true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    api,
    freeDraft,
    freeInitialized,
    props.opportunitiesTab,
    saveFreeDraft
  ]);

  useEffect(() => {
    if (props.opportunitiesTab !== "free-compare") return;
    if (!freeInitialized) return;
    if (!api) return;
    const onBlur = () => {
      void saveFreeDraft(freeDraft, true);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [api, freeDraft, freeInitialized, props.opportunitiesTab, saveFreeDraft]);

  useEffect(() => {
    if (!notice && !error) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
      setError(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const handlePinSignal = useCallback(
    async (signalId: string, pinned: boolean) => {
      if (!api) return;
      try {
        await api.pinSignal({ signalId, pinned });
        await loadSignals();
      } catch (actionError) {
        setToast("error", toUserMessage(actionError));
      }
    },
    [api, loadSignals, setToast]
  );

  const handleDismissSignal = useCallback(
    async (signalId: string) => {
      if (!api) return;
      try {
        await api.dismissSignal({ signalId });
        await loadSignals();
      } catch (actionError) {
        setToast("error", toUserMessage(actionError));
      }
    },
    [api, loadSignals, setToast]
  );

  const handleRestoreSignal = useCallback(
    async (signalId: string) => {
      if (!api) return;
      try {
        await api.restoreSignal({ signalId });
        await loadSignals();
      } catch (actionError) {
        setToast("error", toUserMessage(actionError));
      }
    },
    [api, loadSignals, setToast]
  );

  const handleSaveRule = useCallback(async () => {
    if (!api) return;
    try {
      const params = parseJsonObject(ruleEditor.paramsJson, "规则参数");
      const priorityNum = Number(ruleEditor.priority);
      const payload = {
        name: ruleEditor.name.trim(),
        template: ruleEditor.template,
        directionStrategy: ruleEditor.directionStrategy,
        params,
        scoreFormula: ruleEditor.scoreFormula.trim() || null,
        enabled: ruleEditor.enabled,
        priority: Number.isFinite(priorityNum) ? Math.floor(priorityNum) : 100,
        scopeConfig: {
          includeHoldings: ruleEditor.includeHoldings,
          includeRegistryAutoIngest: ruleEditor.includeRegistryAutoIngest,
          includeWatchlist: ruleEditor.includeWatchlist,
          portfolioIds: null,
          explicitSymbols: parseSymbols(ruleEditor.explicitSymbols),
          tagFilters: parseCsvTokens(ruleEditor.tagFilters)
        }
      };
      if (ruleEditor.id) {
        const updated = await api.updateRule({
          id: ruleEditor.id,
          ...payload
        });
        setSelectedRuleId(updated.id);
        setToast("notice", "规则已更新。");
      } else {
        const created = await api.createRule(payload);
        setSelectedRuleId(created.id);
        setToast("notice", "规则已创建。");
      }
      await loadRules();
      await loadSignals();
    } catch (saveError) {
      setToast("error", toUserMessage(saveError));
    }
  }, [api, loadRules, loadSignals, ruleEditor, setToast]);

  const handleDeleteRule = useCallback(async () => {
    if (!api || !activeRule) return;
    if (!window.confirm(`确认删除规则「${activeRule.name}」？`)) return;
    try {
      await api.deleteRule({ id: activeRule.id });
      setRuleEditor(buildDefaultRuleEditor());
      setSelectedRuleId(null);
      await loadRules();
      await loadSignals();
      setToast("notice", "规则已删除。");
    } catch (deleteError) {
      setToast("error", toUserMessage(deleteError));
    }
  }, [activeRule, api, loadRules, loadSignals, setToast]);

  const handleToggleRule = useCallback(
    async (rule: OpportunityRule) => {
      if (!api) return;
      try {
        await api.toggleRule({ id: rule.id, enabled: !rule.enabled });
        await loadRules();
        await loadSignals();
      } catch (toggleError) {
        setToast("error", toUserMessage(toggleError));
      }
    },
    [api, loadRules, loadSignals, setToast]
  );

  const handleRunRulesNow = useCallback(
    async (input?: RunOpportunityRulesNowInput) => {
      if (!api) return;
      setLoading(true);
      try {
        await api.runRulesNow(input);
        await Promise.all([loadRuleRuns(selectedRuleId), loadSignals()]);
        setToast("notice", "规则已触发运行。");
      } catch (runError) {
        setToast("error", toUserMessage(runError));
      } finally {
        setLoading(false);
      }
    },
    [api, loadRuleRuns, loadSignals, selectedRuleId, setToast]
  );

  const handleSaveRankingProfile = useCallback(async () => {
    if (!api) return;
    try {
      const weights = parseNumberRecord(rankingEditor.weightsJson, "权重");
      const hardFilters = parseJsonObject(rankingEditor.hardFiltersJson, "硬过滤");
      const rangeDays = Number(rankingEditor.rangeDays);
      const payload = {
        id: rankingEditor.id,
        name: rankingEditor.name.trim(),
        description: rankingEditor.description.trim() || null,
        weights,
        hardFilters,
        rangeDays: Number.isFinite(rangeDays) ? Math.max(5, Math.floor(rangeDays)) : 20,
        enabled: rankingEditor.enabled
      };
      const saved = await api.upsertRankingProfile(payload);
      setSelectedProfileId(saved.id);
      setToast("notice", "排序配置已保存。");
      await loadRankingProfiles();
    } catch (saveError) {
      setToast("error", toUserMessage(saveError));
    }
  }, [api, loadRankingProfiles, rankingEditor, setToast]);

  const handleRunRanking = useCallback(async () => {
    if (!api || !selectedProfileId) return;
    setLoading(true);
    try {
      const result = await api.runRanking({ profileId: selectedProfileId });
      setRankingResult(result);
      setToast("notice", "排序运行完成。");
      await loadRankingProfiles();
    } catch (runError) {
      setToast("error", toUserMessage(runError));
    } finally {
      setLoading(false);
    }
  }, [api, loadRankingProfiles, selectedProfileId, setToast]);

  const handleRunMultiCompare = useCallback(async () => {
    if (!api) return;
    const symbols = parseSymbols(multiSymbolsInput, 5);
    if (symbols.length === 0) {
      setToast("error", "请至少输入 1 个标的。");
      return;
    }
    setLoading(true);
    try {
      const result = await api.runMultiCompare({
        symbols,
        baselineSymbol: multiBaselineInput.trim() || null,
        asOfDate: multiAsOfDate.trim() || null
      });
      setMultiResult(result);
    } catch (runError) {
      setToast("error", toUserMessage(runError));
    } finally {
      setLoading(false);
    }
  }, [api, multiAsOfDate, multiBaselineInput, multiSymbolsInput, setToast]);

  const updateFreeWindow = useCallback(
    (windowId: string, updater: (window: FreeCompareWindowConfig) => FreeCompareWindowConfig) => {
      setFreeDraft((prev) => {
        const nextWindows = prev.windows.map((item) =>
          item.id === windowId ? updater(item) : item
        );
        return {
          ...prev,
          windows: nextWindows,
          updatedAt: Date.now()
        };
      });
    },
    []
  );

  const handleRunFreeWindowCompare = useCallback(
    async (windowId: string) => {
      if (!api) return;
      const targetWindow = freeDraft.windows.find((item) => item.id === windowId);
      if (!targetWindow) return;
      if (targetWindow.symbols.length === 0) {
        setToast("error", "窗口标的池为空，无法运行比对。");
        return;
      }

      setFreeRunningWindowId(windowId);
      try {
        const result = await api.runMultiCompare({
          symbols: targetWindow.symbols.slice(0, 5),
          baselineSymbol: targetWindow.baselineSymbol,
          asOfDate: targetWindow.asOfDate
        });
        setFreeCompareByWindow((prev) => ({ ...prev, [windowId]: result }));
        setFreeDraft((prev) => ({
          ...prev,
          activeWindowId: windowId,
          detailSymbol: prev.detailSymbol ?? result.items[0]?.symbol ?? null,
          updatedAt: Date.now()
        }));
      } catch (runError) {
        setToast("error", toUserMessage(runError));
      } finally {
        setFreeRunningWindowId(null);
      }
    },
    [api, freeDraft.windows, setToast]
  );

  const handleSaveSnapshot = useCallback(async () => {
    if (!api) return;
    const name = freeSnapshotName.trim();
    if (!name) {
      setToast("error", "请填写快照名称。");
      return;
    }
    try {
      await api.saveCompareSnapshot({
        name,
        description: freeSnapshotDescription.trim() || null,
        draft: freeDraft
      });
      setFreeSnapshotName("");
      setFreeSnapshotDescription("");
      setFreeSnapshots(await api.listCompareSnapshots());
      setToast("notice", "自由比对快照已保存。");
    } catch (saveError) {
      setToast("error", toUserMessage(saveError));
    }
  }, [api, freeDraft, freeSnapshotDescription, freeSnapshotName, setToast]);

  const handleLoadSnapshot = useCallback(
    async (snapshot: FreeCompareSnapshot) => {
      if (!api) return;
      try {
        freeAutosaveReadyRef.current = false;
        const loaded = await api.loadCompareSnapshot({ id: snapshot.id });
        setFreeDraft(normalizeDraft(loaded.draft));
        setFreeSnapshots(await api.listCompareSnapshots());
        freeAutosaveReadyRef.current = true;
        setToast("notice", `已加载快照：${snapshot.name}`);
      } catch (loadError) {
        setToast("error", toUserMessage(loadError));
      }
    },
    [api, setToast]
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshot: FreeCompareSnapshot) => {
      if (!api) return;
      if (!window.confirm(`确认删除快照「${snapshot.name}」？`)) return;
      try {
        await api.deleteCompareSnapshot({ id: snapshot.id });
        setFreeSnapshots(await api.listCompareSnapshots());
      } catch (removeError) {
        setToast("error", toUserMessage(removeError));
      }
    },
    [api, setToast]
  );

  const renderSignalRows = (items: OpportunitySignal[]) => {
    if (items.length === 0) {
      return (
        <tr>
          <td className="px-3 py-4 text-sm text-slate-500" colSpan={10}>
            当前筛选条件下暂无信号。
          </td>
        </tr>
      );
    }

    return items.map((signal) => (
      <tr key={signal.id} className="border-t border-slate-200/70">
        <td className="px-3 py-2 text-sm font-medium text-slate-900">{signal.symbol}</td>
        <td className="px-3 py-2 text-sm">
          <span
            className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
              signal.signalType === "opportunity"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {getSignalTypeText(signal.signalType)}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-slate-700">{getDirectionText(signal.direction)}</td>
        <td className="px-3 py-2 text-sm font-mono text-slate-900">{formatNumber(signal.score)}</td>
        <td className="px-3 py-2 text-sm font-mono text-slate-700">
          {signal.confidence === null ? "--" : `${(signal.confidence * 100).toFixed(0)}%`}
        </td>
        <td className="px-3 py-2 text-sm text-slate-700">{signal.ruleName}</td>
        <td className="px-3 py-2 text-sm text-slate-700">
          {(signal.reasons[0] ?? "--").slice(0, 28)}
        </td>
        <td className="px-3 py-2 text-xs text-slate-600">{signal.asOfDate}</td>
        <td className="px-3 py-2 text-xs text-slate-600">{getStatusText(signal.status)}</td>
        <td className="px-3 py-2 text-xs text-slate-600">
          <div className="flex flex-wrap gap-1">
            <props.Button size="sm" onClick={() => handlePinSignal(signal.id, !signal.pinned)}>
              {signal.pinned ? "取消置顶" : "置顶"}
            </props.Button>
            {signal.status === "dismissed" ? (
              <props.Button size="sm" onClick={() => handleRestoreSignal(signal.id)}>
                恢复
              </props.Button>
            ) : (
              <props.Button size="sm" onClick={() => handleDismissSignal(signal.id)}>
                忽略
              </props.Button>
            )}
          </div>
        </td>
      </tr>
    ));
  };

  const renderMultiResultRows = (items: MultiCompareItem[]) => {
    return items.map((item) => (
      <tr key={item.symbol} className="border-t border-slate-200/70">
        <td className="px-3 py-2 text-sm font-medium text-slate-900">{item.symbol}</td>
        <td className="px-3 py-2 text-sm font-mono">{formatNumber(item.close)}</td>
        <td className="px-3 py-2 text-sm font-mono">{formatNumber(item.peTtm)}</td>
        <td className="px-3 py-2 text-sm font-mono">{formatPercent(item.return20d)}</td>
        <td className="px-3 py-2 text-sm font-mono">
          {formatPercent(item.relative.return20dVsBaseline)}
        </td>
        <td className="px-3 py-2 text-sm font-mono">
          {formatNumber(item.relative.peTtmVsBaseline)}
        </td>
        <td className="px-3 py-2 text-sm font-mono">
          {formatNumber(item.relative.turnoverRateVsBaseline)}
        </td>
      </tr>
    ));
  };

  return (
    <props.Panel>
      <div className="space-y-4">
        {(notice || error) && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? notice}
          </div>
        )}

        {props.opportunitiesTab === "signals" && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-6">
              <label className="text-sm text-slate-700">
                类型
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={signalType}
                  onChange={(event) =>
                    setSignalType(event.target.value as OpportunitySignalType | "all")
                  }
                >
                  {SIGNAL_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                方向
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={signalDirection}
                  onChange={(event) =>
                    setSignalDirection(event.target.value as OpportunityDirection | "all")
                  }
                >
                  {DIRECTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                状态
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={signalStatus}
                  onChange={(event) =>
                    setSignalStatus(event.target.value as OpportunitySignalStatus | "all")
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                规则
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={signalRuleId}
                  onChange={(event) => setSignalRuleId(event.target.value)}
                >
                  <option value="all">全部规则</option>
                  {rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                搜索标的
                <div className="mt-1 flex gap-2">
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={signalQuery}
                    onChange={(event) => setSignalQuery(event.target.value)}
                    placeholder="输入代码，如 600519.SH"
                  />
                  <props.Button size="sm" onClick={() => void loadSignals()}>
                    刷新
                  </props.Button>
                </div>
              </label>
            </div>

            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">标的</th>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">方向</th>
                    <th className="px-3 py-2">总分</th>
                    <th className="px-3 py-2">置信度</th>
                    <th className="px-3 py-2">规则</th>
                    <th className="px-3 py-2">触发原因</th>
                    <th className="px-3 py-2">as-of</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>{renderSignalRows(signals)}</tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500">
              共 {signalTotal} 条，排序规则：置顶优先 → 总分降序 → 新鲜度降序。
            </div>
          </div>
        )}

        {props.opportunitiesTab === "rules" && (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">规则列表</h3>
                <div className="flex gap-2">
                  <props.Button
                    size="sm"
                    onClick={() => {
                      setSelectedRuleId(null);
                      setRuleEditor(buildDefaultRuleEditor());
                    }}
                  >
                    新建
                  </props.Button>
                  <props.Button size="sm" onClick={() => void handleRunRulesNow({ trigger: "manual" })}>
                    全量试跑
                  </props.Button>
                </div>
              </div>

              <div className="rounded border border-slate-200">
                {rules.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    className={`w-full border-b border-slate-200 px-3 py-2 text-left text-sm last:border-b-0 ${
                      selectedRuleId === rule.id ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedRuleId(rule.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{rule.name}</span>
                      <span className="text-xs text-slate-500">P{rule.priority}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>{rule.template}</span>
                      <span>{rule.directionStrategy}</span>
                      <span>{rule.enabled ? "启用" : "停用"}</span>
                      <props.Button size="sm" onClick={(event) => {
                        event.stopPropagation();
                        void handleToggleRule(rule);
                      }}>
                        {rule.enabled ? "停用" : "启用"}
                      </props.Button>
                    </div>
                  </button>
                ))}
                {rules.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-500">暂无规则。</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {ruleEditor.id ? "编辑规则" : "创建规则"}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700 md:col-span-2">
                  名称
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={ruleEditor.name}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  模板
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={ruleEditor.template}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({
                        ...prev,
                        template: event.target.value as OpportunityRuleTemplate
                      }))
                    }
                  >
                    {RULE_TEMPLATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  方向策略
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={ruleEditor.directionStrategy}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({
                        ...prev,
                        directionStrategy: event.target.value as OpportunityRuleDirectionStrategy
                      }))
                    }
                  >
                    {DIRECTION_STRATEGY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  优先级
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={ruleEditor.priority}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, priority: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  启用
                  <input
                    className="ml-2 align-middle"
                    type="checkbox"
                    checked={ruleEditor.enabled}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, enabled: event.target.checked }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  评分公式
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                    value={ruleEditor.scoreFormula}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, scoreFormula: event.target.value }))
                    }
                    placeholder="clamp(baseScore, -200, 200)"
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  参数 JSON
                  <textarea
                    className="mt-1 h-24 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                    value={ruleEditor.paramsJson}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, paramsJson: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={ruleEditor.includeHoldings}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({
                        ...prev,
                        includeHoldings: event.target.checked
                      }))
                    }
                  />
                  持仓
                </label>
                <label className="text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={ruleEditor.includeWatchlist}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({
                        ...prev,
                        includeWatchlist: event.target.checked
                      }))
                    }
                  />
                  自选
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    className="mr-2 align-middle"
                    checked={ruleEditor.includeRegistryAutoIngest}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({
                        ...prev,
                        includeRegistryAutoIngest: event.target.checked
                      }))
                    }
                  />
                  Targets 全开（注册表自动抓取）
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  显式标的（逗号分隔）
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={ruleEditor.explicitSymbols}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, explicitSymbols: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  标签过滤（逗号分隔）
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={ruleEditor.tagFilters}
                    onChange={(event) =>
                      setRuleEditor((prev) => ({ ...prev, tagFilters: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <props.Button size="sm" onClick={() => void handleSaveRule()}>
                  保存规则
                </props.Button>
                {activeRule && (
                  <props.Button size="sm" onClick={() => void handleRunRulesNow({
                    ruleIds: [activeRule.id],
                    trigger: "manual"
                  })}>
                    手动试跑
                  </props.Button>
                )}
                {activeRule && (
                  <props.Button size="sm" variant="danger" onClick={() => void handleDeleteRule()}>
                    删除规则
                  </props.Button>
                )}
              </div>

              <div className="rounded border border-slate-200">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
                  运行日志
                </div>
                <div className="max-h-56 overflow-auto">
                  {ruleRuns.map((run) => (
                    <div key={run.id} className="border-b border-slate-100 px-3 py-2 text-xs">
                      <div className="font-medium text-slate-700">
                        {run.asOfDate} · {getRunTriggerText(run.trigger)} · {getScopeModeText(run.scopeMode)}
                      </div>
                      <div className="mt-1 text-slate-500">
                        扫描 {run.scannedCount} / 输出 {run.generatedCount} · {props.formatDateTime(run.startedAt)}
                      </div>
                      {run.degradedReason && (
                        <div className="mt-1 text-amber-700">降级：{run.degradedReason}</div>
                      )}
                      {run.errorSummary && (
                        <div className="mt-1 text-rose-700">错误：{run.errorSummary}</div>
                      )}
                    </div>
                  ))}
                  {ruleRuns.length === 0 && (
                    <div className="px-3 py-4 text-sm text-slate-500">暂无运行记录。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {props.opportunitiesTab === "ranking" && (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">排序配置</h3>
                <props.Button
                  size="sm"
                  onClick={() => {
                    setSelectedProfileId(null);
                    setRankingEditor(buildDefaultRankingEditor());
                  }}
                >
                  新建配置
                </props.Button>
              </div>
              <div className="rounded border border-slate-200">
                {rankingProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`w-full border-b border-slate-200 px-3 py-2 text-left last:border-b-0 ${
                      selectedProfileId === profile.id ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedProfileId(profile.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900">{profile.name}</span>
                      <span className="text-xs text-slate-500">{profile.enabled ? "启用" : "停用"}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      周期 {profile.rangeDays}d · {profile.description ?? "无说明"}
                    </div>
                  </button>
                ))}
                {rankingProfiles.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-500">暂无排序配置。</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {rankingEditor.id ? "编辑配置" : "创建配置"}
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700 md:col-span-2">
                  名称
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={rankingEditor.name}
                    onChange={(event) =>
                      setRankingEditor((prev) => ({ ...prev, name: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  说明
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={rankingEditor.description}
                    onChange={(event) =>
                      setRankingEditor((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  周期（日）
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={rankingEditor.rangeDays}
                    onChange={(event) =>
                      setRankingEditor((prev) => ({ ...prev, rangeDays: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700">
                  启用
                  <input
                    className="ml-2 align-middle"
                    type="checkbox"
                    checked={rankingEditor.enabled}
                    onChange={(event) =>
                      setRankingEditor((prev) => ({ ...prev, enabled: event.target.checked }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  权重 JSON
                  <textarea
                    className="mt-1 h-24 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                    value={rankingEditor.weightsJson}
                    onChange={(event) =>
                      setRankingEditor((prev) => ({ ...prev, weightsJson: event.target.value }))
                    }
                  />
                </label>
                <label className="text-sm text-slate-700 md:col-span-2">
                  硬过滤 JSON
                  <textarea
                    className="mt-1 h-20 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                    value={rankingEditor.hardFiltersJson}
                    onChange={(event) =>
                      setRankingEditor((prev) => ({ ...prev, hardFiltersJson: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <props.Button size="sm" onClick={() => void handleSaveRankingProfile()}>
                  保存配置
                </props.Button>
                <props.Button size="sm" onClick={() => void handleRunRanking()}>
                  运行排序
                </props.Button>
                <props.Button size="sm" onClick={() => void loadLatestRanking()}>
                  读取最新结果
                </props.Button>
              </div>
            </div>
          </div>
        )}

        {props.opportunitiesTab === "ranking" && (
          <div className="rounded border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-900">排序结果（总分 + 因子拆解）</span>
              <span className="text-xs text-slate-500">
                {rankingResult ? `${rankingResult.asOfDate} · ${rankingResult.items.length} 个标的` : "--"}
              </span>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">排名</th>
                    <th className="px-3 py-2">标的</th>
                    <th className="px-3 py-2">总分</th>
                    <th className="px-3 py-2">估值</th>
                    <th className="px-3 py-2">动量</th>
                    <th className="px-3 py-2">流动性</th>
                    <th className="px-3 py-2">风险</th>
                    <th className="px-3 py-2">排名变化</th>
                  </tr>
                </thead>
                <tbody>
                  {(rankingResult?.items ?? []).map((item) => (
                    <tr key={item.symbol} className="border-t border-slate-200/70">
                      <td className="px-3 py-2 text-sm font-medium">{item.currentRank}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">{item.symbol}</td>
                      <td className="px-3 py-2 text-sm font-mono">{formatNumber(item.totalScore)}</td>
                      <td className="px-3 py-2 text-sm font-mono">
                        {formatNumber(item.factorScores.valuation ?? null)}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono">
                        {formatNumber(item.factorScores.momentum ?? null)}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono">
                        {formatNumber(item.factorScores.liquidity ?? null)}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono">
                        {formatNumber(item.factorScores.risk ?? null)}
                      </td>
                      <td className="px-3 py-2 text-sm font-mono">
                        {item.previousRank === null
                          ? "new"
                          : `${item.previousRank - item.currentRank >= 0 ? "↑" : "↓"}${Math.abs(
                              item.previousRank - item.currentRank
                            )}`}
                      </td>
                    </tr>
                  ))}
                  {!rankingResult && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-slate-500" colSpan={8}>
                        暂无排序结果。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {props.opportunitiesTab === "multi-compare" && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-700 md:col-span-2">
                标的（最多 5 个，逗号或换行分隔）
                <textarea
                  className="mt-1 h-20 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  value={multiSymbolsInput}
                  onChange={(event) => setMultiSymbolsInput(event.target.value)}
                  placeholder="600519.SH, 000858.SZ, 510300.SH"
                />
              </label>
              <div className="space-y-3">
                <label className="block text-sm text-slate-700">
                  基线（可空）
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={multiBaselineInput}
                    onChange={(event) => setMultiBaselineInput(event.target.value.toUpperCase())}
                    placeholder="为空时自动取首标的"
                  />
                </label>
                <label className="block text-sm text-slate-700">
                  as-of 日期（可空）
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    type="date"
                    value={multiAsOfDate}
                    onChange={(event) => setMultiAsOfDate(event.target.value)}
                  />
                </label>
                <props.Button onClick={() => void handleRunMultiCompare()} disabled={loading}>
                  运行比对
                </props.Button>
              </div>
            </div>

            <div className="rounded border border-slate-200">
              <div className="border-b border-slate-200 px-3 py-2 text-sm text-slate-700">
                基线：
                <span className="ml-1 font-semibold text-slate-900">
                  {multiResult?.baselineSymbol ?? "--"}
                </span>
                {multiResult?.baselineAutoSelected && (
                  <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                    临时基线
                  </span>
                )}
              </div>
              <table className="min-w-full">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">标的</th>
                    <th className="px-3 py-2">收盘</th>
                    <th className="px-3 py-2">PE(TTM)</th>
                    <th className="px-3 py-2">20日涨跌</th>
                    <th className="px-3 py-2">相对基线涨跌</th>
                    <th className="px-3 py-2">估值差</th>
                    <th className="px-3 py-2">流动性差</th>
                  </tr>
                </thead>
                <tbody>
                  {multiResult ? (
                    renderMultiResultRows(multiResult.items)
                  ) : (
                    <tr>
                      <td className="px-3 py-4 text-sm text-slate-500" colSpan={7}>
                        尚未运行多标的比对。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {props.opportunitiesTab === "free-compare" && (
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded border border-slate-200 p-3">
                <label className="min-w-56 flex-1 text-sm text-slate-700">
                  快照名称
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={freeSnapshotName}
                    onChange={(event) => setFreeSnapshotName(event.target.value)}
                    placeholder="例如：周度动量对比"
                  />
                </label>
                <label className="min-w-64 flex-[1.2] text-sm text-slate-700">
                  快照说明
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={freeSnapshotDescription}
                    onChange={(event) => setFreeSnapshotDescription(event.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <props.Button size="sm" onClick={() => void saveFreeDraft(freeDraft, false)}>
                    保存草稿
                  </props.Button>
                  <props.Button size="sm" onClick={() => void handleSaveSnapshot()}>
                    命名快照
                  </props.Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {freeDraft.windows.map((windowConfig) => {
                  const isActive = windowConfig.id === freeDraft.activeWindowId;
                  const result = freeCompareByWindow[windowConfig.id];
                  return (
                    <div
                      key={windowConfig.id}
                      className={`rounded border p-3 ${
                        isActive ? "border-slate-500 bg-slate-50" : "border-slate-200 bg-white"
                      }`}
                      onClick={() =>
                        setFreeDraft((prev) => ({
                          ...prev,
                          activeWindowId: windowConfig.id,
                          updatedAt: Date.now()
                        }))
                      }
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <input
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-medium"
                          value={windowConfig.title}
                          onChange={(event) =>
                            updateFreeWindow(windowConfig.id, (current) => ({
                              ...current,
                              title: event.target.value
                            }))
                          }
                        />
                        <span className="ml-2 text-xs text-slate-500">
                          {isActive ? "激活" : windowConfig.id}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="text-xs text-slate-600">
                          主题
                          <input
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={windowConfig.theme ?? ""}
                            onChange={(event) =>
                              updateFreeWindow(windowConfig.id, (current) => ({
                                ...current,
                                theme: event.target.value.trim() || null
                              }))
                            }
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          基线
                          <input
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={windowConfig.baselineSymbol ?? ""}
                            onChange={(event) =>
                              updateFreeWindow(windowConfig.id, (current) => ({
                                ...current,
                                baselineSymbol: event.target.value.trim().toUpperCase() || null
                              }))
                            }
                            placeholder="为空自动临时基线"
                          />
                        </label>
                        <label className="text-xs text-slate-600 md:col-span-2">
                          标的池（最多 5）
                          <textarea
                            className="mt-1 h-14 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={windowConfig.symbols.join(", ")}
                            onChange={(event) =>
                              updateFreeWindow(windowConfig.id, (current) => ({
                                ...current,
                                symbols: parseSymbols(event.target.value, 5)
                              }))
                            }
                          />
                        </label>
                        <label className="text-xs text-slate-600 md:col-span-2">
                          规则集（ruleId 逗号分隔）
                          <input
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            value={windowConfig.ruleIds.join(", ")}
                            onChange={(event) =>
                              updateFreeWindow(windowConfig.id, (current) => ({
                                ...current,
                                ruleIds: parseCsvTokens(event.target.value)
                              }))
                            }
                          />
                        </label>
                        <label className="text-xs text-slate-600">
                          时间窗 as-of
                          <input
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            type="date"
                            value={windowConfig.asOfDate ?? ""}
                            onChange={(event) =>
                              updateFreeWindow(windowConfig.id, (current) => ({
                                ...current,
                                asOfDate: event.target.value || null
                              }))
                            }
                          />
                        </label>
                        <div className="flex items-end">
                          <props.Button
                            size="sm"
                            onClick={() => void handleRunFreeWindowCompare(windowConfig.id)}
                            disabled={freeRunningWindowId === windowConfig.id}
                          >
                            {freeRunningWindowId === windowConfig.id ? "运行中..." : "运行"}
                          </props.Button>
                        </div>
                      </div>

                      {result && (
                        <div className="mt-2 rounded border border-slate-200 bg-white p-2">
                          <div className="mb-1 text-xs text-slate-600">
                            {result.asOfDate} · 基线 {result.baselineSymbol}
                            {result.baselineAutoSelected ? "（临时）" : ""}
                          </div>
                          <div className="space-y-1">
                            {result.items.slice(0, 3).map((item) => (
                              <button
                                key={item.symbol}
                                type="button"
                                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-50"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setFreeDraft((prev) => ({
                                    ...prev,
                                    activeWindowId: windowConfig.id,
                                    detailSymbol: item.symbol,
                                    updatedAt: Date.now()
                                  }));
                                }}
                              >
                                <span className="font-medium text-slate-800">{item.symbol}</span>
                                <span className="font-mono text-slate-500">
                                  {formatPercent(item.return20d)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded border border-slate-200 bg-white p-3">
                <h3 className="text-sm font-semibold text-slate-900">详情窗口</h3>
                <div className="mt-2 text-xs text-slate-600">
                  当前标的：
                  <span className="ml-1 font-semibold text-slate-900">{resolvedDetailSymbol ?? "--"}</span>
                </div>
                {detailCompareItem ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <div className="text-slate-500">收盘</div>
                      <div className="font-mono text-slate-900">{formatNumber(detailCompareItem.close)}</div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <div className="text-slate-500">PE(TTM)</div>
                      <div className="font-mono text-slate-900">{formatNumber(detailCompareItem.peTtm)}</div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <div className="text-slate-500">20日涨跌</div>
                      <div className="font-mono text-slate-900">
                        {formatPercent(detailCompareItem.return20d)}
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <div className="text-slate-500">相对基线涨跌</div>
                      <div className="font-mono text-slate-900">
                        {formatPercent(detailCompareItem.relative.return20dVsBaseline)}
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <div className="text-slate-500">估值差</div>
                      <div className="font-mono text-slate-900">
                        {formatNumber(detailCompareItem.relative.peTtmVsBaseline)}
                      </div>
                    </div>
                    <div className="rounded bg-slate-50 px-2 py-1">
                      <div className="text-slate-500">流动性差</div>
                      <div className="font-mono text-slate-900">
                        {formatNumber(detailCompareItem.relative.turnoverRateVsBaseline)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">
                    尚无详情数据。可先在任一窗口运行比对并点击标的。
                  </div>
                )}
              </div>

              <div className="rounded border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
                  命名快照（上限 50）
                </div>
                <div className="max-h-72 overflow-auto">
                  {freeSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="border-b border-slate-100 px-3 py-2 text-xs last:border-b-0"
                    >
                      <div className="font-medium text-slate-900">{snapshot.name}</div>
                      <div className="mt-1 text-slate-500">
                        {snapshot.description ?? "无说明"} · {props.formatDateTime(snapshot.updatedAt)}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <props.Button size="sm" onClick={() => void handleLoadSnapshot(snapshot)}>
                          加载
                        </props.Button>
                        <props.Button
                          size="sm"
                          variant="danger"
                          onClick={() => void handleDeleteSnapshot(snapshot)}
                        >
                          删除
                        </props.Button>
                      </div>
                    </div>
                  ))}
                  {freeSnapshots.length === 0 && (
                    <div className="px-3 py-4 text-sm text-slate-500">暂无快照。</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-xs text-slate-500">正在加载机会模块数据...</div>
        )}
      </div>
    </props.Panel>
  );
}
