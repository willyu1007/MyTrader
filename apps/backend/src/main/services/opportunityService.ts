import crypto from "node:crypto";

import type {
  CreateOpportunityRuleInput,
  DeleteFreeCompareSnapshotInput,
  DeleteOpportunityRuleInput,
  DismissOpportunitySignalInput,
  FreeCompareSnapshot,
  FreeCompareWindowConfig,
  FreeCompareWorkspaceDraft,
  GetLatestOpportunityRankingInput,
  ListOpportunityRankingProfilesInput,
  ListOpportunityRuleRunsInput,
  ListOpportunityRuleRunsResult,
  ListOpportunityRulesInput,
  ListOpportunitySignalsInput,
  ListOpportunitySignalsResult,
  LoadFreeCompareSnapshotInput,
  MultiCompareItem,
  MultiCompareResult,
  OpportunityDirection,
  OpportunityRankingItem,
  OpportunityRankingProfile,
  OpportunityRankingResult,
  OpportunityRule,
  OpportunityRuleDirectionStrategy,
  OpportunityRuleRun,
  OpportunityRuleTemplate,
  OpportunityRunScopeMode,
  OpportunityRunTrigger,
  OpportunityScopeConfig,
  OpportunitySignal,
  OpportunitySignalStatus,
  OpportunitySignalType,
  PinOpportunitySignalInput,
  RestoreOpportunitySignalInput,
  RunMultiCompareInput,
  RunOpportunityRankingInput,
  RunOpportunityRulesNowInput,
  SaveFreeCompareSnapshotInput,
  SaveFreeCompareWorkspaceDraftInput,
  ToggleOpportunityRuleInput,
  UpdateOpportunityRuleInput,
  UpsertOpportunityRankingProfileInput
} from "@mytrader/shared";

import type { SqliteDatabase } from "../storage/sqlite";
import { all, get, run, transaction } from "../storage/sqlite";
import { previewTargets, resolveTargetsByConfig } from "../market/targetsService";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCOPE_DEGRADED_THRESHOLD = 0.6;
const SIGNAL_EXPIRE_DAYS = 7;
const SNAPSHOT_LIMIT = 50;
const COMPARE_DRAFT_KEY = "opportunities_compare_draft_v1";

const RULE_TEMPLATES: OpportunityRuleTemplate[] = [
  "valuation_gap",
  "momentum_breakout",
  "reversal_risk",
  "liquidity_anomaly"
];

const SIGNAL_STATUSES: OpportunitySignalStatus[] = ["active", "expired", "dismissed"];

const FULL_SCOPE_DEFAULT: OpportunityScopeConfig = {
  includeHoldings: true,
  includeRegistryAutoIngest: true,
  includeWatchlist: true,
  portfolioIds: null,
  explicitSymbols: [],
  tagFilters: []
};

const DEGRADED_SCOPE_DEFAULT: OpportunityScopeConfig = {
  includeHoldings: true,
  includeRegistryAutoIngest: false,
  includeWatchlist: true,
  portfolioIds: null,
  explicitSymbols: [],
  tagFilters: []
};

type OpportunityRuleRow = {
  id: string;
  name: string;
  template: string;
  direction_strategy: string;
  params_json: string;
  score_formula: string | null;
  enabled: number;
  priority: number;
  scope_config_json: string;
  created_at: number;
  updated_at: number;
};

type OpportunityRuleRunRow = {
  id: string;
  rule_id: string;
  as_of_date: string;
  trigger: string;
  scope_mode: string;
  scope_summary: string;
  scanned_count: number;
  generated_count: number;
  degraded_reason: string | null;
  error_summary: string | null;
  started_at: number;
  finished_at: number | null;
  created_at: number;
  updated_at: number;
};

type OpportunitySignalRow = {
  id: string;
  as_of_date: string;
  rule_id: string;
  symbol: string;
  signal_type: string;
  direction: string;
  score: number;
  confidence: number | null;
  reasons_json: string;
  scope_summary: string | null;
  status: string;
  pinned: number;
  stale: number;
  expires_at: number;
  dismissed_at: number | null;
  created_at: number;
  updated_at: number;
  rule_name: string;
};

type OpportunityRankingProfileRow = {
  id: string;
  name: string;
  description: string | null;
  weights_json: string;
  hard_filters_json: string;
  range_days: number;
  enabled: number;
  created_at: number;
  updated_at: number;
};

type OpportunityRankRunRow = {
  id: string;
  profile_id: string;
  as_of_date: string;
  created_at: number;
};

type OpportunityRankItemRow = {
  symbol: string;
  total_score: number;
  factor_scores_json: string;
  risk_flags_json: string;
  previous_rank: number | null;
  current_rank: number;
};

type OpportunityCompareSnapshotRow = {
  id: string;
  name: string;
  description: string | null;
  draft_json: string;
  created_at: number;
  updated_at: number;
  last_used_at: number;
};

type SymbolSeriesPoint = {
  date: string;
  close: number | null;
  volume: number | null;
};

type SymbolMarketInput = {
  symbol: string;
  asOfDate: string;
  latestClose: number | null;
  latestVolume: number | null;
  prevClose: number | null;
  closeSeries: SymbolSeriesPoint[];
  peTtm: number | null;
  turnoverRate: number | null;
  netMfAmount: number | null;
};

type RuleEvaluation = {
  signalType: OpportunitySignalType;
  direction: OpportunityDirection;
  baseScore: number;
  confidence: number;
  reasons: string[];
  factors: Record<string, number>;
};

type FormulaEvaluator = (factors: Record<string, number>) => number;

type RuleRunComputation = {
  run: OpportunityRuleRun;
  signals: Array<{
    symbol: string;
    signalType: OpportunitySignalType;
    direction: OpportunityDirection;
    score: number;
    confidence: number | null;
    reasons: string[];
    scopeSummary: string;
  }>;
};

export async function listOpportunitySignals(input: {
  businessDb: SqliteDatabase;
  query?: ListOpportunitySignalsInput;
}): Promise<ListOpportunitySignalsResult> {
  await refreshSignalLifecycle(input.businessDb);

  const query = input.query ?? {};
  const limit = normalizeLimit(query.limit, 100, 500);
  const offset = normalizeOffset(query.offset);
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (query.signalType && query.signalType !== "all") {
    where.push("s.signal_type = ?");
    params.push(query.signalType);
  }
  if (query.direction && query.direction !== "all") {
    where.push("s.direction = ?");
    params.push(query.direction);
  }
  if (query.status && query.status !== "all") {
    where.push("s.status = ?");
    params.push(query.status);
  }
  if (query.ruleIds && query.ruleIds.length > 0) {
    const ids = uniqueNonEmptyStrings(query.ruleIds);
    if (ids.length > 0) {
      where.push(`s.rule_id in (${ids.map(() => "?").join(", ")})`);
      params.push(...ids);
    }
  }
  const trimmedQuery = query.query?.trim().toUpperCase() ?? "";
  if (trimmedQuery) {
    where.push("s.symbol like ?");
    params.push(`%${escapeLike(trimmedQuery)}%`);
  }

  const whereSql = where.length > 0 ? `where ${where.join(" and ")}` : "";

  const rows = await all<OpportunitySignalRow>(
    input.businessDb,
    `
      select
        s.id,
        s.as_of_date,
        s.rule_id,
        s.symbol,
        s.signal_type,
        s.direction,
        s.score,
        s.confidence,
        s.reasons_json,
        s.scope_summary,
        s.status,
        s.pinned,
        s.stale,
        s.expires_at,
        s.dismissed_at,
        s.created_at,
        s.updated_at,
        r.name as rule_name
      from opportunity_signals s
      join opportunity_rules r on r.id = s.rule_id
      ${whereSql}
      order by s.pinned desc, s.score desc, s.as_of_date desc, s.updated_at desc
      limit ?
      offset ?
    `,
    [...params, limit, offset]
  );

  const totalRow = await get<{ total: number }>(
    input.businessDb,
    `
      select count(*) as total
      from opportunity_signals s
      ${whereSql}
    `,
    params
  );

  return {
    items: rows.map(toOpportunitySignal),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function pinOpportunitySignal(input: {
  businessDb: SqliteDatabase;
  payload: PinOpportunitySignalInput;
}): Promise<void> {
  const signalId = normalizeRequiredString(input.payload.signalId, "signalId");
  const pinned = Boolean(input.payload.pinned);
  const now = Date.now();
  await run(
    input.businessDb,
    `
      update opportunity_signals
      set pinned = ?,
          stale = case when ? = 1 and expires_at < ? then 1 else stale end,
          updated_at = ?
      where id = ?
    `,
    [pinned ? 1 : 0, pinned ? 1 : 0, now, now, signalId]
  );
}

export async function dismissOpportunitySignal(input: {
  businessDb: SqliteDatabase;
  payload: DismissOpportunitySignalInput;
}): Promise<void> {
  const signalId = normalizeRequiredString(input.payload.signalId, "signalId");
  const now = Date.now();
  await run(
    input.businessDb,
    `
      update opportunity_signals
      set status = 'dismissed',
          dismissed_at = ?,
          updated_at = ?
      where id = ?
    `,
    [now, now, signalId]
  );
}

export async function restoreOpportunitySignal(input: {
  businessDb: SqliteDatabase;
  payload: RestoreOpportunitySignalInput;
}): Promise<void> {
  const signalId = normalizeRequiredString(input.payload.signalId, "signalId");
  const now = Date.now();
  const row = await get<{ expires_at: number; pinned: number }>(
    input.businessDb,
    `select expires_at, pinned from opportunity_signals where id = ? limit 1`,
    [signalId]
  );
  if (!row) return;
  const expired = row.expires_at < now;
  const nextStatus = expired && row.pinned !== 1 ? "expired" : "active";
  await run(
    input.businessDb,
    `
      update opportunity_signals
      set status = ?,
          dismissed_at = null,
          stale = case when pinned = 1 and expires_at < ? then 1 else 0 end,
          updated_at = ?
      where id = ?
    `,
    [nextStatus, now, now, signalId]
  );
}

export async function listOpportunityRules(input: {
  businessDb: SqliteDatabase;
  query?: ListOpportunityRulesInput;
}): Promise<OpportunityRule[]> {
  await ensureDefaultOpportunityRules(input.businessDb);

  const includeDisabled = Boolean(input.query?.includeDisabled ?? true);
  const rows = await all<OpportunityRuleRow>(
    input.businessDb,
    `
      select id, name, template, direction_strategy, params_json, score_formula,
             enabled, priority, scope_config_json, created_at, updated_at
      from opportunity_rules
      ${includeDisabled ? "" : "where enabled = 1"}
      order by priority asc, created_at asc
    `
  );
  return rows.map(toOpportunityRule);
}

export async function createOpportunityRule(input: {
  businessDb: SqliteDatabase;
  payload: CreateOpportunityRuleInput;
}): Promise<OpportunityRule> {
  const now = Date.now();
  const rule = normalizeRulePayload(input.payload);
  const id = crypto.randomUUID();

  await run(
    input.businessDb,
    `
      insert into opportunity_rules (
        id, name, template, direction_strategy, params_json,
        score_formula, enabled, priority, scope_config_json,
        created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      rule.name,
      rule.template,
      rule.directionStrategy,
      JSON.stringify(rule.params),
      rule.scoreFormula,
      rule.enabled ? 1 : 0,
      rule.priority,
      JSON.stringify(rule.scopeConfig),
      now,
      now
    ]
  );

  return await getOpportunityRuleByIdOrThrow(input.businessDb, id);
}

export async function updateOpportunityRule(input: {
  businessDb: SqliteDatabase;
  payload: UpdateOpportunityRuleInput;
}): Promise<OpportunityRule> {
  const id = normalizeRequiredString(input.payload.id, "id");
  const existing = await getOpportunityRuleByIdOrNull(input.businessDb, id);
  if (!existing) throw new Error("Opportunity rule not found.");

  const now = Date.now();
  const patch = normalizeRulePayload({
    ...existing,
    ...input.payload,
    scopeConfig: {
      ...existing.scopeConfig,
      ...(input.payload.scopeConfig ?? {})
    }
  });

  await run(
    input.businessDb,
    `
      update opportunity_rules
      set name = ?,
          template = ?,
          direction_strategy = ?,
          params_json = ?,
          score_formula = ?,
          enabled = ?,
          priority = ?,
          scope_config_json = ?,
          updated_at = ?
      where id = ?
    `,
    [
      patch.name,
      patch.template,
      patch.directionStrategy,
      JSON.stringify(patch.params),
      patch.scoreFormula,
      patch.enabled ? 1 : 0,
      patch.priority,
      JSON.stringify(patch.scopeConfig),
      now,
      id
    ]
  );

  return await getOpportunityRuleByIdOrThrow(input.businessDb, id);
}

export async function toggleOpportunityRule(input: {
  businessDb: SqliteDatabase;
  payload: ToggleOpportunityRuleInput;
}): Promise<OpportunityRule> {
  const id = normalizeRequiredString(input.payload.id, "id");
  await run(
    input.businessDb,
    `
      update opportunity_rules
      set enabled = ?,
          updated_at = ?
      where id = ?
    `,
    [input.payload.enabled ? 1 : 0, Date.now(), id]
  );
  return await getOpportunityRuleByIdOrThrow(input.businessDb, id);
}

export async function deleteOpportunityRule(input: {
  businessDb: SqliteDatabase;
  payload: DeleteOpportunityRuleInput;
}): Promise<void> {
  const id = normalizeRequiredString(input.payload.id, "id");
  await run(input.businessDb, `delete from opportunity_rules where id = ?`, [id]);
}

export async function listOpportunityRuleRuns(input: {
  businessDb: SqliteDatabase;
  query?: ListOpportunityRuleRunsInput;
}): Promise<ListOpportunityRuleRunsResult> {
  const query = input.query ?? {};
  const limit = normalizeLimit(query.limit, 100, 500);
  const offset = normalizeOffset(query.offset);
  const ruleId = query.ruleId?.trim() ?? "";
  const where = ruleId ? "where rule_id = ?" : "";
  const params = ruleId ? [ruleId] : [];

  const rows = await all<OpportunityRuleRunRow>(
    input.businessDb,
    `
      select
        id, rule_id, as_of_date, trigger, scope_mode, scope_summary,
        scanned_count, generated_count, degraded_reason, error_summary,
        started_at, finished_at, created_at, updated_at
      from opportunity_rule_runs
      ${where}
      order by started_at desc
      limit ?
      offset ?
    `,
    [...params, limit, offset]
  );

  const totalRow = await get<{ total: number }>(
    input.businessDb,
    `select count(*) as total from opportunity_rule_runs ${where}`,
    params
  );

  return {
    items: rows.map(toOpportunityRuleRun),
    total: Number(totalRow?.total ?? 0),
    limit,
    offset
  };
}

export async function runOpportunityRulesNow(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  payload?: RunOpportunityRulesNowInput;
}): Promise<OpportunityRuleRun[]> {
  await ensureDefaultOpportunityRules(input.businessDb);

  const asOfDate = await resolveAsOfDate(input.marketDb, input.payload?.asOfDate ?? null);
  const trigger = normalizeRunTrigger(input.payload?.trigger ?? null);
  const selectedRuleIds = uniqueNonEmptyStrings(input.payload?.ruleIds ?? null);

  const rows = await all<OpportunityRuleRow>(
    input.businessDb,
    `
      select id, name, template, direction_strategy, params_json, score_formula,
             enabled, priority, scope_config_json, created_at, updated_at
      from opportunity_rules
      where enabled = 1
      ${selectedRuleIds.length > 0 ? `and id in (${selectedRuleIds.map(() => "?").join(", ")})` : ""}
      order by priority asc, created_at asc
    `,
    selectedRuleIds
  );

  const rules = rows.map(toOpportunityRule);
  const runs: OpportunityRuleRun[] = [];
  for (const rule of rules) {
    const result = await runSingleOpportunityRule({
      businessDb: input.businessDb,
      marketDb: input.marketDb,
      rule,
      asOfDate,
      trigger
    });
    runs.push(result.run);
  }

  await refreshSignalLifecycle(input.businessDb);
  return runs;
}

export async function triggerOpportunityRulesOnDataUpdate(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  asOfDate?: string | null;
}): Promise<void> {
  const asOfDate = await resolveAsOfDate(input.marketDb, input.asOfDate ?? null);
  const alreadyRan = await get<{ total: number }>(
    input.businessDb,
    `
      select count(*) as total
      from opportunity_rule_runs
      where as_of_date = ?
        and trigger = 'data_update'
    `,
    [asOfDate]
  );
  if (Number(alreadyRan?.total ?? 0) > 0) return;
  await runOpportunityRulesNow({
    businessDb: input.businessDb,
    marketDb: input.marketDb,
    payload: {
      asOfDate,
      trigger: "data_update"
    }
  });
}

export async function triggerOpportunityRulesOnScheduledFallback(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  asOfDate?: string | null;
}): Promise<void> {
  const asOfDate = await resolveAsOfDate(input.marketDb, input.asOfDate ?? null);
  const summary = await get<{
    schedule_runs: number;
    data_update_success_runs: number;
  }>(
    input.businessDb,
    `
      select
        sum(case when trigger = 'schedule' then 1 else 0 end) as schedule_runs,
        sum(case when trigger = 'data_update' and error_summary is null then 1 else 0 end) as data_update_success_runs
      from opportunity_rule_runs
      where as_of_date = ?
    `,
    [asOfDate]
  );

  if (Number(summary?.schedule_runs ?? 0) > 0) return;
  if (Number(summary?.data_update_success_runs ?? 0) > 0) return;

  await runOpportunityRulesNow({
    businessDb: input.businessDb,
    marketDb: input.marketDb,
    payload: {
      asOfDate,
      trigger: "schedule"
    }
  });
}

export async function listOpportunityRankingProfiles(input: {
  businessDb: SqliteDatabase;
  query?: ListOpportunityRankingProfilesInput;
}): Promise<OpportunityRankingProfile[]> {
  await ensureDefaultRankingProfiles(input.businessDb);

  const includeDisabled = Boolean(input.query?.includeDisabled ?? true);
  const rows = await all<OpportunityRankingProfileRow>(
    input.businessDb,
    `
      select id, name, description, weights_json, hard_filters_json, range_days,
             enabled, created_at, updated_at
      from opportunity_rank_profiles
      ${includeDisabled ? "" : "where enabled = 1"}
      order by updated_at desc, created_at desc
    `
  );

  return rows.map(toOpportunityRankingProfile);
}

export async function upsertOpportunityRankingProfile(input: {
  businessDb: SqliteDatabase;
  payload: UpsertOpportunityRankingProfileInput;
}): Promise<OpportunityRankingProfile> {
  const now = Date.now();
  const normalized = normalizeRankingProfilePayload(input.payload);

  if (input.payload.id?.trim()) {
    const id = input.payload.id.trim();
    await run(
      input.businessDb,
      `
        update opportunity_rank_profiles
        set name = ?,
            description = ?,
            weights_json = ?,
            hard_filters_json = ?,
            range_days = ?,
            enabled = ?,
            updated_at = ?
        where id = ?
      `,
      [
        normalized.name,
        normalized.description,
        JSON.stringify(normalized.weights),
        JSON.stringify(normalized.hardFilters),
        normalized.rangeDays,
        normalized.enabled ? 1 : 0,
        now,
        id
      ]
    );
    const updated = await getOpportunityRankingProfileById(input.businessDb, id);
    if (!updated) throw new Error("Ranking profile not found.");
    return updated;
  }

  const id = crypto.randomUUID();
  await run(
    input.businessDb,
    `
      insert into opportunity_rank_profiles (
        id, name, description, weights_json, hard_filters_json,
        range_days, enabled, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      normalized.name,
      normalized.description,
      JSON.stringify(normalized.weights),
      JSON.stringify(normalized.hardFilters),
      normalized.rangeDays,
      normalized.enabled ? 1 : 0,
      now,
      now
    ]
  );

  const created = await getOpportunityRankingProfileById(input.businessDb, id);
  if (!created) throw new Error("Failed to create ranking profile.");
  return created;
}

export async function runOpportunityRanking(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  payload: RunOpportunityRankingInput;
}): Promise<OpportunityRankingResult> {
  await ensureDefaultRankingProfiles(input.businessDb);

  const profileId = normalizeRequiredString(input.payload.profileId, "profileId");
  const profile = await getOpportunityRankingProfileById(input.businessDb, profileId);
  if (!profile) throw new Error("Ranking profile not found.");

  const asOfDate = await resolveAsOfDate(input.marketDb, input.payload.asOfDate ?? null);
  const preview = await previewTargets({
    businessDb: input.businessDb,
    marketDb: input.marketDb
  });
  const symbols = preview.symbols.map((item) => item.symbol);

  const inputsBySymbol = await loadSymbolMarketInputs({
    marketDb: input.marketDb,
    symbols,
    asOfDate,
    maxLookback: Math.max(20, profile.rangeDays + 1)
  });

  const prevRanks = await getPreviousRanks(input.businessDb, profileId);
  const items: OpportunityRankingItem[] = [];
  for (const symbol of symbols) {
    const market = inputsBySymbol.get(symbol);
    if (!market) continue;

    const scores = computeRankingFactorScores({
      market,
      rangeDays: profile.rangeDays
    });

    if (!passesRankingHardFilters(market, profile.hardFilters)) continue;

    const totalScore =
      (profile.weights.valuation ?? 0) * scores.valuation +
      (profile.weights.momentum ?? 0) * scores.momentum +
      (profile.weights.liquidity ?? 0) * scores.liquidity +
      (profile.weights.risk ?? 0) * scores.risk;

    const riskFlags = buildRiskFlags(market);
    items.push({
      symbol,
      totalScore,
      factorScores: scores,
      riskFlags,
      previousRank: prevRanks.get(symbol) ?? null,
      currentRank: 0
    });
  }

  items.sort((a, b) => b.totalScore - a.totalScore || a.symbol.localeCompare(b.symbol));
  items.forEach((item, index) => {
    item.currentRank = index + 1;
  });

  const runId = crypto.randomUUID();
  const now = Date.now();
  await transaction(input.businessDb, async () => {
    await run(
      input.businessDb,
      `
        insert into opportunity_rank_runs (id, profile_id, as_of_date, created_at)
        values (?, ?, ?, ?)
      `,
      [runId, profileId, asOfDate, now]
    );

    for (const item of items) {
      await run(
        input.businessDb,
        `
          insert into opportunity_rank_items (
            id, run_id, symbol, total_score, factor_scores_json,
            risk_flags_json, previous_rank, current_rank, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          crypto.randomUUID(),
          runId,
          item.symbol,
          item.totalScore,
          JSON.stringify(item.factorScores),
          JSON.stringify(item.riskFlags),
          item.previousRank,
          item.currentRank,
          now,
          now
        ]
      );
    }
  });

  return {
    runId,
    profile,
    asOfDate,
    items,
    generatedAt: now
  };
}

export async function getLatestOpportunityRanking(input: {
  businessDb: SqliteDatabase;
  payload: GetLatestOpportunityRankingInput;
}): Promise<OpportunityRankingResult | null> {
  const profileId = normalizeRequiredString(input.payload.profileId, "profileId");
  const profile = await getOpportunityRankingProfileById(input.businessDb, profileId);
  if (!profile) return null;

  const runRow = await get<OpportunityRankRunRow>(
    input.businessDb,
    `
      select id, profile_id, as_of_date, created_at
      from opportunity_rank_runs
      where profile_id = ?
      order by created_at desc
      limit 1
    `,
    [profileId]
  );
  if (!runRow) return null;

  const itemRows = await all<OpportunityRankItemRow>(
    input.businessDb,
    `
      select symbol, total_score, factor_scores_json, risk_flags_json,
             previous_rank, current_rank
      from opportunity_rank_items
      where run_id = ?
      order by current_rank asc, symbol asc
    `,
    [runRow.id]
  );

  const items = itemRows.map((row) => ({
    symbol: row.symbol,
    totalScore: Number(row.total_score),
    factorScores: safeParseNumberRecord(row.factor_scores_json),
    riskFlags: safeParseStringArray(row.risk_flags_json),
    previousRank: row.previous_rank,
    currentRank: row.current_rank
  }));

  return {
    runId: runRow.id,
    profile,
    asOfDate: runRow.as_of_date,
    items,
    generatedAt: runRow.created_at
  };
}

export async function runOpportunityMultiCompare(input: {
  marketDb: SqliteDatabase;
  payload: RunMultiCompareInput;
}): Promise<MultiCompareResult> {
  const symbols = uniqueNonEmptyStrings(input.payload.symbols);
  if (symbols.length === 0) {
    throw new Error("At least one symbol is required.");
  }
  if (symbols.length > 5) {
    throw new Error("最多支持 5 个比对标的。基线可额外设置。");
  }

  const baselineRaw = input.payload.baselineSymbol?.trim() ?? "";
  const baselineSymbol = baselineRaw || symbols[0];
  const baselineAutoSelected = !baselineRaw;

  const asOfDate = await resolveAsOfDate(input.marketDb, input.payload.asOfDate ?? null);

  const orderedSymbols = [
    baselineSymbol,
    ...symbols.filter((symbol) => symbol !== baselineSymbol)
  ];

  const inputsBySymbol = await loadSymbolMarketInputs({
    marketDb: input.marketDb,
    symbols: orderedSymbols,
    asOfDate,
    maxLookback: 25
  });

  const baseline = inputsBySymbol.get(baselineSymbol);
  const baselineMetrics = baseline ? buildCompareMetrics(baseline, 20) : null;

  const items: MultiCompareItem[] = orderedSymbols.map((symbol) => {
    const source = inputsBySymbol.get(symbol);
    const metrics = source ? buildCompareMetrics(source, 20) : null;
    return {
      symbol,
      close: source?.latestClose ?? null,
      peTtm: source?.peTtm ?? null,
      turnoverRate: source?.turnoverRate ?? null,
      return20d: metrics?.returnNd ?? null,
      netMfAmount: source?.netMfAmount ?? null,
      relative: {
        return20dVsBaseline:
          metrics && baselineMetrics
            ? subtractNullable(metrics.returnNd, baselineMetrics.returnNd)
            : null,
        peTtmVsBaseline:
          source && baseline
            ? subtractNullable(source.peTtm, baseline.peTtm)
            : null,
        turnoverRateVsBaseline:
          source && baseline
            ? subtractNullable(source.turnoverRate, baseline.turnoverRate)
            : null,
        netMfAmountVsBaseline:
          source && baseline
            ? subtractNullable(source.netMfAmount, baseline.netMfAmount)
            : null
      }
    };
  });

  return {
    asOfDate,
    baselineSymbol,
    baselineAutoSelected,
    items
  };
}

export async function getFreeCompareWorkspaceDraft(input: {
  businessDb: SqliteDatabase;
}): Promise<FreeCompareWorkspaceDraft> {
  const row = await get<{ value_json: string }>(
    input.businessDb,
    `select value_json from market_settings where key = ?`,
    [COMPARE_DRAFT_KEY]
  );
  if (!row) return buildDefaultCompareDraft();
  return normalizeFreeCompareWorkspaceDraft(safeParseJsonObject(row.value_json));
}

export async function saveFreeCompareWorkspaceDraft(input: {
  businessDb: SqliteDatabase;
  payload: SaveFreeCompareWorkspaceDraftInput;
}): Promise<FreeCompareWorkspaceDraft> {
  const draft = normalizeFreeCompareWorkspaceDraft(input.payload.draft);
  await run(
    input.businessDb,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set
        value_json = excluded.value_json
    `,
    [COMPARE_DRAFT_KEY, JSON.stringify(draft)]
  );
  return draft;
}

export async function listFreeCompareSnapshots(input: {
  businessDb: SqliteDatabase;
}): Promise<FreeCompareSnapshot[]> {
  const rows = await all<OpportunityCompareSnapshotRow>(
    input.businessDb,
    `
      select id, name, description, draft_json, created_at, updated_at, last_used_at
      from opportunity_compare_snapshots
      order by updated_at desc, created_at desc
    `
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    draft: normalizeFreeCompareWorkspaceDraft(safeParseJsonObject(row.draft_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at
  }));
}

export async function saveFreeCompareSnapshot(input: {
  businessDb: SqliteDatabase;
  payload: SaveFreeCompareSnapshotInput;
}): Promise<FreeCompareSnapshot> {
  const name = normalizeRequiredString(input.payload.name, "name");
  const description = normalizeNullableString(input.payload.description ?? null);
  const draft = normalizeFreeCompareWorkspaceDraft(input.payload.draft);

  const totalRow = await get<{ total: number }>(
    input.businessDb,
    `select count(*) as total from opportunity_compare_snapshots`
  );
  if (Number(totalRow?.total ?? 0) >= SNAPSHOT_LIMIT) {
    throw new Error("自由比对快照已达上限 50，请先删除旧快照。");
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  await run(
    input.businessDb,
    `
      insert into opportunity_compare_snapshots (
        id, name, description, draft_json, created_at, updated_at, last_used_at
      )
      values (?, ?, ?, ?, ?, ?, ?)
    `,
    [id, name, description, JSON.stringify(draft), now, now, now]
  );

  return {
    id,
    name,
    description,
    draft,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now
  };
}

export async function deleteFreeCompareSnapshot(input: {
  businessDb: SqliteDatabase;
  payload: DeleteFreeCompareSnapshotInput;
}): Promise<void> {
  const id = normalizeRequiredString(input.payload.id, "id");
  await run(
    input.businessDb,
    `delete from opportunity_compare_snapshots where id = ?`,
    [id]
  );
}

export async function loadFreeCompareSnapshot(input: {
  businessDb: SqliteDatabase;
  payload: LoadFreeCompareSnapshotInput;
}): Promise<FreeCompareSnapshot> {
  const id = normalizeRequiredString(input.payload.id, "id");
  const row = await get<OpportunityCompareSnapshotRow>(
    input.businessDb,
    `
      select id, name, description, draft_json, created_at, updated_at, last_used_at
      from opportunity_compare_snapshots
      where id = ?
      limit 1
    `,
    [id]
  );
  if (!row) throw new Error("Snapshot not found.");

  const now = Date.now();
  await run(
    input.businessDb,
    `
      update opportunity_compare_snapshots
      set last_used_at = ?, updated_at = ?
      where id = ?
    `,
    [now, now, id]
  );

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    draft: normalizeFreeCompareWorkspaceDraft(safeParseJsonObject(row.draft_json)),
    createdAt: row.created_at,
    updatedAt: now,
    lastUsedAt: now
  };
}

async function runSingleOpportunityRule(input: {
  businessDb: SqliteDatabase;
  marketDb: SqliteDatabase;
  rule: OpportunityRule;
  asOfDate: string;
  trigger: OpportunityRunTrigger;
}): Promise<RuleRunComputation> {
  const now = Date.now();
  const runId = crypto.randomUUID();

  await run(
    input.businessDb,
    `
      insert into opportunity_rule_runs (
        id, rule_id, as_of_date, trigger, scope_mode, scope_summary,
        scanned_count, generated_count, degraded_reason, error_summary,
        started_at, finished_at, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      runId,
      input.rule.id,
      input.asOfDate,
      input.trigger,
      "full",
      "",
      0,
      0,
      null,
      null,
      now,
      null,
      now,
      now
    ]
  );

  try {
    const fullScope = await resolveTargetsByConfig({
      businessDb: input.businessDb,
      marketDb: input.marketDb,
      config: normalizeScopeConfig(input.rule.scopeConfig)
    });

    let scopeMode: OpportunityRunScopeMode = "full";
    let scopeSummary = `full:${fullScope.symbols.length}`;
    let degradedReason: string | null = null;
    let symbols = fullScope.symbols.map((item) => item.symbol);

    let marketInputs = await loadSymbolMarketInputs({
      marketDb: input.marketDb,
      symbols,
      asOfDate: input.asOfDate,
      maxLookback: resolveRuleLookback(input.rule)
    });

    const supportRatio = computeSupportRatio(input.rule.template, symbols, marketInputs);
    if (symbols.length > 0 && supportRatio < SCOPE_DEGRADED_THRESHOLD) {
      const degradedScope = await resolveTargetsByConfig({
        businessDb: input.businessDb,
        marketDb: input.marketDb,
        config: DEGRADED_SCOPE_DEFAULT
      });
      scopeMode = "degraded";
      scopeSummary = `degraded:${degradedScope.symbols.length}`;
      degradedReason = `required data support ratio ${supportRatio.toFixed(2)} < ${SCOPE_DEGRADED_THRESHOLD.toFixed(2)}`;
      symbols = degradedScope.symbols.map((item) => item.symbol);
      marketInputs = await loadSymbolMarketInputs({
        marketDb: input.marketDb,
        symbols,
        asOfDate: input.asOfDate,
        maxLookback: resolveRuleLookback(input.rule)
      });
    }

    const formulaEvaluator = buildFormulaEvaluator(input.rule.scoreFormula);

    const generatedSignals: RuleRunComputation["signals"] = [];
    for (const symbol of symbols) {
      const market = marketInputs.get(symbol);
      if (!market) continue;
      const evaluation = evaluateRuleByTemplate({
        rule: input.rule,
        market,
        asOfDate: input.asOfDate
      });
      if (!evaluation) continue;

      const finalScore = formulaEvaluator
        ? formulaEvaluator({
            baseScore: evaluation.baseScore,
            ...evaluation.factors
          })
        : evaluation.baseScore;
      if (!Number.isFinite(finalScore)) {
        throw new Error(`Score formula returned non-finite value for symbol=${symbol}`);
      }

      generatedSignals.push({
        symbol,
        signalType: evaluation.signalType,
        direction: evaluation.direction,
        score: Number(finalScore),
        confidence: clamp(evaluation.confidence, 0, 1),
        reasons: evaluation.reasons,
        scopeSummary
      });
    }

    const finishTs = Date.now();
    await transaction(input.businessDb, async () => {
      for (const signal of generatedSignals) {
        await upsertOpportunitySignal({
          businessDb: input.businessDb,
          rule: input.rule,
          asOfDate: input.asOfDate,
          signal,
          now: finishTs
        });
      }

      await run(
        input.businessDb,
        `
          update opportunity_rule_runs
          set scope_mode = ?,
              scope_summary = ?,
              scanned_count = ?,
              generated_count = ?,
              degraded_reason = ?,
              error_summary = null,
              finished_at = ?,
              updated_at = ?
          where id = ?
        `,
        [
          scopeMode,
          scopeSummary,
          symbols.length,
          generatedSignals.length,
          degradedReason,
          finishTs,
          finishTs,
          runId
        ]
      );
    });

    const runRow = await get<OpportunityRuleRunRow>(
      input.businessDb,
      `
        select id, rule_id, as_of_date, trigger, scope_mode, scope_summary,
               scanned_count, generated_count, degraded_reason, error_summary,
               started_at, finished_at, created_at, updated_at
        from opportunity_rule_runs
        where id = ?
      `,
      [runId]
    );
    if (!runRow) throw new Error("Failed to read opportunity run.");

    return {
      run: toOpportunityRuleRun(runRow),
      signals: generatedSignals
    };
  } catch (error) {
    const finishTs = Date.now();
    const message = error instanceof Error ? error.message : String(error);
    await run(
      input.businessDb,
      `
        update opportunity_rule_runs
        set error_summary = ?,
            finished_at = ?,
            updated_at = ?
        where id = ?
      `,
      [message, finishTs, finishTs, runId]
    );

    const runRow = await get<OpportunityRuleRunRow>(
      input.businessDb,
      `
        select id, rule_id, as_of_date, trigger, scope_mode, scope_summary,
               scanned_count, generated_count, degraded_reason, error_summary,
               started_at, finished_at, created_at, updated_at
        from opportunity_rule_runs
        where id = ?
      `,
      [runId]
    );
    if (!runRow) throw error;
    return {
      run: toOpportunityRuleRun(runRow),
      signals: []
    };
  }
}

async function upsertOpportunitySignal(input: {
  businessDb: SqliteDatabase;
  rule: OpportunityRule;
  asOfDate: string;
  signal: {
    symbol: string;
    signalType: OpportunitySignalType;
    direction: OpportunityDirection;
    score: number;
    confidence: number | null;
    reasons: string[];
    scopeSummary: string;
  };
  now: number;
}): Promise<void> {
  const expiresAt = computeSignalExpiresAt(input.asOfDate);
  await run(
    input.businessDb,
    `
      insert into opportunity_signals (
        id, as_of_date, rule_id, symbol, signal_type, direction,
        score, confidence, reasons_json, scope_summary, status,
        pinned, stale, expires_at, dismissed_at, created_at, updated_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, null, ?, ?)
      on conflict(as_of_date, rule_id, symbol, direction) do update set
        signal_type = excluded.signal_type,
        score = excluded.score,
        confidence = excluded.confidence,
        reasons_json = excluded.reasons_json,
        scope_summary = excluded.scope_summary,
        status = case
          when opportunity_signals.status = 'dismissed' then 'dismissed'
          when opportunity_signals.pinned = 0 and opportunity_signals.expires_at < ? then 'expired'
          else 'active'
        end,
        stale = case
          when opportunity_signals.pinned = 1 and opportunity_signals.expires_at < ? then 1
          else 0
        end,
        updated_at = excluded.updated_at
    `,
    [
      crypto.randomUUID(),
      input.asOfDate,
      input.rule.id,
      input.signal.symbol,
      input.signal.signalType,
      input.signal.direction,
      input.signal.score,
      input.signal.confidence,
      JSON.stringify(input.signal.reasons),
      input.signal.scopeSummary,
      expiresAt,
      input.now,
      input.now,
      input.now,
      input.now
    ]
  );
}

async function ensureDefaultOpportunityRules(db: SqliteDatabase): Promise<void> {
  const row = await get<{ total: number }>(db, `select count(*) as total from opportunity_rules`);
  if (Number(row?.total ?? 0) > 0) return;

  const now = Date.now();
  const seeds: Array<{
    name: string;
    template: OpportunityRuleTemplate;
    directionStrategy: OpportunityRuleDirectionStrategy;
    params: Record<string, unknown>;
    scoreFormula: string | null;
    priority: number;
  }> = [
    {
      name: "估值偏离机会",
      template: "valuation_gap",
      directionStrategy: "both",
      params: { targetPe: 15, minAbsGapPct: 0.1 },
      scoreFormula: "clamp(baseScore, -200, 200)",
      priority: 10
    },
    {
      name: "动量突破",
      template: "momentum_breakout",
      directionStrategy: "both",
      params: { lookbackDays: 20, breakoutPct: 0.03 },
      scoreFormula: "clamp(baseScore + volumeSpike * 5, -200, 200)",
      priority: 20
    },
    {
      name: "反转风险",
      template: "reversal_risk",
      directionStrategy: "both",
      params: { lookbackDays: 10, reboundPct: 0.03 },
      scoreFormula: "clamp(baseScore, -200, 200)",
      priority: 30
    },
    {
      name: "流动性异常",
      template: "liquidity_anomaly",
      directionStrategy: "both",
      params: { lookbackDays: 20, volumeSpikeRatio: 1.5 },
      scoreFormula: "clamp(baseScore + abs(netMfAmount) / 10000000, -200, 200)",
      priority: 40
    }
  ];

  for (const seed of seeds) {
    await run(
      db,
      `
        insert into opportunity_rules (
          id, name, template, direction_strategy, params_json, score_formula,
          enabled, priority, scope_config_json, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        seed.name,
        seed.template,
        seed.directionStrategy,
        JSON.stringify(seed.params),
        seed.scoreFormula,
        seed.priority,
        JSON.stringify(FULL_SCOPE_DEFAULT),
        now,
        now
      ]
    );
  }
}

async function ensureDefaultRankingProfiles(db: SqliteDatabase): Promise<void> {
  const row = await get<{ total: number }>(
    db,
    `select count(*) as total from opportunity_rank_profiles`
  );
  if (Number(row?.total ?? 0) > 0) return;

  const now = Date.now();
  const seeds: Array<{ name: string; description: string; weights: Record<string, number> }> = [
    {
      name: "价值",
      description: "估值与安全边际优先",
      weights: { valuation: 0.6, momentum: 0.15, liquidity: 0.1, risk: -0.15 }
    },
    {
      name: "动量",
      description: "趋势与活跃度优先",
      weights: { valuation: 0.15, momentum: 0.55, liquidity: 0.2, risk: -0.1 }
    },
    {
      name: "防守",
      description: "风险约束优先",
      weights: { valuation: 0.3, momentum: 0.1, liquidity: 0.1, risk: -0.5 }
    },
    {
      name: "平衡",
      description: "综合平衡视角",
      weights: { valuation: 0.35, momentum: 0.3, liquidity: 0.2, risk: -0.15 }
    }
  ];

  for (const seed of seeds) {
    await run(
      db,
      `
        insert into opportunity_rank_profiles (
          id, name, description, weights_json, hard_filters_json,
          range_days, enabled, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
      [
        crypto.randomUUID(),
        seed.name,
        seed.description,
        JSON.stringify(seed.weights),
        JSON.stringify({}),
        20,
        now,
        now
      ]
    );
  }
}

async function refreshSignalLifecycle(db: SqliteDatabase): Promise<void> {
  const now = Date.now();
  await run(
    db,
    `
      update opportunity_signals
      set status = 'expired',
          stale = 1,
          updated_at = ?
      where status = 'active'
        and pinned = 0
        and expires_at < ?
    `,
    [now, now]
  );
  await run(
    db,
    `
      update opportunity_signals
      set stale = case when expires_at < ? then 1 else 0 end,
          updated_at = ?
      where pinned = 1
        and status in ('active', 'dismissed')
    `,
    [now, now]
  );
}

async function resolveAsOfDate(marketDb: SqliteDatabase, preferred: string | null): Promise<string> {
  if (preferred && DATE_RE.test(preferred)) return preferred;
  const row = await get<{ as_of_date: string | null }>(
    marketDb,
    `select max(trade_date) as as_of_date from daily_prices`
  );
  if (row?.as_of_date && DATE_RE.test(row.as_of_date)) return row.as_of_date;
  return toIsoDate(new Date());
}

async function loadSymbolMarketInputs(input: {
  marketDb: SqliteDatabase;
  symbols: string[];
  asOfDate: string;
  maxLookback: number;
}): Promise<Map<string, SymbolMarketInput>> {
  const symbols = uniqueNonEmptyStrings(input.symbols);
  const result = new Map<string, SymbolMarketInput>();
  if (symbols.length === 0) return result;

  const placeholders = symbols.map(() => "?").join(", ");
  const rows = await all<{
    symbol: string;
    trade_date: string;
    close: number | null;
    volume: number | null;
  }>(
    input.marketDb,
    `
      select symbol, trade_date, close, volume
      from daily_prices
      where symbol in (${placeholders})
        and trade_date <= ?
      order by symbol asc, trade_date desc
    `,
    [...symbols, input.asOfDate]
  );

  const perSymbol = new Map<string, SymbolSeriesPoint[]>();
  const maxPoints = Math.max(2, Math.min(180, input.maxLookback + 2));
  for (const row of rows) {
    if (row.close === null) continue;
    const list = perSymbol.get(row.symbol) ?? [];
    if (list.length >= maxPoints) continue;
    list.push({
      date: row.trade_date,
      close: row.close,
      volume: row.volume
    });
    perSymbol.set(row.symbol, list);
  }

  const latestDates = new Set<string>();
  for (const [symbol, list] of perSymbol.entries()) {
    if (list.length === 0) continue;
    latestDates.add(list[0].date);
    result.set(symbol, {
      symbol,
      asOfDate: list[0].date,
      latestClose: list[0].close,
      latestVolume: list[0].volume,
      prevClose: list[1]?.close ?? null,
      closeSeries: list,
      peTtm: null,
      turnoverRate: null,
      netMfAmount: null
    });
  }

  if (latestDates.size > 0) {
    const datePlaceholders = Array.from(latestDates).map(() => "?").join(", ");

    const basicsRows = await all<{
      symbol: string;
      trade_date: string;
      pe_ttm: number | null;
      turnover_rate: number | null;
    }>(
      input.marketDb,
      `
        select symbol, trade_date, pe_ttm, turnover_rate
        from daily_basics
        where symbol in (${placeholders})
          and trade_date in (${datePlaceholders})
      `,
      [...symbols, ...Array.from(latestDates)]
    );

    const basicsMap = new Map<string, { peTtm: number | null; turnoverRate: number | null }>();
    basicsRows.forEach((row) => {
      basicsMap.set(`${row.symbol}|${row.trade_date}`, {
        peTtm: row.pe_ttm,
        turnoverRate: row.turnover_rate
      });
    });

    const moneyflowRows = await all<{
      symbol: string;
      trade_date: string;
      net_mf_amount: number | null;
    }>(
      input.marketDb,
      `
        select symbol, trade_date, net_mf_amount
        from daily_moneyflows
        where symbol in (${placeholders})
          and trade_date in (${datePlaceholders})
      `,
      [...symbols, ...Array.from(latestDates)]
    );

    const moneyflowMap = new Map<string, number | null>();
    moneyflowRows.forEach((row) => {
      moneyflowMap.set(`${row.symbol}|${row.trade_date}`, row.net_mf_amount);
    });

    for (const [symbol, item] of result.entries()) {
      const key = `${symbol}|${item.asOfDate}`;
      const basics = basicsMap.get(key);
      item.peTtm = basics?.peTtm ?? null;
      item.turnoverRate = basics?.turnoverRate ?? null;
      item.netMfAmount = moneyflowMap.get(key) ?? null;
    }
  }

  return result;
}

function evaluateRuleByTemplate(input: {
  rule: OpportunityRule;
  market: SymbolMarketInput;
  asOfDate: string;
}): RuleEvaluation | null {
  const params = input.rule.params;

  switch (input.rule.template) {
    case "valuation_gap": {
      if (input.market.peTtm === null) return null;
      const targetPe = normalizeNumber((params.targetPe as number | undefined) ?? 15, 15);
      const minAbsGapPct = normalizeNumber(
        (params.minAbsGapPct as number | undefined) ?? 0.1,
        0.1
      );
      const gapPct = (targetPe - input.market.peTtm) / Math.max(1e-6, Math.abs(targetPe));
      if (Math.abs(gapPct) < minAbsGapPct) return null;
      const direction = gapPct >= 0 ? "long" : "short_risk";
      if (!directionAllowed(input.rule.directionStrategy, direction)) return null;
      return {
        signalType: direction === "long" ? "opportunity" : "risk",
        direction,
        baseScore: gapPct * 100,
        confidence: input.market.peTtm > 0 ? 0.85 : 0.65,
        reasons: [
          `PE 偏离 ${(gapPct * 100).toFixed(2)}%`,
          `当前 PE ${formatNullable(input.market.peTtm)}`
        ],
        factors: {
          gapPct,
          peTtm: input.market.peTtm,
          price: input.market.latestClose ?? 0,
          return1d: computeReturn1d(input.market)
        }
      };
    }
    case "momentum_breakout": {
      const lookbackDays = Math.max(
        5,
        Math.min(120, Math.floor(normalizeNumber(params.lookbackDays as number | undefined, 20)))
      );
      const breakoutPct = normalizeNumber(params.breakoutPct as number | undefined, 0.03);
      const closes = input.market.closeSeries.map((item) => item.close).filter(isFiniteNumber);
      if (closes.length < lookbackDays + 1) return null;
      const latest = closes[0];
      const previousWindow = closes.slice(1, lookbackDays + 1);
      const historicalHigh = Math.max(...previousWindow);
      const historicalLow = Math.min(...previousWindow);
      const upBreakout = (latest - historicalHigh) / Math.max(1e-6, historicalHigh);
      const downBreakout = (latest - historicalLow) / Math.max(1e-6, historicalLow);

      if (upBreakout >= breakoutPct && directionAllowed(input.rule.directionStrategy, "long")) {
        return {
          signalType: "opportunity",
          direction: "long",
          baseScore: upBreakout * 100,
          confidence: 0.8,
          reasons: [`向上突破 ${(upBreakout * 100).toFixed(2)}%`],
          factors: {
            breakoutPct: upBreakout,
            volumeSpike: computeVolumeSpike(input.market, lookbackDays),
            price: latest,
            return1d: computeReturn1d(input.market),
            returnNd: computeReturnNd(input.market, lookbackDays)
          }
        };
      }

      if (
        downBreakout <= -breakoutPct &&
        directionAllowed(input.rule.directionStrategy, "short_risk")
      ) {
        return {
          signalType: "risk",
          direction: "short_risk",
          baseScore: Math.abs(downBreakout) * 100,
          confidence: 0.75,
          reasons: [`向下破位 ${Math.abs(downBreakout * 100).toFixed(2)}%`],
          factors: {
            breakoutPct: downBreakout,
            volumeSpike: computeVolumeSpike(input.market, lookbackDays),
            price: latest,
            return1d: computeReturn1d(input.market),
            returnNd: computeReturnNd(input.market, lookbackDays)
          }
        };
      }
      return null;
    }
    case "reversal_risk": {
      const lookbackDays = Math.max(
        5,
        Math.min(120, Math.floor(normalizeNumber(params.lookbackDays as number | undefined, 10)))
      );
      const reboundPct = normalizeNumber(params.reboundPct as number | undefined, 0.03);
      const closes = input.market.closeSeries.map((item) => item.close).filter(isFiniteNumber);
      if (closes.length < lookbackDays + 1) return null;
      const latest = closes[0];
      const window = closes.slice(1, lookbackDays + 1);
      const recentLow = Math.min(...window);
      const recentHigh = Math.max(...window);
      const rebound = (latest - recentLow) / Math.max(1e-6, recentLow);
      const retreat = (recentHigh - latest) / Math.max(1e-6, recentHigh);

      if (rebound >= reboundPct && directionAllowed(input.rule.directionStrategy, "short_risk")) {
        return {
          signalType: "risk",
          direction: "short_risk",
          baseScore: rebound * 100,
          confidence: 0.78,
          reasons: [`短期反弹 ${(rebound * 100).toFixed(2)}%，警惕回撤`],
          factors: {
            reboundPct: rebound,
            return1d: computeReturn1d(input.market),
            returnNd: computeReturnNd(input.market, lookbackDays),
            price: latest,
            volumeSpike: computeVolumeSpike(input.market, lookbackDays),
            netMfAmount: input.market.netMfAmount ?? 0
          }
        };
      }

      if (retreat >= reboundPct && directionAllowed(input.rule.directionStrategy, "long")) {
        return {
          signalType: "opportunity",
          direction: "long",
          baseScore: retreat * 100,
          confidence: 0.72,
          reasons: [`高位回撤 ${(retreat * 100).toFixed(2)}%，关注反转机会`],
          factors: {
            reboundPct: -retreat,
            return1d: computeReturn1d(input.market),
            returnNd: computeReturnNd(input.market, lookbackDays),
            price: latest,
            volumeSpike: computeVolumeSpike(input.market, lookbackDays),
            netMfAmount: input.market.netMfAmount ?? 0
          }
        };
      }
      return null;
    }
    case "liquidity_anomaly": {
      const lookbackDays = Math.max(
        5,
        Math.min(120, Math.floor(normalizeNumber(params.lookbackDays as number | undefined, 20)))
      );
      const volumeSpikeRatio = normalizeNumber(
        params.volumeSpikeRatio as number | undefined,
        1.5
      );
      const spike = computeVolumeSpike(input.market, lookbackDays);
      if (!Number.isFinite(spike) || spike < volumeSpikeRatio) return null;
      const moneyflow = input.market.netMfAmount ?? 0;
      const direction: OpportunityDirection = moneyflow >= 0 ? "long" : "short_risk";
      if (!directionAllowed(input.rule.directionStrategy, direction)) return null;
      return {
        signalType: direction === "long" ? "opportunity" : "risk",
        direction,
        baseScore: spike * 20,
        confidence: input.market.netMfAmount === null ? 0.6 : 0.8,
        reasons: [
          `成交量异常放大 ${spike.toFixed(2)}x`,
          `资金流 ${moneyflow >= 0 ? "净流入" : "净流出"}`
        ],
        factors: {
          volumeSpike: spike,
          netMfAmount: moneyflow,
          return1d: computeReturn1d(input.market),
          turnoverRate: input.market.turnoverRate ?? 0,
          price: input.market.latestClose ?? 0
        }
      };
    }
    default:
      return null;
  }
}

function computeSupportRatio(
  template: OpportunityRuleTemplate,
  symbols: string[],
  marketInputs: Map<string, SymbolMarketInput>
): number {
  if (symbols.length === 0) return 1;
  let supported = 0;
  for (const symbol of symbols) {
    const input = marketInputs.get(symbol);
    if (!input) continue;
    if (hasTemplateRequiredData(template, input)) supported += 1;
  }
  return supported / symbols.length;
}

function hasTemplateRequiredData(
  template: OpportunityRuleTemplate,
  input: SymbolMarketInput
): boolean {
  if (input.latestClose === null) return false;
  if (template === "valuation_gap") return input.peTtm !== null;
  if (template === "momentum_breakout") return input.closeSeries.length >= 21;
  if (template === "reversal_risk") return input.closeSeries.length >= 11;
  if (template === "liquidity_anomaly") {
    return (
      input.closeSeries.length >= 21 &&
      input.latestVolume !== null &&
      input.netMfAmount !== null
    );
  }
  return true;
}

function resolveRuleLookback(rule: OpportunityRule): number {
  const raw = rule.params.lookbackDays;
  const lookback =
    typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 20;
  return Math.max(10, Math.min(180, lookback + 2));
}

function normalizeRulePayload(input: {
  name: string;
  template: OpportunityRuleTemplate;
  directionStrategy?: OpportunityRuleDirectionStrategy | null;
  params?: Record<string, unknown> | null;
  scoreFormula?: string | null;
  enabled?: boolean | null;
  priority?: number | null;
  scopeConfig?: Partial<OpportunityScopeConfig> | null;
}): {
  name: string;
  template: OpportunityRuleTemplate;
  directionStrategy: OpportunityRuleDirectionStrategy;
  params: Record<string, unknown>;
  scoreFormula: string | null;
  enabled: boolean;
  priority: number;
  scopeConfig: OpportunityScopeConfig;
} {
  const name = normalizeRequiredString(input.name, "name");
  const template = normalizeTemplate(input.template);
  const directionStrategy = normalizeDirectionStrategy(input.directionStrategy ?? "both");
  const params = safeNormalizeRecord(input.params ?? {});
  const scoreFormula = normalizeNullableString(input.scoreFormula ?? null);
  const enabled = Boolean(input.enabled ?? true);
  const priority = Math.max(1, Math.min(999, Math.floor(input.priority ?? 100)));
  const scopeConfig = normalizeScopeConfig(input.scopeConfig ?? null);
  return {
    name,
    template,
    directionStrategy,
    params,
    scoreFormula,
    enabled,
    priority,
    scopeConfig
  };
}

function normalizeScopeConfig(input: Partial<OpportunityScopeConfig> | null): OpportunityScopeConfig {
  const source = input ?? FULL_SCOPE_DEFAULT;
  const portfolioIds = Array.isArray(source.portfolioIds)
    ? uniqueNonEmptyStrings(source.portfolioIds)
    : null;
  return {
    includeHoldings: Boolean(source.includeHoldings ?? true),
    includeRegistryAutoIngest: Boolean(source.includeRegistryAutoIngest ?? true),
    includeWatchlist: Boolean(source.includeWatchlist ?? true),
    portfolioIds: portfolioIds && portfolioIds.length > 0 ? portfolioIds : null,
    explicitSymbols: uniqueNonEmptyStrings(source.explicitSymbols),
    tagFilters: uniqueNonEmptyStrings(source.tagFilters)
  };
}

function normalizeTemplate(input: string): OpportunityRuleTemplate {
  if (RULE_TEMPLATES.includes(input as OpportunityRuleTemplate)) {
    return input as OpportunityRuleTemplate;
  }
  throw new Error("Invalid rule template.");
}

function normalizeDirectionStrategy(input: string): OpportunityRuleDirectionStrategy {
  if (input === "long" || input === "short_risk" || input === "both") return input;
  throw new Error("Invalid directionStrategy.");
}

function normalizeRunTrigger(input: OpportunityRunTrigger | null): OpportunityRunTrigger {
  if (input === "data_update" || input === "schedule" || input === "manual") return input;
  return "manual";
}

function directionAllowed(
  strategy: OpportunityRuleDirectionStrategy,
  direction: OpportunityDirection
): boolean {
  if (strategy === "both") return true;
  return strategy === direction;
}

function buildFormulaEvaluator(formula: string | null): FormulaEvaluator | null {
  if (!formula) return null;
  const normalized = formula.trim();
  if (!normalized) return null;
  if (normalized.length > 320) {
    throw new Error("scoreFormula is too long.");
  }

  if (!/^[\w\s+\-*/().,:<>!=&|?%]+$/.test(normalized)) {
    throw new Error("scoreFormula contains unsupported characters.");
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered.includes("constructor") ||
    lowered.includes("__proto__") ||
    lowered.includes("global") ||
    lowered.includes("process") ||
    lowered.includes("require") ||
    lowered.includes("[") ||
    lowered.includes("]")
  ) {
    throw new Error("scoreFormula contains unsafe tokens.");
  }

  // eslint-disable-next-line no-new-func
  const evaluator = new Function(
    "scope",
    `const {min,max,abs,clamp,...vars}=scope; with (vars) { return (${normalized}); }`
  ) as (scope: Record<string, number>) => unknown;

  return (factors: Record<string, number>) => {
    const scope = {
      ...factors,
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      clamp
    };
    const raw = evaluator(scope as unknown as Record<string, number>);
    const score = Number(raw);
    if (!Number.isFinite(score)) {
      throw new Error("scoreFormula returned non-numeric value.");
    }
    return score;
  };
}

function computeRankingFactorScores(input: {
  market: SymbolMarketInput;
  rangeDays: number;
}): Record<string, number> {
  const returnNd = computeReturnNd(input.market, input.rangeDays);
  const valuation =
    input.market.peTtm && input.market.peTtm > 0
      ? clamp(120 / input.market.peTtm, -200, 200)
      : 0;
  const momentum = Number.isFinite(returnNd) ? clamp(returnNd * 100, -200, 200) : 0;
  const liquidity = clamp(
    computeVolumeSpike(input.market, input.rangeDays) * 20 +
      Math.sign(input.market.netMfAmount ?? 0) * 10,
    -200,
    200
  );
  const risk = clamp(-Math.abs(computeReturn1d(input.market)) * 100, -200, 200);
  return {
    valuation,
    momentum,
    liquidity,
    risk
  };
}

function buildRiskFlags(market: SymbolMarketInput): string[] {
  const flags: string[] = [];
  const ret1d = computeReturn1d(market);
  if (Math.abs(ret1d) > 0.08) flags.push("high_intraday_volatility");
  if (market.peTtm !== null && market.peTtm > 60) flags.push("high_pe");
  if (market.netMfAmount !== null && market.netMfAmount < 0) flags.push("net_outflow");
  return flags;
}

function passesRankingHardFilters(
  market: SymbolMarketInput,
  filters: Record<string, unknown>
): boolean {
  const minPrice = numberOrNull(filters.minPrice);
  if (minPrice !== null && (market.latestClose ?? Number.NEGATIVE_INFINITY) < minPrice) {
    return false;
  }
  const maxPeTtm = numberOrNull(filters.maxPeTtm);
  if (maxPeTtm !== null && market.peTtm !== null && market.peTtm > maxPeTtm) {
    return false;
  }
  return true;
}

async function getPreviousRanks(
  businessDb: SqliteDatabase,
  profileId: string
): Promise<Map<string, number>> {
  const runRow = await get<{ id: string }>(
    businessDb,
    `
      select id
      from opportunity_rank_runs
      where profile_id = ?
      order by created_at desc
      limit 1
    `,
    [profileId]
  );
  if (!runRow) return new Map();

  const rows = await all<{ symbol: string; current_rank: number }>(
    businessDb,
    `
      select symbol, current_rank
      from opportunity_rank_items
      where run_id = ?
    `,
    [runRow.id]
  );

  const map = new Map<string, number>();
  rows.forEach((row) => map.set(row.symbol, row.current_rank));
  return map;
}

function buildCompareMetrics(market: SymbolMarketInput, days: number): {
  returnNd: number | null;
} {
  return {
    returnNd: computeReturnNd(market, days)
  };
}

function computeVolumeSpike(market: SymbolMarketInput, lookbackDays: number): number {
  const latestVolume = market.latestVolume;
  if (!isFiniteNumber(latestVolume) || latestVolume <= 0) return 0;
  const volumes = market.closeSeries
    .slice(1, lookbackDays + 1)
    .map((item) => item.volume)
    .filter(isFiniteNumber);
  if (volumes.length === 0) return 0;
  const avg = volumes.reduce((sum, item) => sum + item, 0) / volumes.length;
  if (!Number.isFinite(avg) || avg <= 0) return 0;
  return latestVolume / avg;
}

function computeReturn1d(market: SymbolMarketInput): number {
  if (!isFiniteNumber(market.latestClose) || !isFiniteNumber(market.prevClose) || market.prevClose === 0) {
    return 0;
  }
  return (market.latestClose - market.prevClose) / market.prevClose;
}

function computeReturnNd(market: SymbolMarketInput, days: number): number {
  const closes = market.closeSeries.map((item) => item.close).filter(isFiniteNumber);
  if (closes.length <= days) return 0;
  const latest = closes[0];
  const base = closes[days];
  if (base === 0) return 0;
  return (latest - base) / base;
}

function toOpportunityRule(row: OpportunityRuleRow): OpportunityRule {
  return {
    id: row.id,
    name: row.name,
    template: normalizeTemplate(row.template),
    directionStrategy: normalizeDirectionStrategy(row.direction_strategy),
    params: safeParseJsonObject(row.params_json),
    scoreFormula: normalizeNullableString(row.score_formula),
    enabled: row.enabled === 1,
    priority: row.priority,
    scopeConfig: normalizeScopeConfig(safeParseJsonObject(row.scope_config_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toOpportunityRuleRun(row: OpportunityRuleRunRow): OpportunityRuleRun {
  return {
    id: row.id,
    ruleId: row.rule_id,
    asOfDate: row.as_of_date,
    trigger: normalizeRunTrigger(row.trigger as OpportunityRunTrigger),
    scopeMode: normalizeScopeMode(row.scope_mode),
    scopeSummary: row.scope_summary,
    scannedCount: row.scanned_count,
    generatedCount: row.generated_count,
    degradedReason: row.degraded_reason,
    errorSummary: row.error_summary,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toOpportunitySignal(row: OpportunitySignalRow): OpportunitySignal {
  return {
    id: row.id,
    asOfDate: row.as_of_date,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    symbol: row.symbol,
    signalType: normalizeSignalType(row.signal_type),
    direction: normalizeDirection(row.direction),
    score: Number(row.score),
    confidence: numberOrNull(row.confidence),
    reasons: safeParseStringArray(row.reasons_json),
    scopeSummary: row.scope_summary,
    status: normalizeSignalStatus(row.status),
    pinned: row.pinned === 1,
    stale: row.stale === 1,
    expiresAt: row.expires_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toOpportunityRankingProfile(
  row: OpportunityRankingProfileRow
): OpportunityRankingProfile {
  const weights = safeParseNumberRecord(row.weights_json);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    weights: {
      valuation: weights.valuation ?? 0.35,
      momentum: weights.momentum ?? 0.3,
      liquidity: weights.liquidity ?? 0.2,
      risk: weights.risk ?? -0.15
    },
    hardFilters: safeParseJsonObject(row.hard_filters_json),
    rangeDays: Math.max(5, Math.min(180, Math.floor(row.range_days))),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeRankingProfilePayload(input: UpsertOpportunityRankingProfileInput): {
  name: string;
  description: string | null;
  weights: Record<string, number>;
  hardFilters: Record<string, unknown>;
  rangeDays: number;
  enabled: boolean;
} {
  const name = normalizeRequiredString(input.name, "name");
  const description = normalizeNullableString(input.description ?? null);
  const rawWeights = safeNormalizeRecord(input.weights ?? {});
  const weights = {
    valuation: normalizeNumber(rawWeights.valuation as number | undefined, 0.35),
    momentum: normalizeNumber(rawWeights.momentum as number | undefined, 0.3),
    liquidity: normalizeNumber(rawWeights.liquidity as number | undefined, 0.2),
    risk: normalizeNumber(rawWeights.risk as number | undefined, -0.15)
  };
  const hardFilters = safeNormalizeRecord(input.hardFilters ?? {});
  const rangeDays = Math.max(
    5,
    Math.min(180, Math.floor(normalizeNumber(input.rangeDays ?? 20, 20)))
  );
  const enabled = Boolean(input.enabled ?? true);
  return {
    name,
    description,
    weights,
    hardFilters,
    rangeDays,
    enabled
  };
}

function normalizeScopeMode(value: string): OpportunityRunScopeMode {
  if (value === "full" || value === "degraded") return value;
  return "full";
}

function normalizeSignalType(value: string): OpportunitySignalType {
  if (value === "opportunity" || value === "risk") return value;
  return "opportunity";
}

function normalizeSignalStatus(value: string): OpportunitySignalStatus {
  if (SIGNAL_STATUSES.includes(value as OpportunitySignalStatus)) {
    return value as OpportunitySignalStatus;
  }
  return "active";
}

function normalizeDirection(value: string): OpportunityDirection {
  if (value === "long" || value === "short_risk") return value;
  return "long";
}

async function getOpportunityRuleByIdOrNull(
  db: SqliteDatabase,
  id: string
): Promise<OpportunityRule | null> {
  const row = await get<OpportunityRuleRow>(
    db,
    `
      select id, name, template, direction_strategy, params_json,
             score_formula, enabled, priority, scope_config_json,
             created_at, updated_at
      from opportunity_rules
      where id = ?
      limit 1
    `,
    [id]
  );
  return row ? toOpportunityRule(row) : null;
}

async function getOpportunityRuleByIdOrThrow(
  db: SqliteDatabase,
  id: string
): Promise<OpportunityRule> {
  const row = await getOpportunityRuleByIdOrNull(db, id);
  if (!row) throw new Error("Opportunity rule not found.");
  return row;
}

async function getOpportunityRankingProfileById(
  db: SqliteDatabase,
  id: string
): Promise<OpportunityRankingProfile | null> {
  const row = await get<OpportunityRankingProfileRow>(
    db,
    `
      select id, name, description, weights_json, hard_filters_json,
             range_days, enabled, created_at, updated_at
      from opportunity_rank_profiles
      where id = ?
      limit 1
    `,
    [id]
  );
  return row ? toOpportunityRankingProfile(row) : null;
}

function normalizeFreeCompareWorkspaceDraft(input: unknown): FreeCompareWorkspaceDraft {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const rawWindows = Array.isArray(source.windows) ? source.windows : [];

  const windows: FreeCompareWindowConfig[] = rawWindows
    .slice(0, 6)
    .map((item, index) => normalizeFreeCompareWindow(item, index));

  if (windows.length < 6) {
    for (let i = windows.length; i < 6; i += 1) {
      windows.push(buildDefaultFreeCompareWindow(i));
    }
  }

  const activeWindowIdRaw = typeof source.activeWindowId === "string" ? source.activeWindowId : null;
  const activeWindowId = windows.some((window) => window.id === activeWindowIdRaw)
    ? activeWindowIdRaw
    : windows[0]?.id ?? null;

  const detailSymbol = normalizeNullableString(
    typeof source.detailSymbol === "string" ? source.detailSymbol : null
  );

  const updatedAtRaw = Number(source.updatedAt);
  const updatedAt = Number.isFinite(updatedAtRaw) ? Math.floor(updatedAtRaw) : Date.now();

  return {
    windows,
    activeWindowId,
    detailSymbol,
    updatedAt
  };
}

function normalizeFreeCompareWindow(input: unknown, index: number): FreeCompareWindowConfig {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const id = normalizeNullableString(typeof source.id === "string" ? source.id : null) ?? `window-${index + 1}`;
  return {
    id,
    title: normalizeNullableString(typeof source.title === "string" ? source.title : null) ?? `窗口 ${index + 1}`,
    theme: normalizeNullableString(typeof source.theme === "string" ? source.theme : null),
    symbols: uniqueNonEmptyStrings(Array.isArray(source.symbols) ? source.symbols : []),
    baselineSymbol: normalizeNullableString(
      typeof source.baselineSymbol === "string" ? source.baselineSymbol : null
    ),
    ruleIds: uniqueNonEmptyStrings(Array.isArray(source.ruleIds) ? source.ruleIds : []),
    asOfDate: normalizeDateNullable(source.asOfDate)
  };
}

function buildDefaultFreeCompareWindow(index: number): FreeCompareWindowConfig {
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

function buildDefaultCompareDraft(): FreeCompareWorkspaceDraft {
  const windows = Array.from({ length: 6 }, (_unused, index) =>
    buildDefaultFreeCompareWindow(index)
  );
  return {
    windows,
    activeWindowId: windows[0].id,
    detailSymbol: null,
    updatedAt: Date.now()
  };
}

function safeNormalizeRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return { ...(input as Record<string, unknown>) };
}

function safeParseJsonObject(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeParseStringArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function safeParseNumberRecord(input: string): Record<string, number> {
  const raw = safeParseJsonObject(input);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const n = Number(value);
    if (Number.isFinite(n)) result[key] = n;
  }
  return result;
}

function uniqueNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  );
}

function normalizeRequiredString(value: unknown, field: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeDateNullable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return DATE_RE.test(normalized) ? normalized : null;
}

function normalizeNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLimit(value: number | null | undefined, fallback: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function normalizeOffset(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeSignalExpiresAt(asOfDate: string): number {
  const [year, month, day] = asOfDate.split("-").map((item) => Number(item));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return Date.now() + SIGNAL_EXPIRE_DAYS * 86_400_000;
  }
  const ts = Date.UTC(year, month - 1, day + SIGNAL_EXPIRE_DAYS, 23, 59, 59, 999);
  return ts;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function subtractNullable(a: number | null, b: number | null): number | null {
  if (!isFiniteNumber(a) || !isFiniteNumber(b)) return null;
  return a - b;
}

function escapeLike(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNullable(value: number | null): string {
  return value === null ? "--" : Number(value).toFixed(2);
}
