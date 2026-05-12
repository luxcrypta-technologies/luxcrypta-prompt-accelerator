# Storage Model

The shared continuity layer stores data through the generic continuity storage adapter.

Prefixes:

- `workflow:`
- `capsule:`
- `history:`
- `pref:`
- `session:`
- `diagnostic:`

Export/import uses a versioned JSON bundle with workflows, capsules, compact session states, diagnostics snapshots, and optional preferences.

The desktop MVP maps the same keys into local workspace folders:

- `workspace.json`
- `sessions/*.json`
- `capsules/*.json`
- `workflows/*.json`
- `diagnostics/*.json`
- `exports/*.json`

Each desktop file is wrapped in a versioned `{ schemaVersion, data }` envelope so the JSON persistence layer can be migrated later without changing the shared domain services.
