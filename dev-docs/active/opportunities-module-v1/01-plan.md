# 01 Plan

## Milestones
### Milestone 1: Schema + IPC contract
- 新增 opportunities 相关表与 shared 类型/通道。
- preload/main handlers 完成最小可调用路径。

### Milestone 2: Backend service + scheduler
- 规则 CRUD、run logs、信号生命周期、排序、比对、草稿与快照。
- 日频调度：数据更新触发 + 定时兜底。

### Milestone 3: Frontend 5 tabs
- Dashboard opportunities 视图替换 placeholder。
- 5 个 tab 的核心交互全部接后端。

### Milestone 4: Verification
- `pnpm typecheck`、`pnpm build`。
- `verify:opportunities-e2e` 冒烟覆盖核心路径。

## Risks & mitigations
- Risk: 表达式执行带来安全/稳定风险。
  - Mitigation: 白名单变量 + 受限算子函数 + 禁止对象访问。
- Risk: 数据域不完整导致规则大量空结果。
  - Mitigation: 自动降级到 holdings+watchlist，并记录降级原因。
