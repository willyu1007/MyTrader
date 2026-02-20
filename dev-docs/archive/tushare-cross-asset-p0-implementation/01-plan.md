# 01 Plan

## Milestones
1. M1: P0 schema and migration baseline
- Deliverables:
  - 统一表迁移（`instrument_master`、`basket_membership_daily`、`corporate_events`）
  - P0 资产扩展表与索引迁移草案
  - 回滚开关与迁移顺序说明
- Acceptance:
  - 迁移可重复执行且幂等
  - 无历史数据破坏，旧链路可回退

2. M2: Universe ingestion rollout (P0)
- Deliverables:
  - 股票/ETF/指数（上下文）/期货/现货（SGE）接口采集与标准化写入
  - `inserted/updated/errors` 统计统一
  - 关键字段口径与单位对齐
- Acceptance:
  - 每类资产至少 1 次全量 + 1 次增量成功
  - 失败路径有可读错误摘要，不泄露 token

3. M3: Target SSOT-first consumption and status
- Deliverables:
  - Target 从 SSOT 消费，禁止默认直拉 provider
  - 各资产模块状态按规划规则输出
- Acceptance:
  - 任一模块状态可追溯到具体 SSOT 数据缺口
  - 指数以“上下文模式”稳定供给股票/ETF

4. M4: Scheduler + observability regression
- Deliverables:
  - 手动/定时/启动补跑/暂停/恢复/取消全链路回归
  - 覆盖率与质量门禁报表
- Acceptance:
  - 连续 3 个交易日 run 无阻断错误
  - 覆盖率、空值率、主键冲突满足门禁

5. M5: Handoff and archive readiness
- Deliverables:
  - 完整验证记录、风险与回滚手册
  - 未解决问题清单与后续任务建议（P1/P2）
- Acceptance:
  - `04-verification.md` 可直接支撑归档决策

## Execution Order
1. 先打通股票 + ETF（主链路）
2. 再接入指数上下文（成员/权重/市场背景）
3. 再接入期货 + 现货（走势辅助链路）
4. 最后统一回归调度与门禁

## Risks and Mitigations
- Risk: P0 资产并行接入导致调度窗口超时
- Mitigation: 分资产批次运行 + 并发窗口限制 + checkpoint

- Risk: 指数/成分关系数据过大导致写入抖动
- Mitigation: 按交易日分片写入 + 幂等 upsert + 分段回放

- Risk: 统一表迁移影响历史查询
- Mitigation: 先镜像落表再切读路径，保留开关回滚
