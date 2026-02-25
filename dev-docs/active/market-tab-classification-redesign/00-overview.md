# 00 Overview

## Status
- State: planned
- Next step: confirm the v1 tab set/order and lock tab-preset mapping before implementation starts

## Goal
把当前 Market 从“股票中心 + 侧栏范围切换”升级为“单层顶部穷举分类 Tab（类似投资组合）”，让用户按资产类型一键切换展示。

## Non-goals
- 不在本任务内扩展新的行情数据源（继续以 Tushare 为主）
- 不在本任务内引入实时/分钟级行情
- 不重构 ingest scheduler / target pool 核心流程
- 不修改 Portfolio/Risk/Other 的交互模型

## Context
- 现状：Market 的 `marketScope` 主要表达数据来源（holdings/tags/search），筛选模型与文案明显偏股票。
- 现状：用户希望使用“顶部 tab 穷举分类”方式，不再引入一级分类。
- 约束：已有 Market 功能较多（搜索、自选、标签集合、详情图表、筛选弹层），改造必须避免回归。

## Acceptance criteria (high level)
- [ ] Market 新增单层顶部 Tab，且仅使用二级分类语义（不出现一级分类入口）
- [ ] Tab 切换后，列表与详情视图按预设分类一致更新
- [ ] `marketScope`（holdings/tags/search）仍可独立使用，不被 tab 机制破坏
- [ ] 现有筛选弹层仍可用，行为与 tab 组合后可解释
- [ ] 类型检查与构建通过，核心手工 smoke 用例通过
