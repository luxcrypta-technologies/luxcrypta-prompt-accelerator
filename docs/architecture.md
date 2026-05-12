# Architecture

LuxCrypta Prompt Accelerator separates continuity logic from runtime shells.

- `packages/continuity-types`: shared contracts, guards, preferences defaults, and storage ports.
- `packages/continuity-core`: deterministic prompt, capsule, compression, scoring, diff, and model adaptation logic.
- `packages/continuity-governance`: stable core, novelty, openness, monitors, diagnostics, promotion, and carry-forward logic.
- `packages/continuity-storage`: storage repositories over the generic continuity storage contract.
- `packages/continuity-domain`: reusable actions and services.
- `packages/continuity-routing`: provider handoff profiles for ChatGPT, Claude, Gemini, and Grok.
- `apps/extension`: manifests, content scripts, DOM adapters, browser platform adapters, and extension UI.
- `apps/desktop`: Electron shell, local workspace persistence, preload IPC, and React continuity console.

Only files under `apps/extension/src/platform/chromium` and `apps/extension/src/platform/firefox` call browser extension APIs directly.
Only files under `apps/desktop/electron` call Electron or Node filesystem APIs directly.

The session governance layer sits above the prompt transform engine and below UI/actions. It keeps accepted continuity separate from new/provisional changes and unresolved questions. It does not inspect private model behavior and does not add network behavior.
