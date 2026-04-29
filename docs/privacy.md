# Privacy

V1 is local-first.

- Core transformations run locally.
- Workflows, capsules, compact session state, diagnostics snapshots, history, and preferences use local extension storage.
- There is no backend service.
- There are no hidden remote calls.
- There is no remote AI dependency for core transformations.
- Export/import is manual JSON.

Session extraction is shallow and used only for user-triggered actions. Session governance stores compact summaries, not full transcript dumps by default.
