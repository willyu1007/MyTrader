# Business Process Artifacts (BPMN)

## Purpose

Place BPMN 2.0 process definitions here (for example `order-fulfillment.bpmn`).

## Rules (MUST)

- Each `.bpmn` file MUST be registered in `docs/context/registry.json`.
- After editing a BPMN file, run:
  - `node .ai/scripts/contextctl.js touch`
  - `node .ai/scripts/contextctl.js verify --strict`
