# 00-overview

## Goal
- 实现估值方法 2.0：主客观输入分层、客观自动刷新、主观默认+按标的覆盖、观点算子叠加。

## Non-goals
- 本轮不扩展到非股票资产完整方法体系。
- 本轮不重写观点冲突规则（沿用 stage/priority 机制）。

## Scope
- shared IPC 合约
- backend schema/repository/service/scheduler
- provider + ingest 数据扩展
- frontend 方法管理与标的详情估值入口

## Status
implemented

## Current focus
- 回归与验收记录归档（typecheck/build/e2e + UI 手工验收待联调）。
