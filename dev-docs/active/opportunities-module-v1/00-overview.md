# 00 Overview

## Status
- State: implemented_pending_qa
- Last updated: 2026-03-02
- Next step: 执行产品侧交互验收（5 tab 流程 + 边界提示文案）并根据反馈打磨。

## Goal
- 在 Dashboard 落地机会模块 5 个 tab：机会列表、自动识别、标的排序、多标的比对、自由比对。
- 打通本地可追溯闭环：规则定义 -> 日频运行 -> 信号消费 -> 对比分析 -> 工作台保存。

## Non-goals
- 首版不引入完整 DSL（仅模板 + 评分公式文本）。
- 首版不做策略回测联动写入。
- 首版不做跨设备同步。

## Acceptance criteria (high level)
- [x] 业务库 schema 支持 opportunities 全量实体。
- [x] shared IPC/preload/main 接通 `window.mytrader.opportunities`。
- [x] opportunities 视图替换 placeholder，并包含 5 个 tab。
- [x] 自由比对支持自动草稿 + 命名快照（上限 50）。
- [x] typecheck/build 通过，且新增 opportunities e2e smoke 通过。
