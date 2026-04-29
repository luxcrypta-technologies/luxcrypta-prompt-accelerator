# Architecture

LuxCrypta Prompt Accelerator separates product logic from browser runtime code.

- `src/core`: deterministic prompt and capsule logic.
- `src/governance`: deterministic session governance logic for stable core, novelty, openness, monitors, diagnostics, and carry-forward candidates.
- `src/domain`: reusable actions and services.
- `src/storage`: local stores built on typed storage contracts.
- `src/surfaces`: DOM adapters for supported chat pages.
- `src/platform`: browser capability and runtime adapters.
- `src/popup`, `src/review`, `src/options`: React extension UI.

Only files under `src/platform/chromium` and `src/platform/firefox` call browser extension APIs directly.

The session governance layer sits above the prompt transform engine and below UI/actions. It keeps accepted continuity separate from new/provisional changes and unresolved questions. It does not inspect private model behavior and does not add network behavior.
