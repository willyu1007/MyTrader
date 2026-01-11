# Database Mirror Add-on

## Purpose

This add-on provides a **database schema mirroring** system that allows AI/LLM to understand and work with database structures without direct database access.

## Key Concepts

### Schema Mirror

The `db/schema/tables.json` file contains structured definitions of all database tables:

```json
{
  "tables": [
    {
      "name": "users",
      "columns": [
        { "name": "id", "type": "uuid", "constraints": ["pk"] },
        { "name": "email", "type": "string", "constraints": ["unique"] }
      ]
    }
  ]
}
```

### Migrations

Migrations are stored in `db/migrations/` as timestamped SQL files:

```
db/migrations/
├── 20251225120000_initial_schema.sql
├── 20251225130000_add_user_roles.sql
└── ...
```

### Environment Configuration

`db/config/db-environments.json` defines database environments and their permissions:

- **dev**: Full access for local development
- **staging**: Review-required for migrations
- **prod**: Change-request required for migrations

## AI/LLM Usage

When working with databases, AI should:

1. **Read** the schema mirror to understand current structure
2. **Propose** changes by modifying schema files
3. **Generate** migrations using `dbctl generate-migration`
4. **Document** intentions in `db/workdocs/`
5. **Never** directly access databases or execute arbitrary SQL

## Commands Reference

See `ADDON.md` for complete command documentation.

