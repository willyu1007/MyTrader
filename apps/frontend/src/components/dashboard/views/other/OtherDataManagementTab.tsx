import type * as React from "react";
import type { ChangeEvent } from "react";

import type {
  InstrumentRegistryEntry,
  MarketTargetsConfig,
  ResolvedTargetSymbol,
  TargetReasonsDiff,
  UniversePoolBucketId
} from "@mytrader/shared";

import type { OtherViewProps } from "../OtherView";

interface TargetPoolMetricCard {
  key: string;
  label: string;
  value: string | number;
}

export function OtherDataManagementTab(props: OtherViewProps) {
  return (
    <>
      <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark overflow-hidden">
        <div className="divide-y divide-slate-200/70 dark:divide-border-dark/70">
          <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                行情日期
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.snapshot?.priceAsOf ?? "--"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                最近一次拉取
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.latestMarketIngestRun
                  ? props.formatDateTime(props.latestMarketIngestRun.startedAt)
                  : "--"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                拉取状态
              </div>
              {props.latestMarketIngestRun ? (
                <div className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`font-mono text-sm ${props.formatIngestRunTone(
                      props.latestMarketIngestRun.status
                    )}`}
                  >
                    {props.formatIngestRunStatusLabel(props.latestMarketIngestRun.status)}
                  </span>
                  {!props.latestMarketIngestRun.finishedAt && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      进行中
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                  --
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200/70 dark:divide-border-dark/70">
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                令牌来源
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.marketTokenStatus
                  ? props.formatMarketTokenSource(props.marketTokenStatus.source)
                  : "--"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                令牌已配置
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.marketTokenStatus?.configured === undefined ||
                props.marketTokenStatus?.configured === null
                  ? "--"
                  : props.marketTokenStatus.configured
                    ? "是"
                    : "否"}
              </div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                临时标的
              </div>
              <div className="mt-0.5 font-mono text-sm text-slate-900 dark:text-white">
                {props.marketTempTargets.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            数据来源
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            <div className="flex flex-wrap items-center gap-2">
              <props.PopoverSelect
                value={props.marketTokenProvider}
                onChangeValue={props.setMarketTokenProvider}
                options={[{ value: "tushare", label: "Tushare" }]}
                className="w-[180px]"
              />
              <span className="ml-3 text-[11px] text-slate-500 dark:text-slate-400">
                当前提供商：{props.marketTokenProvider === "tushare" ? "Tushare" : "--"}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="open_in_new"
                onClick={props.handleOpenMarketProvider}
                className="min-w-[110px]"
              >
                访问
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={props.handleSaveMarketToken}
                disabled={props.marketTokenSaving}
                className="min-w-[110px]"
              >
                保存
              </props.Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
            <div className="relative">
              <props.Input
                type="password"
                value={props.marketTokenDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  props.setMarketTokenDraft(event.target.value)
                }
                placeholder="输入数据源令牌"
                className="font-mono text-xs pr-8"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <props.HelpHint
                  text={
                    "需要接口权限：\n股票列表（stock_basic）\n基金/ETF 列表（fund_basic）\n交易日历（trade_cal）\n日线行情（daily）\n每日指标（daily_basic）\n资金流（moneyflow）"
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <props.Button
                variant="secondary"
                size="sm"
                icon="delete"
                onClick={props.handleClearMarketToken}
                disabled={props.marketTokenSaving}
                className="min-w-[110px]"
              >
                清除
              </props.Button>
              <props.Button
                variant="secondary"
                size="sm"
                icon="check_circle"
                onClick={props.handleTestMarketToken}
                disabled={props.marketTokenTesting}
                className="min-w-[110px]"
              >
                测试连接
              </props.Button>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-50/55 dark:bg-background-dark/35 p-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  全量池配置
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                    props.marketUniversePoolDirty
                      ? "border-amber-300 text-amber-700 dark:text-amber-300"
                      : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {props.marketUniversePoolDirty ? "未保存" : "已保存"}
                </span>
              </div>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={props.handleSaveUniversePoolConfig}
                disabled={
                  props.marketUniversePoolSaving ||
                  props.marketUniversePoolLoading ||
                  !props.marketUniversePoolConfig ||
                  !props.marketUniversePoolDirty
                }
                className="min-w-[138px]"
              >
                保存全量池配置
              </props.Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {props.UNIVERSE_POOL_BUCKET_ORDER.map((bucket: UniversePoolBucketId) => {
                const enabled = props.marketUniverseEnabledBuckets.has(bucket);
                const status = props.marketUniverseBucketStatusById.get(bucket);
                return (
                  <button
                    key={`universe-pool-${bucket}`}
                    type="button"
                    onClick={() => props.handleToggleUniversePoolBucket(bucket)}
                    disabled={props.marketUniversePoolSaving || props.marketUniversePoolLoading}
                    className={`rounded-md border px-2.5 py-2 text-left transition-colors ${
                      enabled
                        ? "border-primary/40 bg-primary/12"
                        : "border-slate-200/80 dark:border-border-dark/70 bg-white/70 dark:bg-background-dark/55"
                    } ${
                      props.marketUniversePoolSaving || props.marketUniversePoolLoading
                        ? "opacity-70 cursor-not-allowed"
                        : "hover:bg-slate-100/80 dark:hover:bg-background-dark/75"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {props.getUniversePoolBucketLabel(bucket)}
                      </span>
                      <span
                        className={`inline-flex h-5 min-w-[58px] items-center justify-center rounded-full border px-2 text-[11px] ${
                          enabled
                            ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-300 text-slate-500 dark:border-border-dark dark:text-slate-400"
                        }`}
                      >
                        {enabled ? "纳入同步" : "已停更"}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      最后更新：{status?.lastAsOfTradeDate ? props.formatCnDate(status.lastAsOfTradeDate) : "--"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            调度与运行控制
          </h3>
        </div>

        <div className="scheduler-shell rounded-md border p-3">
          {!props.marketSchedulerConfig && !props.marketSchedulerLoading && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              --
            </div>
          )}
          {props.marketSchedulerLoading && !props.marketSchedulerConfig && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              加载中...
            </div>
          )}
          {props.marketSchedulerConfig && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.35fr] gap-3">
              <div className="space-y-3 xl:pr-5 xl:border-r border-slate-200/70 dark:border-border-dark/70">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <props.FormGroup
                    label={
                      <span className="inline-flex items-center gap-1">
                        执行时间
                        <props.HelpHint text="每天在该时间触发自动拉取（24小时制，格式 HH:mm）。" />
                      </span>
                    }
                  >
                    <props.Input
                      value={props.marketSchedulerConfig.runAt}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        props.updateMarketSchedulerConfig({
                          runAt: event.target.value
                        })
                      }
                      placeholder="19:30"
                      className="h-8 font-mono text-sm"
                    />
                  </props.FormGroup>
                  <props.FormGroup
                    label={
                      <span className="inline-flex items-center gap-1">
                        拉取范围
                        <props.HelpHint text={"控制每次定时任务拉取对象：\n目标池 + 全市场：先维护目标池，再维护全市场。\n仅目标池：只更新目标池标的。\n仅全市场：只执行全市场维护。"} />
                      </span>
                    }
                  >
                    <props.PopoverSelect
                      value={props.marketSchedulerConfig.scope}
                      onChangeValue={(value: string) =>
                        props.updateMarketSchedulerConfig({
                          scope: value as "targets" | "universe" | "both"
                        })
                      }
                      options={[
                        { value: "both", label: "目标池 + 全市场" },
                        { value: "targets", label: "仅目标池" },
                        { value: "universe", label: "仅全市场" }
                      ]}
                      buttonClassName="h-8 pl-3 text-sm"
                    />
                  </props.FormGroup>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="tune"
                    onClick={() => props.setMarketSchedulerAdvancedOpen(true)}
                    className="min-w-[120px] justify-center"
                  >
                    更多设置
                  </props.Button>
                  <props.Button
                    variant="primary"
                    size="sm"
                    icon="save"
                    onClick={props.handleSaveMarketSchedulerConfig}
                    disabled={
                      props.marketSchedulerSaving ||
                      !props.marketSchedulerConfig ||
                      !props.marketSchedulerDirty
                    }
                    className="min-w-[136px] justify-center"
                  >
                    保存调度
                  </props.Button>
                </div>
                {props.marketSchedulerDirty && (
                  <div className="text-xs text-amber-600 dark:text-amber-300">
                    存在未保存变更
                  </div>
                )}
              </div>

              <div className="space-y-3 xl:pl-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      状态
                      <props.HelpHint text="当前拉取执行状态：空闲 / 运行中 / 已暂停 / 取消中。" />
                    </div>
                    <div className="h-8 rounded-md border border-slate-200 dark:border-border-dark px-3 flex items-center">
                      <span className="inline-flex items-center gap-2 font-mono text-sm text-slate-700 dark:text-slate-200">
                        <span>
                          {props.marketIngestControlStatus
                            ? props.formatIngestControlStateLabel(
                                props.marketIngestControlStatus.state
                              )
                            : "--"}
                        </span>
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${props.getIngestControlStateDotClass(
                            props.marketIngestControlStatus?.state ?? null
                          )}`}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      队列
                      <props.HelpHint text="等待执行的拉取任务数量（含当前排队项）。" />
                    </div>
                    <div className="h-8 rounded-md border border-slate-200 dark:border-border-dark px-3 flex items-center font-mono text-sm text-slate-700 dark:text-slate-200">
                      {props.marketIngestControlStatus?.queueLength ?? "--"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Run ID
                      <props.HelpHint text="当前运行任务的唯一标识；空闲时为空。" />
                    </div>
                    <div className="h-8 rounded-md border border-slate-200 dark:border-border-dark px-3 flex items-center font-mono text-sm text-slate-700 dark:text-slate-200 truncate">
                      {props.marketIngestControlStatus?.currentRunId ?? "--"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="pause"
                    onClick={props.handlePauseMarketIngest}
                    disabled={!props.marketCanPauseIngest}
                    className="min-w-[108px] justify-center"
                  >
                    暂停
                  </props.Button>
                  <props.Button
                    variant="secondary"
                    size="sm"
                    icon="play_arrow"
                    onClick={props.handleResumeMarketIngest}
                    disabled={!props.marketCanResumeIngest}
                    className="min-w-[108px] justify-center"
                  >
                    继续
                  </props.Button>
                  <span className="hidden md:block h-6 w-px mx-1 bg-slate-200 dark:bg-border-dark" />
                  <props.Button
                    variant="primary"
                    size="sm"
                    icon="play_circle"
                    onClick={props.handleRunMarketIngestNow}
                    disabled={!props.marketCanTriggerIngestNow}
                    className="min-w-[124px] justify-center"
                  >
                    执行拉取
                  </props.Button>
                  <props.Button
                    variant="danger"
                    size="sm"
                    icon="cancel"
                    onClick={props.handleCancelMarketIngest}
                    disabled={!props.marketCanCancelIngest}
                    className="min-w-[124px] justify-center"
                  >
                    取消
                  </props.Button>
                </div>
                {!props.marketTokenStatus?.configured && (
                  <div className="ui-tone-warning text-[11px]">
                    执行拉取需要先配置可用的数据源令牌。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <props.Modal
        open={props.marketSchedulerAdvancedOpen}
        title="调度高级设置"
        onClose={() => props.setMarketSchedulerAdvancedOpen(false)}
      >
        {props.marketSchedulerConfig ? (
          <div className="space-y-4">
            <div className="scheduler-intro rounded-lg border p-4">
              <div className="text-base font-semibold text-[color:var(--mt-text)]">
                自动调度补充项
              </div>
            </div>

            <div className="scheduler-card rounded-lg border p-4 space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={props.marketSchedulerConfig.enabled}
                  onChange={(event) =>
                    props.updateMarketSchedulerConfig({
                      enabled: event.target.checked
                    })
                  }
                />
                <span className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--mt-text)]">
                    启用定时调度
                    <props.HelpHint text="关闭后不会按计划自动触发，但不影响手动拉取。" />
                  </span>
                </span>
              </label>

              <props.FormGroup
                label={
                  <span className="inline-flex items-center gap-1">时区</span>
                }
              >
                <props.PopoverSelect
                  value={props.marketSchedulerConfig.timezone}
                  onChangeValue={(value: string) =>
                    props.updateMarketSchedulerConfig({ timezone: value })
                  }
                  options={props.marketSchedulerTimezoneOptions}
                  className="w-full"
                  buttonClassName="h-10 pl-3 pr-14 text-sm font-mono"
                  rightAccessory={
                    <props.HelpHint text="执行时间解释所使用的时区，例如 Asia/Shanghai。" />
                  }
                />
              </props.FormGroup>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="scheduler-toggle-card rounded-md border p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--mt-text)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={props.marketSchedulerConfig.runOnStartup}
                      onChange={(event) =>
                        props.updateMarketSchedulerConfig({
                          runOnStartup: event.target.checked
                        })
                      }
                    />
                    启动后立即执行
                    <props.HelpHint text="应用启动后触发一次拉取，无需等待当天定时时间。" />
                  </span>
                  <span className="ui-tone-neutral mt-1 block pl-6 text-xs">
                    适合长时间离线后快速补齐最新数据。
                  </span>
                </label>

                <label className="scheduler-toggle-card rounded-md border p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--mt-text)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={props.marketSchedulerConfig.catchUpMissed}
                      onChange={(event) =>
                        props.updateMarketSchedulerConfig({
                          catchUpMissed: event.target.checked
                        })
                      }
                    />
                    补跑错过的当日任务
                    <props.HelpHint text="若应用在执行时段离线，恢复后会补一次当日任务。" />
                  </span>
                  <span className="ui-tone-neutral mt-1 block pl-6 text-xs">
                    减少因离线导致的数据缺口。
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-border-dark">
              <props.Button
                variant="secondary"
                size="sm"
                onClick={() => props.setMarketSchedulerAdvancedOpen(false)}
              >
                取消
              </props.Button>
              <props.Button
                variant="primary"
                size="sm"
                icon="save"
                onClick={async () => {
                  const saved = await props.handleSaveMarketSchedulerConfig();
                  if (saved) {
                    props.setMarketSchedulerAdvancedOpen(false);
                  }
                }}
                disabled={
                  props.marketSchedulerSaving ||
                  !props.marketSchedulerConfig ||
                  !props.marketSchedulerDirty
                }
              >
                保存更改
              </props.Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            暂无调度配置。
          </div>
        )}
      </props.Modal>

      <props.Modal
        open={props.marketTriggerIngestBlockedOpen}
        title="无法执行拉取"
        onClose={() => props.setMarketTriggerIngestBlockedOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {props.marketTriggerIngestBlockedMessage}
          </p>
          <div className="flex justify-end">
            <props.Button
              variant="primary"
              size="sm"
              onClick={() => props.setMarketTriggerIngestBlockedOpen(false)}
            >
              我知道了
            </props.Button>
          </div>
        </div>
      </props.Modal>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            目标池编辑
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark overflow-hidden">
          <div className="border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-background-dark/45 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                    props.marketTargetsDirty
                      ? "border-amber-300 text-amber-700 dark:text-amber-300"
                      : "border-emerald-300 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {props.marketTargetsDirty ? "草稿未保存" : "草稿已同步"}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  预览标的：
                  <span className="ml-1 font-mono text-slate-700 dark:text-slate-200">
                    {props.marketTargetsDiffPreview
                      ? props.marketTargetsDiffPreview.draft.symbols.length
                      : props.marketTargetsPreview
                        ? props.marketTargetsPreview.symbols.length
                        : "--"}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="restart_alt"
                  onClick={props.handleResetTargetsDraft}
                  disabled={!props.marketTargetsDirty}
                >
                  重置草稿
                </props.Button>
                <props.Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    void props.refreshMarketTargets();
                    void props.refreshMarketTargetsDiff();
                  }}
                  disabled={props.marketTargetsLoading}
                >
                  刷新基线
                </props.Button>
                <props.Button
                  variant="primary"
                  size="sm"
                  icon="save"
                  onClick={props.handleSaveTargets}
                  disabled={props.marketTargetsSaving || !props.marketTargetsDirty}
                >
                  保存
                </props.Button>
              </div>
            </div>
          </div>

          <div
            ref={props.targetsEditorGridRef}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,var(--targets-left-pct))_8px_minmax(0,var(--targets-right-pct))] gap-3 p-3 items-start"
            style={
              {
                "--targets-left-pct": `${props.targetsEditorLeftPct}%`,
                "--targets-right-pct": `calc(${100 - props.targetsEditorLeftPct}% - 8px)`
              } as React.CSSProperties
            }
          >
            <div className="space-y-3 min-w-0">
              <div className="rounded-md bg-slate-50/45 dark:bg-background-dark/25">
                <button
                  type="button"
                  onClick={() => props.handleToggleTargetsSection("scope")}
                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                >
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    数据同步范围
                  </span>
                  <span className="material-icons-outlined text-sm text-slate-500 dark:text-slate-400">
                    {props.marketTargetsSectionOpen.scope
                      ? "expand_less"
                      : "expand_more"}
                  </span>
                </button>
                {props.marketTargetsSectionOpen.scope && (
                  <div className="px-3 pb-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={props.marketTargetsConfig.includeHoldings}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            props.setMarketTargetsConfig((prev: MarketTargetsConfig) => ({
                              ...prev,
                              includeHoldings: event.target.checked
                            }))
                          }
                        />
                        <span>包含持仓</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={props.marketTargetsConfig.includeWatchlist}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            props.setMarketTargetsConfig((prev: MarketTargetsConfig) => ({
                              ...prev,
                              includeWatchlist: event.target.checked
                            }))
                          }
                        />
                        <span>包含自选</span>
                      </label>
                      {props.marketRegistryEntryEnabled && (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={
                              props.marketTargetsConfig.includeRegistryAutoIngest
                            }
                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                              props.setMarketTargetsConfig((prev: MarketTargetsConfig) => ({
                                ...prev,
                                includeRegistryAutoIngest: event.target.checked
                              }))
                            }
                          />
                          <span>包含注册标的</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md bg-slate-50/45 dark:bg-background-dark/25">
                <button
                  type="button"
                  onClick={() => props.handleToggleTargetsSection("symbols")}
                  className="w-full flex items-center justify-between px-3 py-2 text-left"
                >
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    手动添加标的
                  </span>
                  <span className="material-icons-outlined text-sm text-slate-500 dark:text-slate-400">
                    {props.marketTargetsSectionOpen.symbols
                      ? "expand_less"
                      : "expand_more"}
                  </span>
                </button>
                {props.marketTargetsSectionOpen.symbols && (
                  <div className="px-3 pb-3 space-y-3">
                    <div className="relative">
                      <textarea
                        value={props.marketTargetsSymbolDraft}
                        onChange={(event) => {
                          props.setMarketTargetsSymbolDraft(event.target.value);
                          props.setMarketManualSymbolPreview({
                            addable: [],
                            existing: [],
                            invalid: [],
                            duplicates: 0
                          });
                        }}
                        placeholder="输入标的代码，支持逗号/空格/换行/分号分隔"
                        rows={4}
                        className="block w-full rounded-md border-slate-300 dark:border-border-dark bg-white dark:bg-field-dark py-1.5 pl-2 pr-16 pb-9 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-primary text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={props.handlePreviewManualTargetSymbols}
                        disabled={!props.marketTargetsSymbolDraft.trim()}
                        className="ui-btn ui-btn-primary absolute right-2 bottom-2 h-7 px-3 rounded-[4px] text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        解析
                      </button>
                    </div>

                    <div className="rounded-md border border-slate-200 dark:border-border-dark bg-slate-100/70 dark:bg-background-dark/35 p-2 space-y-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        预览
                      </div>
                      <div className="max-h-28 overflow-auto space-y-1">
                        {props.marketManualSymbolPreview.addable.map((symbol: string) => (
                          <div
                            key={`preview-addable-${symbol}`}
                            className="flex items-center justify-between gap-2 rounded bg-emerald-50/70 dark:bg-emerald-900/15 px-2 py-1"
                          >
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                              {symbol}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                有效
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  props.handleRemoveManualPreviewSymbol(
                                    symbol,
                                    "addable"
                                  )
                                }
                                className="text-slate-400 hover:text-red-500"
                                aria-label={`移除预览 symbol ${symbol}`}
                                title="移除"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                        {props.marketManualSymbolPreview.existing.map((symbol: string) => (
                          <div
                            key={`preview-existing-${symbol}`}
                            className="flex items-center justify-between gap-2 rounded bg-amber-50/70 dark:bg-amber-900/15 px-2 py-1"
                          >
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                              {symbol}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-amber-700 dark:text-amber-300">
                                已存在
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  props.handleRemoveManualPreviewSymbol(
                                    symbol,
                                    "existing"
                                  )
                                }
                                className="text-slate-400 hover:text-red-500"
                                aria-label={`移除已存在 symbol ${symbol}`}
                                title="移除"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                        {props.marketManualSymbolPreview.invalid.map((symbol: string) => (
                          <div
                            key={`preview-invalid-${symbol}`}
                            className="flex items-center justify-between gap-2 rounded bg-rose-50/70 dark:bg-rose-900/15 px-2 py-1"
                          >
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                              {symbol}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-rose-700 dark:text-rose-300">
                                无效
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  props.handleRemoveManualPreviewSymbol(
                                    symbol,
                                    "invalid"
                                  )
                                }
                                className="text-slate-400 hover:text-red-500"
                                aria-label={`移除无效 symbol ${symbol}`}
                                title="移除"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                        {props.marketManualSymbolPreview.addable.length === 0 &&
                          props.marketManualSymbolPreview.existing.length === 0 &&
                          props.marketManualSymbolPreview.invalid.length === 0 &&
                          props.marketManualSymbolPreview.duplicates === 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              --
                            </div>
                          )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>有效 {props.marketManualSymbolPreview.addable.length}</span>
                          <span>/ 已存在 {props.marketManualSymbolPreview.existing.length}</span>
                          <span>/ 无效 {props.marketManualSymbolPreview.invalid.length}</span>
                          <span>/ 重复 {props.marketManualSymbolPreview.duplicates}</span>
                        </span>
                        <button
                          type="button"
                          onClick={props.handleApplyManualTargetSymbols}
                          disabled={props.marketManualSymbolPreview.addable.length === 0}
                          className="ui-btn ui-btn-primary h-7 px-3 rounded-[4px] text-[11px] font-semibold whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          加入目标池（{props.marketManualSymbolPreview.addable.length}）
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={0}
              onPointerDown={props.handleTargetsEditorResizePointerDown}
              onKeyDown={props.handleTargetsEditorResizeKeyDown}
              className="hidden lg:flex w-[8px] h-full cursor-col-resize items-center justify-center rounded-[3px] hover:bg-primary/12 focus:bg-primary/16 focus:outline-none transition-colors"
              title="拖拽调节左右宽度（←/→ 可微调）"
            >
              <span className="h-full w-px bg-slate-300/95 dark:bg-border-dark pointer-events-none" />
            </div>

            <div className="min-w-0 rounded-md bg-slate-50/70 dark:bg-background-dark/45 p-3 space-y-3 lg:sticky lg:top-3">
              <div className="rounded-md bg-white/65 dark:bg-background-dark/55 p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    标的结构看板
                  </div>
                  <div className="inline-flex items-center rounded-md bg-slate-100/80 dark:bg-background-dark/70 p-1">
                    <button
                      type="button"
                      onClick={() => props.setMarketTargetPoolStatsScope("universe")}
                      className={`h-7 px-3 rounded-[5px] text-xs transition-colors ${
                        props.marketTargetPoolStatsScope === "universe"
                          ? "bg-primary/20 text-slate-900 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      全量标的
                    </button>
                    <button
                      type="button"
                      onClick={() => props.setMarketTargetPoolStatsScope("focus")}
                      className={`h-7 px-3 rounded-[5px] text-xs transition-colors ${
                        props.marketTargetPoolStatsScope === "focus"
                          ? "bg-primary/20 text-slate-900 dark:text-slate-100"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      强相关标的
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {props.marketTargetPoolMetricCards.map((card: TargetPoolMetricCard) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => props.setMarketTargetPoolDetailMetric(card.key)}
                      className="rounded-md border border-slate-200/60 dark:border-border-dark/70 bg-slate-100/65 dark:bg-background-dark/70 px-2.5 py-2 min-h-[54px] flex flex-col justify-between text-left hover:bg-slate-200/60 dark:hover:bg-background-dark/82 transition-colors"
                    >
                      <div className="text-slate-500 dark:text-slate-400">
                        {card.label}
                      </div>
                      <div className="font-mono text-sm text-slate-800 dark:text-slate-100">
                        {card.value}
                      </div>
                    </button>
                  ))}
                </div>

                {(props.marketActiveTargetPoolStats.loading ||
                  props.marketActiveTargetPoolStats.error) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {props.marketActiveTargetPoolStats.loading
                      ? "统计中..."
                      : `统计失败：${props.marketActiveTargetPoolStats.error}`}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded-md border border-primary/40 bg-primary/18 text-slate-900 dark:text-white text-xs font-medium flex items-center justify-center">
                  差异预览
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!props.marketTargetsDiffPreview && !props.marketTargetsPreview) {
                      void props.refreshMarketTargetsDiff();
                    }
                    props.setMarketCurrentTargetsModalOpen(true);
                  }}
                  className="h-8 rounded-md bg-slate-100/75 dark:bg-background-dark/55 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-background-dark/75 transition-colors"
                >
                  当前目标池
                </button>
              </div>

              <div className="max-h-[520px] overflow-auto space-y-2">
                <div className="rounded-md bg-white/70 dark:bg-background-dark/55">
                  <button
                    type="button"
                    onClick={() => props.handleToggleDiffSection("added")}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left border-b border-slate-200/70 dark:border-border-dark/60"
                  >
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      新增
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {props.marketFilteredAddedSymbols.length}
                      </span>
                      <span className="material-icons-outlined text-sm">
                        {props.marketDiffSectionOpen.added
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                    </span>
                  </button>
                  {props.marketDiffSectionOpen.added && (
                    <div className="px-2 pb-2 space-y-1">
                      {props.marketFilteredAddedSymbols.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          --
                        </div>
                      ) : (
                        props.marketFilteredAddedSymbols
                          .slice(0, 100)
                          .map((row: ResolvedTargetSymbol) => (
                          <div
                            key={`added-${row.symbol}`}
                            className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                          >
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                              {row.symbol}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                              {props.formatTargetsReasons(row.reasons)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md bg-white/70 dark:bg-background-dark/55">
                  <button
                    type="button"
                    onClick={() => props.handleToggleDiffSection("removed")}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left border-b border-slate-200/70 dark:border-border-dark/60"
                  >
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                      移除
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {props.marketFilteredRemovedSymbols.length}
                      </span>
                      <span className="material-icons-outlined text-sm">
                        {props.marketDiffSectionOpen.removed
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                    </span>
                  </button>
                  {props.marketDiffSectionOpen.removed && (
                    <div className="px-2 pb-2 space-y-1">
                      {props.marketFilteredRemovedSymbols.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          --
                        </div>
                      ) : (
                        props.marketFilteredRemovedSymbols
                          .slice(0, 100)
                          .map((row: ResolvedTargetSymbol) => (
                            <div
                              key={`removed-${row.symbol}`}
                              className="flex items-start justify-between gap-3 py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                            >
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                {row.symbol}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                                {props.formatTargetsReasons(row.reasons)}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md bg-white/70 dark:bg-background-dark/55">
                  <button
                    type="button"
                    onClick={() => props.handleToggleDiffSection("reasonChanged")}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left border-b border-slate-200/70 dark:border-border-dark/60"
                  >
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      变化来源
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {props.marketFilteredReasonChangedSymbols.length}
                      </span>
                      <span className="material-icons-outlined text-sm">
                        {props.marketDiffSectionOpen.reasonChanged
                          ? "expand_less"
                          : "expand_more"}
                      </span>
                    </span>
                  </button>
                  {props.marketDiffSectionOpen.reasonChanged && (
                    <div className="px-2 pb-2 space-y-1">
                      {props.marketFilteredReasonChangedSymbols.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          --
                        </div>
                      ) : (
                        props.marketFilteredReasonChangedSymbols
                          .slice(0, 100)
                          .map((row: TargetReasonsDiff) => (
                            <div
                              key={`changed-${row.symbol}`}
                              className="py-1 border-b border-slate-200/60 dark:border-border-dark/60 last:border-b-0"
                            >
                              <div className="font-mono text-xs text-slate-700 dark:text-slate-200">
                                {row.symbol}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                旧：{props.formatTargetsReasons(row.baselineReasons)}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                新：{props.formatTargetsReasons(row.draftReasons)}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {props.marketRegistryEntryEnabled && (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            注册标的
          </h3>
          <div className="flex items-center gap-2">
            <props.Button
              variant="secondary"
              size="sm"
              icon="select_all"
              onClick={props.handleToggleSelectAllRegistry}
              disabled={!props.marketRegistryResult?.items.length}
            >
              {props.marketRegistryResult &&
              props.marketRegistrySelectedSymbols.length ===
                props.marketRegistryResult.items.length
                ? "取消全选"
                : "全选"}
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="check_circle"
              onClick={() => {
                void props.handleBatchSetRegistryAutoIngest(true);
              }}
              disabled={props.marketRegistrySelectedSymbols.length === 0}
            >
              批量启用
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="remove_circle"
              onClick={() => {
                void props.handleBatchSetRegistryAutoIngest(false);
              }}
              disabled={props.marketRegistrySelectedSymbols.length === 0}
            >
              批量禁用
            </props.Button>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2">
            <props.Input
              value={props.marketRegistryQuery}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                props.setMarketRegistryQuery(event.target.value)
              }
              placeholder="搜索 symbol / name"
              className="font-mono text-xs"
            />
            <props.PopoverSelect
              value={props.marketRegistryAutoFilter}
              onChangeValue={(value: string) =>
                props.setMarketRegistryAutoFilter(
                  value as "all" | "enabled" | "disabled"
                )
              }
              options={[
                { value: "all", label: "全部" },
                { value: "enabled", label: "仅已启用" },
                { value: "disabled", label: "仅未启用" }
              ]}
            />
            <props.Button
              variant="secondary"
              size="sm"
              icon="refresh"
              onClick={() => {
                void props.refreshMarketRegistry();
              }}
              disabled={props.marketRegistryLoading}
            >
              刷新
            </props.Button>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {props.marketRegistryLoading
              ? "加载中..."
              : `共 ${props.marketRegistryResult?.total ?? 0} 条，当前 ${props.marketRegistryResult?.items.length ?? 0} 条`}
          </div>
          <div className="max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-border-dark">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-background-dark">
                <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 dark:text-slate-400">
                  <th className="px-2 py-1 text-left">选择</th>
                  <th className="px-2 py-1 text-left">代码</th>
                  <th className="px-2 py-1 text-left">名称</th>
                  <th className="px-2 py-1 text-left">自动拉取</th>
                </tr>
              </thead>
              <tbody>
                {(props.marketRegistryResult?.items ?? []).map((
                  item: InstrumentRegistryEntry
                ) => (
                  <tr
                    key={item.symbol}
                    className="border-b border-slate-200/70 dark:border-border-dark/70 last:border-b-0"
                  >
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={props.marketRegistrySelectedSymbols.includes(
                          item.symbol
                        )}
                        onChange={() =>
                          props.handleToggleRegistrySymbol(item.symbol)
                        }
                      />
                    </td>
                    <td className="px-2 py-1 font-mono">
                      {item.symbol}
                    </td>
                    <td className="px-2 py-1">
                      {item.name ?? "--"}
                    </td>
                    <td className="px-2 py-1">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.autoIngest}
                          onChange={(event) => {
                            void props.handleSetRegistryAutoIngest(
                              item.symbol,
                              event.target.checked
                            );
                          }}
                          disabled={props.marketRegistryUpdating}
                        />
                        <span>
                          {item.autoIngest ? "启用" : "禁用"}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
                {!props.marketRegistryLoading &&
                  (!props.marketRegistryResult ||
                    props.marketRegistryResult.items.length === 0) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-4 text-center text-slate-500 dark:text-slate-400"
                      >
                        --
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            手动拉取
          </h3>
        </div>

        <div className="rounded-md border border-slate-200 dark:border-border-dark bg-white dark:bg-gradient-to-b dark:from-panel-dark dark:to-surface-dark p-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <props.Button
              variant="primary"
              size="sm"
              icon="play_arrow"
              onClick={() => props.handleTriggerMarketIngest("targets")}
              disabled={props.marketIngestTriggering}
            >
              拉取目标池
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="play_arrow"
              onClick={() => props.handleTriggerMarketIngest("universe")}
              disabled={props.marketIngestTriggering}
            >
              拉取全市场
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="playlist_play"
              onClick={() => props.handleTriggerMarketIngest("both")}
              disabled={props.marketIngestTriggering}
            >
              全部拉取
            </props.Button>
            <props.Button
              variant="secondary"
              size="sm"
              icon="monitoring"
              onClick={() => props.setOtherTab("data-status")}
            >
              查看记录
            </props.Button>
          </div>
        </div>
      </section>
    </>
  );
}
