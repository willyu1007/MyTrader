# Dashboard Modularization — Roadmap

## Goal
- 在严格行为不变前提下，将 `apps/frontend/src/components/Dashboard.tsx` 从超大单体重构为模块化结构，并将该入口文件收敛到 `<= 800` 行。

## Non-goals
- 不修改后端 IPC 合同或 shared DTO。
- 不引入新前端测试框架（Vitest/RTL）。
- 不做功能新增与交互语义变更。

## Open questions and assumptions
### Open questions (answer before execution)
- 无（已由用户在规划阶段确认）。

### Assumptions (if unanswered)
- 使用分阶段多 PR 落地（风险：low）。
- 保持 `App.tsx` 对 `./components/Dashboard` 的导入路径不变（风险：low）。

## Scope and impact
- Affected areas/modules:
  - `apps/frontend/src/components/Dashboard.tsx`
  - `apps/frontend/src/components/dashboard/**`
  - `dev-docs/active/dashboard-modularization/**`
- External interfaces/APIs:
  - `Dashboard` 组件对外 props 不变。
- Data/storage impact:
  - 无数据库、无迁移。
- Backward compatibility:
  - 通过兼容入口 `components/Dashboard.tsx` 维持现有导入方式。

## Milestones
1. **Milestone 1**: 文档与基线
   - Deliverable: `dashboard-modularization` 全套 docs + 基线验证记录
   - Acceptance criteria: `roadmap.md` 与 `00~05` 完整，含命令结果
2. **Milestone 2**: 兼容入口与容器迁移
   - Deliverable: `DashboardContainer` 新目录落地，`Dashboard.tsx` 作为兼容壳
   - Acceptance criteria: 导入路径不变，编译通过
3. **Milestone 3**: 原语/展示组件/工具函数拆分
   - Deliverable: `primitives/`、`components/`、`utils/` 目录可用并接线
   - Acceptance criteria: 行为不变，编译通过
4. **Milestone 4**: 领域 hooks 与视图层拆分
   - Deliverable: `hooks/`、`views/` 完成抽离并由容器编排
   - Acceptance criteria: 关键场景 smoke 通过
5. **Milestone 5**: 回归与交接
   - Deliverable: 验证矩阵结果 + handoff-ready 文档
   - Acceptance criteria: `typecheck/build/verify:theme` 通过，文档更新完成

## Step-by-step plan (phased)
> Keep each step small, verifiable, and reversible.

### Phase 0 — Discovery and docs setup
- Objective: 固化边界、基线与文档骨架。
- Deliverables:
  - `dev-docs/active/dashboard-modularization/{roadmap.md,00~05}`
- Verification:
  - docs 存在且内容完整
  - 基线命令执行并记录
- Rollback:
  - 回滚文档改动

### Phase 1 — Compatibility shell and module bootstrap
- Objective: 将现有 Dashboard 迁入模块目录并保持外部兼容。
- Deliverables:
  - `apps/frontend/src/components/dashboard/DashboardContainer.tsx`
  - `apps/frontend/src/components/dashboard/index.ts`
  - `apps/frontend/src/components/Dashboard.tsx` 兼容导出
- Verification:
  - `rg` 校验 `App.tsx` 导入路径不变
  - `typecheck/build` 通过
- Rollback:
  - revert 本阶段改动

### Phase 2 — Extract primitives/components/utils
- Objective: 把底部原语组件、展示组件、工具函数从容器文件拆出。
- Deliverables:
  - `primitives/`, `components/`, `utils/` 首批模块
- Verification:
  - 行为一致（手工 smoke）
  - `typecheck/build/verify:theme` 通过
- Rollback:
  - revert 该阶段分拆提交

### Phase 3 — Extract domain hooks
- Objective: 将状态与副作用按 UI/Portfolio/Market/Analysis 聚合。
- Deliverables:
  - `hooks/use-dashboard-*.ts`
- Verification:
  - `useEffect` 触发链无回归
- Rollback:
  - revert hooks 抽离提交

### Phase 4 — Extract view tree
- Objective: 按现有渲染边界拆分视图组件。
- Deliverables:
  - `views/` 与 `views/portfolio/` 分层组件
- Verification:
  - 导航切换与子 tab 行为一致
- Rollback:
  - 按视图粒度 revert

### Phase 5 — Final convergence and handoff
- Objective: 主入口精简、全量验证、文档可交接。
- Deliverables:
  - `Dashboard.tsx` 行数 `<= 800`
  - `03/04/05` 完整执行记录
- Verification:
  - 自动化命令全通过
  - 手工场景 A-F 通过
- Rollback:
  - 分阶段回滚

## Verification and acceptance criteria
- Build/typecheck:
  - `pnpm -C apps/frontend typecheck`
  - `pnpm -C apps/frontend build`
  - `pnpm -C apps/frontend verify:theme`
- Automated tests:
  - 无新增测试框架；依赖现有构建与主题契约校验
- Manual checks:
  - 导航/Portfolio/Analysis/Market/Other/Lock 核心流程
- Acceptance criteria:
  - `Dashboard` 外部接口与导入路径不变
  - `apps/frontend/src/components/Dashboard.tsx` <= 800 行
  - 自动化检查通过
  - 无新增 console error

## Risks and mitigations
| Risk | Likelihood | Impact | Mitigation | Detection | Rollback |
|---|---:|---:|---|---|---|
| hooks 依赖数组迁移造成时序回归 | med | high | 分领域渐进迁移 + 每阶段回归 | smoke + console | revert hooks 阶段 |
| props 透传层级增加复杂度 | med | med | 引入 view-model 类型并按域收敛 | typecheck + review | revert 视图阶段 |
| 市场视图体量大导致拆分冲突 | med | high | 先抽可复用组件，再抽 market 视图 | 编译失败/冲突频发 | revert market 子阶段 |
| 主题契约回流 | low | med | 每阶段执行 `verify:theme` | verify 失败 | revert 引入点 |

## Optional detailed documentation layout (convention)
If you maintain a detailed dev documentation bundle for the task, the repository convention is:

```
dev-docs/active/<task>/
  roadmap.md              # Macro-level planning (plan-maker)
  00-overview.md
  01-plan.md
  02-architecture.md
  03-implementation-notes.md
  04-verification.md
  05-pitfalls.md
```

The roadmap document can be used as the macro-level input for the other files. The plan-maker skill does not create or update those files.

Suggested mapping:
- The roadmap's **Goal/Non-goals/Scope** → `00-overview.md`
- The roadmap's **Milestones/Phases** → `01-plan.md`
- The roadmap's **Architecture direction (high level)** → `02-architecture.md`
- Decisions/deviations during execution → `03-implementation-notes.md`
- The roadmap's **Verification** → `04-verification.md`

## To-dos
- [x] Confirm open questions
- [x] Confirm milestone ordering and DoD
- [x] Confirm verification/acceptance criteria
- [x] Confirm rollout/rollback strategy
