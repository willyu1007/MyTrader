# 01 Plan

## Milestones
### Milestone 1: Tab taxonomy and state contract
- Acceptance
  - 明确 v1 Tab 集合与顺序
  - 明确每个 Tab 的预设过滤条件（market/assetClass/kind）
  - 明确与 `marketScope` 的关系（正交，不互相替代）

### Milestone 2: UI integration in Market header area
- Acceptance
  - 在 Market 页面头部接入顶部 Tab（视觉模式对齐 Portfolio）
  - 支持横向滚动和键盘可达
  - 切换无明显闪烁或布局抖动

### Milestone 3: Tab-driven filtering behavior
- Acceptance
  - 每个 Tab 能稳定映射到预期的列表结果
  - 空数据有明确解释文案
  - 手动筛选与 tab 组合时行为一致、可预测

### Milestone 4: Verification and rollout notes
- Acceptance
  - 类型检查与构建通过
  - 手工 smoke 全部通过
  - 回退策略文档化

## Detailed steps
1. 定义 `MarketCategoryTab` 类型与 tab 常量（包含 label/icon/preset）。
2. 在 Market 状态层引入 `activeMarketCategoryTab`，接入容器层状态传递。
3. 在布局层新增 Market 顶部 Tab 渲染（与 Portfolio Tab 样式复用）。
4. 在派生层把 tab preset 合并进现有过滤逻辑。
5. 校正 Sidebar/Dialogs 文案与默认行为，避免 scope 与 tab 混淆。
6. 补充手工验证脚本与结果记录。

## Risks & mitigations
- Risk: tab preset 与筛选弹层冲突，导致“看起来没数据”。
  - Mitigation: 明确优先级并在 UI 显示当前筛选来源（tab preset + manual filters）。
- Risk: 当前数据覆盖不足导致非股票 tab 空白率高。
  - Mitigation: 先提供可解释空状态；必要时对低覆盖 tab 做禁用或 beta 标识。
- Risk: 与 `marketScope` 混用导致逻辑分叉难维护。
  - Mitigation: 在类型和注释层明确“tab=分类、scope=来源”，并在 derived 中统一收口。
