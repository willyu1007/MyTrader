# 00 Overview

## Status
- State: in_progress
- Last updated: 2026-02-20
- Upstream planning task: `dev-docs/active/tushare-cross-asset-coverage-planning/`
- Next step: 完成 P0 数据结构迁移草案（统一表 + P0 资产扩展表）并先打通股票 + ETF 的 Universe 入库回归。

## Goal
承接 `tushare-cross-asset-coverage-planning` 的定稿结论，落地 P0 实施：在不破坏现有链路的前提下，完成股票/ETF/指数（上下文）/期货/现货（SGE）的 Universe 入库、Target 消费与门禁回归。

## Non-goals
- 不在本任务中实现 P1（外汇/宏观）与 P2（权限/专题增强）
- 不接入分钟级/实时接口
- 不把 `stk_premarket` 纳入当前实施批次

## Scope (P0)
- 数据模型：一次建齐统一表 `instrument_master`、`basket_membership_daily`、`corporate_events`
- Universe：落地 P0 资产的接口拉取、标准化、幂等写入、run 统计
- Target：坚持 SSOT-first，按资产输出 `complete/partial/missing/not_applicable`
- 调度与可观测：纳入手动/定时/启动补跑/暂停恢复取消回归
- 质量门禁：覆盖率、关键字段空值率、主键冲突、时间语义

## Acceptance Criteria (P0)
- [ ] 统一表完成迁移并可被 P0 资产复用
- [ ] P0 资产 Universe 链路可跑通并具备可观测 run 记录
- [ ] Target 状态输出与规划口径一致（SSOT-first）
- [ ] P0 覆盖率达到 `complete + partial >= 95%`
- [ ] 关键字段空值率 <= 0.5%，主键冲突 = 0
- [ ] 调度控制（手动/定时/启动补跑/暂停恢复取消）回归通过
