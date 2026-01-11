# Context Awareness Add-on

## Purpose

This add-on provides a **stable, verifiable context contract** so an LLM can work with reliable project knowledge:

- API surface (OpenAPI)
- Database schema mapping (normalized JSON)
- Business processes (BPMN)
- Additional artifacts registered in a single registry

## Key invariants (MUST)

- `docs/context/` is the **only** supported entry point for "project context artifacts".
- `docs/context/registry.json` is the index for all context artifacts.
- Human collaborators and LLMs MUST use `node .ai/scripts/contextctl.js` to:
  - register new artifacts
  - update checksums
  - verify consistency

## Recommended enforcement

- Add the policy snippet in `AGENTS_SNIPPET.md` to your repo-level `AGENTS.md`.
- Add the CI step in `CI_SNIPPET.md` to enforce "script-only" changes.

## Verification

- `node .ai/scripts/contextctl.js verify --strict`
