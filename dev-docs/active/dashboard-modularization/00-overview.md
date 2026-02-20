# 00 Overview

## Status
- State: in-progress
- Next step: 继续把领域状态与副作用逐步下沉到 `hooks/`，并缩减超大透传对象，进一步削减 `DashboardContainer` 体量（当前 `4811` 行）。

## Goal
- 在不改变对外 API 与交互行为的前提下，将 Dashboard 从单文件重构为模块化结构，并将入口文件收敛到 `<= 800` 行。

## Non-goals
- 不改动 backend IPC 与 shared DTO。
- 不新增产品功能或交互语义。
- 不引入新的测试框架。

## Context
- 当前 `apps/frontend/src/components/Dashboard.tsx` 为超大单体组件，混合了：
  - 页面编排
  - 各领域状态与副作用
  - 大量 UI 原语/展示组件
  - 各类格式化与业务工具函数
- 该结构导致维护成本高、冲突概率高、回归定位困难。
- 现有基线（2026-02-10）已确认 `typecheck/build` 可通过，可作为拆分后回归基准。

## Acceptance criteria (high level)
- [x] `Dashboard` 对外 props 与导入路径保持不变。
- [x] `apps/frontend/src/components/Dashboard.tsx` 行数 `<= 800`。
- [x] `pnpm -C apps/frontend typecheck`、`build`、`verify:theme` 通过。
- [ ] 核心手工 smoke（导航/Portfolio/Analysis/Market/Other/Lock）通过。
- [x] `dev-docs/active/dashboard-modularization/` 文档可用于交接。
