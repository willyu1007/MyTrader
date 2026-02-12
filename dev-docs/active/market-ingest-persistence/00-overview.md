# 00 Overview

## Task
- `market-ingest-persistence`

## Goal
- Ensure market ingest pipelines for `targets` and `universe` are persistable, schedulable daily, and observable under partial failures.

## Non-goals
- New data sources or module expansion.
- Unrelated frontend redesign.

## Current status
- `implemented`

## Current focus
- Validate runtime behavior in manual smoke and keep ops diagnostics documented.

## Deliverables
- IPC/API addition: `runIngestPreflight`.
- Orchestration flow: `preflight -> readiness -> run`.
- Failure observability before runner start.
- Updated dev-docs execution and verification records.
