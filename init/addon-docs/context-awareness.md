# Add-on: context awareness

## Conclusions (read first)

- Provides API/DB/BPMN contract management for LLM context
- AI uses context artifacts to understand project structure and contracts
- Enables consistent, auditable project context management

## Overview

This document describes the **context-awareness add-on** integration supported by the init pipeline.

The goal of the add-on is to introduce a consistent, auditable way to manage "project context" (contracts, snapshots, registries, etc.) while keeping the base template lightweight.

---

## How to enable

Enable using the blueprint switch below:

### blueprint.addons.contextAwareness
```json
{
  "addons": {
    "contextAwareness": true
  }
}
```

### Optional: blueprint.context.* (configuration only)
```json
{
  "context": {
    "mode": "contract"
  }
}
```

`context.*` does not install the add-on; it is only read after `addons.contextAwareness` is enabled.

Supported modes:
- `contract` (default)
- `snapshot`

---

## Where the add-on lives

Default payload location:

- `addons/context-awareness/payload/`

The init pipeline can be pointed to a different add-ons root directory via:

```bash
... apply --addons-root <path>
```

See `addon-docs/README.md`.

---

## What Stage C apply does when enabled

When context awareness is enabled, `apply` performs:

1) **Install (copy-if-missing)**
- Copy the payload into repo root (non-destructive, does not overwrite)

2) **Initialize (idempotent)**
- Run:

```bash
node .ai/scripts/contextctl.js init --repo-root <repoRoot>
```

- If `.ai/scripts/projectctl.js` exists, also run:

```bash
node .ai/scripts/projectctl.js init --repo-root <repoRoot>
node .ai/scripts/projectctl.js set-context-mode <contract|snapshot> --repo-root <repoRoot>
```

3) **Skill pack implication**
- If context awareness is enabled, the pipeline will also ensure the `context-core` skill pack is enabled.
  - In add-on repos (scheme A): through `.ai/scripts/skillsctl.js`
  - Otherwise: by adding the relevant includePrefixes to `.ai/skills/_meta/sync-manifest.json`

---

## Key scripts (typical add-on payload)

These scripts are expected/provided by the add-on payload:

- `.ai/scripts/contextctl.js`
  - `init`: create/validate `docs/context/` skeleton and registries (idempotent)

- `.ai/scripts/projectctl.js` (recommended)
  - `init`: initialize project-level state (idempotent)
  - `set-context-mode <contract|snapshot>`: select how context is collected

- `.ai/scripts/skillsctl.js` (scheme A, recommended in add-on repos)
  - `enable-pack <packId> --no-sync`: enable a pack and update the manifest
  - other subcommands depend on your add-on implementation

The init pipeline only requires `contextctl.js` for the add-on to be considered installed.

---

## Troubleshooting

### "payload not found"
If you see an error like:
- "Context awareness is enabled, but add-on payload is not found ..."

Confirm:
- `addons/context-awareness/payload/` exists
- or pass the correct root via `apply --addons-root <path>`

### "pack file is missing"
In add-on repos, skill pack enabling uses **pack definition files**:

- `.ai/skills/_meta/packs/<packId>.json`

If `context-core` (or any other requested pack) is missing, add the pack file or install the correct add-on payload version.
