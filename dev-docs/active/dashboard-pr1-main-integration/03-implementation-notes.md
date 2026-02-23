# 03 Implementation Notes

## Status
- Current status: `in-progress`
- Last updated: 2026-02-22

## What changed
- 新建任务包并完成宏观 roadmap 与分批合并策略。
- 明确禁止整分支直合，采用“main 基线 + pr1 能力移植”的分批并集方案。
- 根据用户确认更新策略：不走 Dashboard 双轨、全部迁移合并、观察窗为 1 个交易日。
- 根据用户确认关闭 open questions：DuckDB 保持 `main` 基线；文档迁移采用“状态不回退”规则。
- Phase 0 已落地：
  - 新增基线守卫脚本：`scripts/verify-pr1-integration-guardrails.mjs`
  - 根脚本入口：`package.json` 增加 `verify:pr1-guardrails`
- Phase 1（低风险协议追加）已启动并落地第一批：
  - `packages/shared/src/ipc.ts` 追加 Source Center V2 / token matrix / readiness / preflight / universe pool / target task matrix 类型与 IPC channels（保留 rollout 兼容接口）
  - `apps/backend/src/preload/index.ts` 追加对应 market API 暴露（仅追加，不删除旧接口）
- Phase 2 已落地（backend Source Center V2）：
  - 新增文件：
    - `apps/backend/src/main/market/dataSourceCatalog.ts`
    - `apps/backend/src/main/market/connectivityTestService.ts`
    - `apps/backend/src/main/market/dataSourceReadinessService.ts`
    - `apps/backend/src/main/market/ingestPreflightService.ts`
    - `apps/backend/src/main/storage/marketDataSourceRepository.ts`
  - `apps/backend/src/main/storage/marketTokenRepository.ts` 升级为 main/domain token 矩阵，并保留 `getResolvedTushareToken/setTushareToken` 兼容入口
  - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 新增 Source Center V2 handlers（catalog/config/token matrix/connectivity/preflight/readiness），并保留 rollout handlers
- Phase 3（low-risk 子步）已落地：
  - 新增文件：
    - `apps/backend/src/main/market/universePoolBuckets.ts`
    - `apps/backend/src/main/market/targetTaskMatrixService.ts`
    - `apps/backend/src/main/market/targetTaskRepository.ts`
    - `apps/backend/src/main/market/targetMaterializationService.ts`
  - 增量 schema：
    - `apps/backend/src/main/market/marketCache.ts` 新增 `target_task_status` / `target_materialization_runs`（保留 `main` 的 fx/macro/ingest_runs 结构）
  - settings 并集：
    - `apps/backend/src/main/storage/marketSettingsRepository.ts` 追加 target-task matrix 配置与 universe pool 运行状态（不移除 rollout flags）
  - IPC 并集：
    - `apps/backend/src/main/ipc/registerIpcHandlers.ts` 追加 universe pool / target-task matrix / materialization handlers，并使用 data-source 配置桥接 legacy universe API
  - DuckDB 基线兼容：
    - `apps/backend/src/main/storage/analysisDuckdb.ts` 仅追加 `AnalysisDuckdbConnection` 类型别名导出（运行时保持 `main` 的 `@duckdb/duckdb-wasm`）
    - `targetMaterializationService.ts` 通过 `information_schema` 探测可选扩展表，避免要求 `main` 基线必须存在 `futures_daily_ext` / `spot_sge_daily_ext`
  - shared/frontend 兼容补丁：
    - `packages/shared/src/ipc.ts` 扩展 `AssetClass` 到 `stock|etf|futures|spot|cash`
    - `apps/frontend/src/components/Dashboard.tsx` 补全 `assetClassLabels` 映射
- Phase 3（high-risk 子步）已落地第一批（runner/provider 并集）：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - futures/spot 产出 `assetClass`
    - 自动追加 universe pool tags（`pool:cn_a|etf|metal_futures|metal_spot`）
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - Universe ingest 接入 data source config -> legacy buckets
    - 按 selected buckets + profile tags 过滤 stock/etf/futures/spot universe
    - ingest run meta 增加 `selectedBuckets` / `bucketCounts`
    - 执行后回写 `updateMarketUniversePoolBucketStates`
  - 兼容策略：
    - 保留 `main` 的 index/forex/macro/recovery/stale-run 稳定路径，只在 bucket 相关路径做增量并集
- Phase 3（high-risk 子步）已落地第二批（orchestrator -> targets materialization 主流程）：
  - `apps/backend/src/main/market/ingestOrchestrator.ts`
    - targets 任务执行时传入 `analysisDbPath`
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - targets ingest 完成后自动执行 `materializeTargetsFromSsot`
    - materialization 结果写入 ingest run meta（`targetMaterialization`）
    - materialization 失败按非致命处理并记录错误（run 状态会反映为 partial）
- Phase 5 已落地（Dashboard 模块化直接切换，非双轨）：
  - `apps/frontend/src/components/Dashboard.tsx` 切换为模块入口转发（不再使用单体文件）
  - 新增模块化目录 `apps/frontend/src/components/dashboard/*`（views/hooks/primitives/components）
  - `apps/frontend/scripts/verify-theme-contract.mjs` 兼容模块化入口校验
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementSourceSection.tsx` 清理颜色字面量以满足主题契约
- Phase 6（今日收口）已落地：
  - `scripts/verify-pr1-integration-guardrails.mjs` 增强为“今日闭环门禁”，新增检查：
    - Dashboard 模块化单路径（非双轨）入口与关键目录存在
    - targets materialization 已接入托管 ingest 主流程
    - dual-pool 过滤链路（provider 标签 + runner bucket 执行 + pool 状态回写）完整
  - 说明：用户于 2026-02-22 明确接受“可使用历史数据完成工程闭环”；据此执行历史窗口 gate snapshot 验收并完成任务收口。
  - 历史验收证据：
    - `dev-docs/active/dashboard-pr1-main-integration/evidence/2026-02-22-history-gate-snapshot.json`

## Files/modules touched (high level)
- `dev-docs/active/dashboard-pr1-main-integration/*`
- `scripts/verify-pr1-integration-guardrails.mjs`
- `package.json`
- `packages/shared/src/ipc.ts`
- `apps/backend/src/preload/index.ts`
- `apps/backend/src/main/ipc/registerIpcHandlers.ts`
- `apps/backend/src/main/storage/marketTokenRepository.ts`
- `apps/backend/src/main/storage/marketDataSourceRepository.ts`
- `apps/backend/src/main/market/dataSourceCatalog.ts`
- `apps/backend/src/main/market/connectivityTestService.ts`
- `apps/backend/src/main/market/dataSourceReadinessService.ts`
- `apps/backend/src/main/market/ingestPreflightService.ts`
- `apps/backend/src/main/market/universePoolBuckets.ts`
- `apps/backend/src/main/market/targetTaskMatrixService.ts`
- `apps/backend/src/main/market/targetTaskRepository.ts`
- `apps/backend/src/main/market/targetMaterializationService.ts`
- `apps/backend/src/main/market/marketCache.ts`
- `apps/backend/src/main/market/marketIngestRunner.ts`
- `apps/backend/src/main/market/ingestOrchestrator.ts`
- `apps/backend/src/main/market/providers/tushareProvider.ts`
- `apps/backend/src/main/storage/analysisDuckdb.ts`
- `apps/backend/src/main/storage/marketSettingsRepository.ts`
- `apps/frontend/src/components/Dashboard.tsx`
- `apps/frontend/src/components/dashboard/*`
- `apps/frontend/scripts/verify-theme-contract.mjs`

## Decisions & tradeoffs
- Decision: 先迁移业务能力，后切 Dashboard 结构。
  - Rationale: 将功能风险与结构风险解耦，减少单批次爆炸半径。
  - Alternatives considered: 直接 merge `pr1`（放弃，风险过高）。

- Decision: 保留 rollout flags 兼容接口。
  - Rationale: `main` 收口与门禁仍依赖该链路进行稳定性保障。
  - Alternatives considered: 立即删除兼容（放弃，存在回退风险）。

## Deviations from plan
- None.

## Known issues / follow-ups
- 需要在实施阶段把 42 个提交映射到最终 PR 批次（可能不是原 commit 粒度）。
- 进入 Phase 6 后需补齐 1 个交易日观察记录（稳定性验收 evidence）。

## Pitfalls / dead ends (do not repeat)
- 详见 `05-pitfalls.md`。

## 2026-02-22 Reopen: 全量池基线回收（按 tushare-rollout-closure）
- 触发背景：线上观察到 `targets ingest` 持续长跑并反复出现 futures 标的失败日志（示例：`CS1903.DCE`），用户明确要求“全量池的数据类型/表格/抓取对象以 `tushare-rollout-closure` 为准”。
- 本次回收动作（最小集）：
  - `apps/backend/src/main/market/marketIngestRunner.ts`
    - 恢复为 closure 语义：
      - 去除 Universe ingest 的 `selectedBuckets` 过滤链路与 bucket state 回写。
      - 去除 targets ingest 自动 materialization 绑定（回到 closure 的纯 targets 抓取语义）。
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - futures/spot `assetClass` 回归 `null`（不再作为 targets 自动抓取资产类型）。
    - 去除 universe pool tag 自动注入（回归 closure provider 行为）。
  - `apps/backend/src/main/market/ingestOrchestrator.ts`
    - 移除 targets 任务对 `analysisDbPath` 的传递（与 closure targets 路径对齐）。
  - `apps/backend/src/main/market/marketRepository.ts`
    - `listAutoIngestItems` 收紧为 `asset_class in ('stock','etf')`，防止历史脏数据进入 targets 抓取对象。
  - `apps/backend/src/main/market/targetsService.ts`
    - `resolveAutoIngestItems` 仅输出 `stock/etf` 抓取对象（未知/其他资产类型不再默认降级为 stock）。
  - `apps/backend/src/main/market/marketCache.ts`
    - 增加兼容迁移：启动时将 `instruments.asset_class in ('futures','spot')` 归一化为 `null`。
    - 移除 `target_task_status` / `target_materialization_runs` 的 schema 创建步骤（回归 closure 的 market cache 表结构基线）。
- 运行态纠偏（本地账户数据）：
  - 执行一次性 SQL：`update instruments set asset_class = null where asset_class in ('futures','spot')`。
  - 纠偏后核对：`auto_ingest=1` 且 `asset_class in ('stock','etf')` = `5491`，`futures/spot` = `0`。
- 稳定性补丁（防止 ingest 长时间 running）：
  - `apps/backend/src/main/market/tushareClient.ts`
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
  - 为 TuShare HTTP 调用增加 20s abort 超时；超时统一抛出明确错误，避免单请求无响应导致队列长期占用。
- UI/运行口径解耦修正（回应“目标池编辑应为 2 万+ 标的”）：
  - `apps/backend/src/main/market/targetsService.ts` 改为在“目标池编辑预览”阶段读取全量 `auto_ingest` symbols（不再受抓取资产类型过滤）。
  - `apps/backend/src/main/market/marketRepository.ts` 新增 `listAutoIngestSymbols`。
  - 结果：编辑口径恢复全量；执行口径仍由 `resolveAutoIngestItems` 限制为 `stock/etf`，避免 futures/spot 抓取报错风暴。
- 标的结构看板修复（2026-02-22）：
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-target-pool-stats.ts`
  - 当 `pool:*` 标签成员汇总为 0 时，自动回退到 `market.previewTargets()` 作为 universe symbols 口径，避免“全量标的=0”的空板问题。
  - 分类统计仍沿用分类标签成员并与 universe symbol 集求交，保证指标语义一致。

## 2026-02-22 Follow-up: 口径收敛（full-pool 默认全开）与新库 schema 断链修复
- 触发背景：用户确认“全量池正常不需要额外配置（除子 token 外）”，并要求确认图片中的 P1 风险是否真实。
- 已落地改动：
  - `apps/backend/src/main/market/marketCache.ts`
    - 恢复 `target_task_status` / `target_materialization_runs` 两张表及索引 DDL（`create table/index if not exists`）。
    - 目的：消除新建库/新环境在目标任务状态写入时的 schema 断链风险。
  - `scripts/verify-pr1-integration-guardrails.mjs`
    - 门禁从“PR1 双池 + managed-ingest 强接入”口径，收敛为“closure 基线 + 可用性”口径：
      - 保留 `main` 基线与 Dashboard 模块化断言；
      - materialization 改为校验 IPC 手动路径 + schema 可用；
      - 明确不再要求 `selectedBuckets/updateMarketUniversePoolBucketStates` 接入 managed ingest；
      - 明确 futures/spot 不再作为 targets 自动抓取资产类型。
  - `apps/frontend/src/components/dashboard/hooks/use-dashboard-market-target-pool-stats.ts`
    - 当 `pool:*` 标签未命中时，优先回退到 `listInstrumentRegistry` 分页拉全量 symbols（而非直接回退到 `previewTargets`）。
    - 目的：结构看板“全量标的”在无 pool 标签场景下仍可反映全量池口径（2 万+），避免被目标池口径误缩小。
- 结果：
  - `verify:pr1-guardrails` 恢复通过，且语义与当前 `tushare-rollout-closure` 基线一致；
  - 新库初始化不再缺失 target-task 相关表。

## 2026-02-23 Follow-up: 分类链路补齐（SW L2 + 概念）与全量目录默认收起
- 触发背景：
  - 用户反馈“结构看板二级行业/概念为 0”，并要求补齐链路；
  - 用户同时要求“全量数据池目录默认收起”。
- 已落地改动：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - `fetchInstrumentCatalog` 新增股票分类增强链路，保持“可选能力、失败不阻断主流程”：
      - 申万行业链路：`index_classify` + `index_member_all`（失败时回退 `index_member`）；
      - 概念链路：`concept` + `concept_detail`（全量失败时回退按概念编码拉取）；
    - 股票 profile 标签增强：
      - 新增 `ind:sw:l1:<name>` / `ind:sw:l2:<name>`；
      - 新增 `concept:<name>`，并兼容写入 `theme:ths:<name>`；
      - `providerData` 增补 `swIndustry` 与 `concepts` 字段，便于后续排查与审计。
  - `apps/backend/src/main/market/providers/tushareBulkFetch.ts`
    - 为分页 TuShare 调用补齐 20s HTTP 超时（AbortController），避免分类链路引入长时间挂起风险。
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementSourceSection.tsx`
    - `directoryPanelExpanded` 默认值调整为 `false`，即“全量数据池目录默认收起”。
- 当前状态：
  - 代码链路已补齐并通过类型/门禁验证；
  - 运行态要看到二级行业/概念统计恢复，仍需触发一次 universe catalog 同步以回填新标签。

## 2026-02-23 Follow-up #2: L1-L2 关联修正与概念链路增强回退
- 触发背景：
  - 运行态核对发现 `ind:sw:l2:*` 已落库（124 类），但 `ind:sw:l1:*` 为 0；
  - `concept:*` 仍为 0，导致概念分类卡片空值。
- 已落地改动：
  - `apps/backend/src/main/market/providers/tushareProvider.ts`
    - SW 行业：
      - `index_classify` 改为多参数聚合拉取（`src + level(L1/L2)`），并合并节点；
      - 兼容更多 level 表示（`L1/L2`、数字、中文一级/二级）；
      - 当 `parent_code` 缺失时，按申万代码规则回退推导 L1 code（例如 `801783.SI -> 801780.SI`）。
    - 概念：
      - 保留原 `concept + concept_detail` 主链路；
      - 新增 `ths_index + ths_member` 回退链路（当主链路为空时启用），并保持 active member 过滤。
    - 目标：保证在不同 token 权限/接口可用性条件下，尽可能回填 `ind:sw:l1` 与 `concept` 标签，减少“有 L2 无 L1、概念全空”的概率。

## 2026-02-23 Follow-up #3: 全量池入口收口（去重）
- 触发背景：
  - 用户反馈“全量池配置重复”，同一页面同时存在：
    - Source Center 的“全量数据池目录”（目录/域模块配置入口）；
    - Target Pool 区块的“全量池配置”（legacy bucket 卡片入口）。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetPoolSection.tsx`
    - 移除 `OtherDataManagementUniversePoolPanel` 依赖与整段“全量池”渲染；
    - 收敛为仅保留“目标池编辑”区块。
  - `apps/frontend/src/components/dashboard/views/other/OtherDataManagementTab.tsx`
    - 移除向 `OtherDataManagementTargetPoolSection` 透传的 legacy universe pool props。
  - `apps/frontend/src/components/dashboard/views/OtherView.tsx`
    - 移除 `dataManagementTabProps` 中 legacy universe pool 相关透传字段。
  - 删除死代码文件：
    - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementUniversePoolPanel.tsx`
- 结果：
  - UI 层“全量池配置”仅保留 Source Center 单入口，消除重复配置点与覆盖歧义；
  - 后端 legacy IPC 兼容路径仍保留（未破坏兼容），本次仅做前端入口收口。

## 2026-02-23 Follow-up #4: 目标任务矩阵可用性收敛（命名/信息架构）
- 触发背景：
  - 用户反馈“目标任务矩阵”术语与操作路径困惑，要求：
    - 名称改为“目标池数据完备性”；
    - 定义信息改为问号悬停提示，不默认展示；
    - “缺口回补窗口”先隐藏；
    - 状态明细默认收起。
- 已落地改动：
  - `apps/frontend/src/components/dashboard/views/other/data-management/OtherDataManagementTargetTaskPanel.tsx`
    - 标题改名为“目标池数据完备性”；
    - 增加问号提示（`title`/`aria-label`）承载定义文案；
    - “完备性模块配置”区仅保留模块开关，隐藏 `defaultLookbackDays` 输入；
    - 状态明细区新增折叠开关，默认 `collapsed`，仅展开时加载/刷新状态；
    - 保存提示文案调整为“完备性配置已保存”，加载文案改为“完备性面板加载中...”。
- 结果：
  - 交互主路径从“技术矩阵配置 + 全量状态表”收敛为“总览 + 物化 + 按需排障”；
  - 保持后端能力与配置结构不变，属于纯前端可用性收敛，无数据格式变更风险。
