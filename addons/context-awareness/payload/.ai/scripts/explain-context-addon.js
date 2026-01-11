#!/usr/bin/env node
/**
 * explain-context-addon.js - Quick Reference for Context Awareness Add-on
 *
 * Prints a summary of the context awareness add-on, its purpose,
 * and available commands.
 */

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                      Context Awareness Add-on                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  PURPOSE                                                                     ║
║  ───────                                                                     ║
║  This add-on provides a stable, verifiable context layer for AI/LLM          ║
║  interactions. Instead of ad-hoc repository scanning, the LLM reads          ║
║  from curated artifacts in docs/context/.                                    ║
║                                                                              ║
║  KEY FILES                                                                   ║
║  ─────────                                                                   ║
║  docs/context/INDEX.md          Entry point documentation                    ║
║  docs/context/registry.json     Canonical artifact index                     ║
║  docs/context/api/              API contracts (OpenAPI)                      ║
║  docs/context/db/               Database schema mappings                     ║
║  docs/context/process/          Business processes (BPMN)                    ║
║                                                                              ║
║  .ai/project/state.json         Project state and configuration              ║
║  .ai/skills/_meta/packs/        Skill pack definitions                       ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  AVAILABLE SCRIPTS                                                           ║
║  ─────────────────                                                           ║
║                                                                              ║
║  contextctl.js - Manage context artifacts and registry                       ║
║  ─────────────────────────────────────────────────────                       ║
║    init              Create docs/context/ skeleton (idempotent)              ║
║    add-artifact      Register a new artifact                                 ║
║    remove-artifact   Remove an artifact from registry                        ║
║    touch             Update checksums after editing files                    ║
║    verify            Verify registry consistency (use in CI)                 ║
║    list              List all registered artifacts                           ║
║                                                                              ║
║  projectctl.js - Manage project state                                        ║
║  ────────────────────────────────                                            ║
║    init              Initialize .ai/project/state.json                       ║
║    get <key>         Read a state value                                      ║
║    set <key> <val>   Write a state value                                     ║
║    set-context-mode  Set mode: contract or snapshot                          ║
║    verify            Validate project state                                  ║
║    show              Display current state                                   ║
║                                                                              ║
║  skillsctl.js - Manage skill packs                                           ║
║  ─────────────────────────────────                                           ║
║    list-packs        Show available packs                                    ║
║    enable-pack       Enable a pack (updates manifest + sync)                 ║
║    disable-pack      Disable a pack                                          ║
║    sync              Sync skill wrappers to providers                        ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  QUICK START                                                                 ║
║  ───────────                                                                 ║
║  1. node .ai/scripts/contextctl.js init                                      ║
║  2. node .ai/scripts/projectctl.js init                                      ║
║  3. node .ai/scripts/skillsctl.js enable-pack context-core --providers both  ║
║                                                                              ║
║  CI VERIFICATION                                                             ║
║  ───────────────                                                             ║
║  node .ai/scripts/contextctl.js verify --strict                              ║
║  node .ai/scripts/projectctl.js verify                                       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
