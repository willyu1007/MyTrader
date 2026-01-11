# Project Context Index (LLM-first)

## Conclusions (read first)

- `docs/context/` is the **stable, curated context layer** for this repository.
- The canonical index of all context artifacts is `docs/context/registry.json`.
- When `docs/context/` exists, AI/LLM SHOULD prefer these artifacts over ad-hoc repository scanning.
- Any change to context artifacts MUST be accompanied by an updated registry checksum:
  - Run `node .ai/scripts/contextctl.js touch`
  - Verify with `node .ai/scripts/contextctl.js verify --strict`

## What lives here

Typical artifacts (not exhaustive):

- API contract: `docs/context/api/openapi.yaml`
- Database schema mapping: `docs/context/db/schema.json`
- Business processes: `docs/context/process/*.bpmn`

All artifacts MUST be registered in `docs/context/registry.json`.

## How to load context (for AI/LLM)

1. Open `docs/context/registry.json`.
2. Select only the artifacts needed for the current task.
3. Open those files by path (do not scan folders).

## How to update context (script-only)

Use `node .ai/scripts/contextctl.js`:

- Initialize (idempotent):
  - `node .ai/scripts/contextctl.js init`
- Register a new artifact:
  - `node .ai/scripts/contextctl.js add-artifact --id <id> --type <type> --path <repo-relative-path>`
- Update checksums after edits:
  - `node .ai/scripts/contextctl.js touch`
- Verify consistency (for CI):
  - `node .ai/scripts/contextctl.js verify --strict`

## Verification

- Registry and artifacts are consistent:
  - `node .ai/scripts/contextctl.js verify --strict`

