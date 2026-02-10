# 05 Pitfalls (do not repeat)

This file exists to prevent repeating mistakes within this task.

## Do-not-repeat summary (keep current)
- 拆分时不要改变 `Dashboard` 对外导出与 `App.tsx` 导入路径。
- 抽离 `useEffect` 时必须保持依赖表达式与触发条件语义一致。
- 每个大阶段结束必须跑 `typecheck/build/verify:theme`。
- 在 macOS 默认大小写不敏感文件系统下，`Dashboard.tsx` 内不得使用 `./dashboard` 裸路径导入（会和自身冲突）。
- 主题校验脚本提取函数块时要兼容 `export function`，否则会产生误报。
- 基于固定行号做“大段删除”前，必须先重新定位锚点（行号会因前置改动漂移）。

## Pitfall log (append-only)

### 2026-02-10 - task bootstrap
- Symptom:
  - N/A
- Context:
  - 初始化文档阶段。
- What we tried:
  - 建立标准 bundle 并先落 baseline。
- Why it failed (or current hypothesis):
  - N/A
- Fix / workaround (if any):
  - N/A
- Prevention (how to avoid repeating it):
  - 后续按 phase 追加真实坑位与修复策略。
- References (paths/commands/log keywords):
  - `dev-docs/active/dashboard-modularization/*`

### 2026-02-10 - re-export self-reference on case-insensitive FS
- Symptom:
  - `typecheck/build` 报循环导出：`Dashboard` reexport references itself。
- Context:
  - 将 `Dashboard.tsx` 改为壳文件后，使用了 `export { Dashboard } from "./dashboard";`。
- What we tried:
  - 先直接保留目录短路径导入。
- Why it failed (or current hypothesis):
  - 在大小写不敏感文件系统里，`./dashboard` 会被解析成同目录 `Dashboard.tsx`，触发自引用。
- Fix / workaround (if any):
  - 改成显式路径：`./dashboard/index`。
- Prevention (how to avoid repeating it):
  - 与当前文件仅大小写差异的目录名，必须使用显式 `index` 文件路径避免解析歧义。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/Dashboard.tsx`
  - `pnpm -C apps/frontend typecheck`
  - `pnpm -C apps/frontend build`

### 2026-02-10 - verify-theme false positives after export conversion
- Symptom:
  - `verify:theme` 误报所有 primitive 含 `dark:`。
- Context:
  - 将容器内函数声明批量改为 `export function` 后，校验脚本仍按 `\\nfunction` 寻找下一个函数边界。
- What we tried:
  - 直接运行脚本，观察误报聚集在 primitive 检查段。
- Why it failed (or current hypothesis):
  - 函数块提取器未识别 `export function`，导致截取范围过大。
- Fix / workaround (if any):
  - 更新脚本正则，兼容 `(?:export\\s+)?(?:async\\s+)?function`。
- Prevention (how to avoid repeating it):
  - 调整函数声明风格后，同步检查静态分析脚本的语法匹配假设。
- References (paths/commands/log keywords):
  - `apps/frontend/scripts/verify-theme-contract.mjs`
  - `pnpm -C apps/frontend verify:theme`

### 2026-02-10 - line-number drift caused partial JSX truncation
- Symptom:
  - `typecheck/build` 报多个 JSX 未闭合、文件意外 EOF。
- Context:
  - 为迁移尾部定义，按旧行号截断 `DashboardContainer.tsx`，但文件顶部 import 已新增，导致锚点漂移。
- What we tried:
  - 直接按固定行号截断并覆盖文件。
- Why it failed (or current hypothesis):
  - 行号不是稳定锚点，前置改动会使“删除起点”提前，截断到仍在 JSX 结构中的位置。
- Fix / workaround (if any):
  - 手动补全被截断的 modal/notification 收尾结构并恢复组件闭合。
  - 后续改用稳定文本锚点（如 `// --- UI Components ---`）做分段迁移。
- Prevention (how to avoid repeating it):
  - 大段删除前先 `rg -n` 定位锚点；严禁依赖历史行号。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
  - `pnpm -C apps/frontend typecheck`
  - `pnpm -C apps/frontend build`

### 2026-02-10 - extracting view blocks introduced global-name collisions
- Symptom:
  - `typecheck` 报 `Property 'selectedMethod' does not exist on type 'Performance'`。
- Context:
  - `DataAnalysisView` 提取后未透传局部变量 `performance`，触发了 DOM 全局 `performance` 名称回退。
- What we tried:
  - 先只补全 `Cannot find name` 错误项。
- Why it failed (or current hypothesis):
  - 某些标识符在全局环境有同名对象，不会报 `Cannot find name`，但会被错误绑定到全局类型。
- Fix / workaround (if any):
  - 显式透传并解构 `performance`，覆盖全局同名对象。
- Prevention (how to avoid repeating it):
  - 迁移视图时，不仅检查 `Cannot find name`，还要关注“被全局同名吞掉”的类型异常。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/views/DataAnalysisView.tsx`
  - `pnpm -C apps/frontend typecheck`

### 2026-02-10 - auto-insert script failed to replace empty destructuring block
- Symptom:
  - 已执行脚本但 `const { } = props;` 仍为空，导致大量 `Cannot find name` 未消失。
- Context:
  - `OtherView` 批量提取后，尝试用正则替换解构块。
- What we tried:
  - 使用宽松正则匹配并替换 `const { ... } = props`。
- Why it failed (or current hypothesis):
  - 提取文件格式变化导致正则未命中预期区段。
- Fix / workaround (if any):
  - 改为精确字面替换 `const {\\n  } = props;`，再回填完整依赖集合。
- Prevention (how to avoid repeating it):
  - 对关键替换步骤，脚本后立即断言目标片段是否变化（例如检查 `const {` 后是否包含预期依赖名）。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/views/OtherView.tsx`
  - `/tmp/mytrader_tsc_other.out`

### 2026-02-10 - extracted Market view lost local type alias context
- Symptom:
  - `MarketView` 拆分后报 `Cannot find name 'MarketChartRangeKey'`。
- Context:
  - 原块中存在 `as MarketChartRangeKey` 断言，类型定义留在容器文件内。
- What we tried:
  - 先仅补 value 级依赖透传。
- Why it failed (or current hypothesis):
  - 类型标识符不会通过 value 透传获得。
- Fix / workaround (if any):
  - 在当前阶段将断言改为 `as any` 保持行为不变并先通过编译；后续在类型收敛阶段再恢复强类型。
- Prevention (how to avoid repeating it):
  - 视图迁移时分开检查 value 依赖与 type 依赖，类型依赖要么单独导入要么同步迁移类型定义。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/views/MarketView.tsx`
  - `/tmp/mytrader_tsc_market.out`

### 2026-02-10 - component extraction causes cascading TS6133 in container
- Symptom:
  - 提取 overlay 后，容器出现大量 `TS6133`（变量声明未使用）。
- Context:
  - 原先在容器 JSX 里使用的值，迁移到子组件后不再直接引用。
- What we tried:
  - 先仅替换 JSX，不透传依赖。
- Why it failed (or current hypothesis):
  - TS 严格模式会将“仅在子组件内需要的变量”视为容器未使用。
- Fix / workaround (if any):
  - 使用统一 props 透传对象（`{...{...}}`）将依赖显式传入子组件。
- Prevention (how to avoid repeating it):
  - 每次提取视图后，先运行一次 `typecheck`，按 `TS6133 + Cannot find name` 双清单一起回填透传。
- References (paths/commands/log keywords):
  - `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
  - `apps/frontend/src/components/dashboard/views/DashboardOverlays.tsx`
  - `/tmp/mytrader_tsc_overlays.out`
