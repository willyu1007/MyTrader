# 00 Overview

## Status
- State: in_progress
- Progress: 已完成七大资产口径对齐、全资产整体梳理（权限基线、数据关联、整合建模、双池分工）以及 P0/P1/P2 批次门禁定稿；并完成本地 token 实测，确认 `stk_premarket` 当前无权限（40203）且已从当前规划排除；统一表已确认在 P0 一次建齐，宏观 `available_date` 滞后规则已定稿。
- Next step: 进入实施阶段，执行承接任务 `dev-docs/active/tushare-cross-asset-rollout/`，按批次完成 P0/P1/P2 的模块开发与回归。

## Goal
基于 Tushare 对齐并落地多资产数据池部分覆盖范围，兼顾可用性与迭代效率。

## Non-goals
- 一次性做全量接口接入
- 分钟级/实时全覆盖
- 非 Tushare 数据源联动

## Scope
- 覆盖类型：股票、ETF、指数、期货、现货、外汇、宏观经济
- 产出：覆盖清单、模块映射、分期实施与验收标准

## DoD
- [x] 每类资产完成 L1/L2 子类确认
- [x] 形成可执行的接口与存储映射清单
- [x] 形成分期落地与回归验收方案
