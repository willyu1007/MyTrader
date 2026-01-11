# Database Mirror Add-on

## Conclusions (read first)

- Provides database schema mirroring without direct DB access
- AI uses mirrors to understand schema, propose changes, plan migrations
- Humans execute migrations and manage credentials

## How to enable

In `project-blueprint.json`:

```json
{
  "addons": {
    "dbMirror": true
  },
  "db": {
    "enabled": true,
    "kind": "postgres",
    "environments": ["dev", "staging", "prod"]
  }
}
```

Then run:

```bash
node init/skills/initialize-project-from-requirements/scripts/init-pipeline.cjs apply --blueprint init/project-blueprint.json
```

## What gets installed

- `db/` - Database mirror root
  - `db/schema/tables.json` - Table definitions
  - `db/migrations/` - Migration files
  - `db/config/db-environments.json` - Environment config
- `.ai/scripts/dbctl.js` - Schema management
- `.ai/scripts/migrate.js` - Migration management

## Commands

```bash
# Add a table
node .ai/scripts/dbctl.js add-table --name users --columns "id:uuid:pk,email:string:unique"

# Generate migration
node .ai/scripts/dbctl.js generate-migration --name add-user-roles

# List migrations
node .ai/scripts/migrate.js list

# Verify
node .ai/scripts/dbctl.js verify
```

## Context bridge (optional)

If the context-awareness add-on is enabled, you can sync the mirror into `docs/context/`:

```bash
node .ai/scripts/dbctl.js sync-to-context
```

This writes `docs/context/db/schema.json` and updates the context registry checksum so `contextctl verify` succeeds.

## See also

- `addons/db-mirror/ADDON.md` - Full documentation
