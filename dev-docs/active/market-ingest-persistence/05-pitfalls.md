# 05 Pitfalls

## Do-not-repeat summary
- Keep this file append-only for resolved issues encountered during implementation.

## Entries
- 2026-02-11
  - Symptom: Manual trigger could be blocked in UI by readiness check before orchestrator ran, leaving no `ingest_runs` failure evidence.
  - Root cause: Pre-trigger validation was performed outside orchestration failure-recording path.
  - Tried: Keep backend trigger hard-blocking with readiness check.
  - Fix/workaround: Move authoritative pre-run blocking/recording into orchestrator; frontend now uses preflight for user feedback, while orchestration persists blocked failures.
  - Prevention: Any future pre-run gate must either enqueue and be handled by orchestrator, or explicitly persist a failed run record before returning.
