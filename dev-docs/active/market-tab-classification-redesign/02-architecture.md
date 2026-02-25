# 02 Architecture

## Context & current state
- Market 当前核心概念：
  - `marketScope = holdings | tags | search`（来源维度）
  - `marketFilterMarket / marketFilterAssetClasses / marketFilterKinds`（筛选维度）
- 当前问题：来源维度与展示分类耦合不足，且默认口径偏 `CN + stock/etf`，对跨资产展示不友好。

## Proposed design

### Components / modules
- `DashboardContainerLayout`
  - 新增 `activeView === "market"` 的顶部 tab 区域（复用 Portfolio tab 交互样式）
- `DashboardContainer`
  - 持有并下发 `marketCategoryTab`（或由 market hook 暴露）
- `use-dashboard-market`
  - 增加分类 tab 状态与更新函数
- `constants.ts`
  - 增加 `marketCategoryTabs` 和 `marketCategoryPresets`
- `use-dashboard-market-derived`
  - 合并 tab preset 与手动筛选，输出最终 symbol 集合

### Interfaces & contracts
- UI state contract (frontend only, v1)
  - `type MarketCategoryTab = "cn-stock" | "cn-etf" | "cn-index" | "futures" | "spot" | "watchlist"`
  - `marketCategoryPresetMap[tab] => { market, assetClasses, kinds, scopeHint }`
- Existing IPC contracts
  - v1 不要求新增或破坏 IPC
  - 仍复用现有 `search/list quotes/tag members` 等链路
- Optional phase-2 contract
  - 可新增 category capability metadata（用于禁用无数据能力 tab）

### Boundaries & dependency rules
- Allowed dependencies:
  - Tab state can drive filter defaults and optional scope hints
  - Existing sidebar/search/filter modal remains usable
- Forbidden dependencies:
  - 不允许把 `marketScope` 重定义为 tab 分类
  - 不允许在 v1 强耦合后端 schema 变更

## Data migration (if applicable)
- Migration steps:
  - 无数据库迁移
  - 可选：新增 localStorage key 存储上次 tab
- Backward compatibility strategy:
  - 若 localStorage 无值，默认回退到 `cn-stock`
  - 保留原有筛选和 scope 行为
- Rollout plan:
  - 先在本地验证全部 tab 流程
  - 若有回归，优先回退 tab->preset 绑定逻辑

## Non-functional considerations
- Security/auth/permissions:
  - 无新增权限面
- Performance:
  - tab 切换触发的过滤应为轻量计算；避免重复发起不必要行情请求
- Observability (logs/metrics/traces):
  - 前端可选 debug 日志：tab 切换、最终过滤条件、结果计数

## Open questions
- v1 是否纳入 `option` tab（当前建议 defer）
- `watchlist` tab 是否固定映射到 `tags + watchlist:all`
- 手动筛选在切 tab 时是“保留”还是“重置”
