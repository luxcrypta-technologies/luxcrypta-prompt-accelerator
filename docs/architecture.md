# Architecture

LuxCrypta Prompt Accelerator separates product logic from browser runtime code.

- `src/core`: deterministic prompt and capsule logic.
- `src/domain`: reusable actions and services.
- `src/storage`: local stores built on typed storage contracts.
- `src/surfaces`: DOM adapters for supported chat pages.
- `src/platform`: browser capability and runtime adapters.
- `src/popup`, `src/review`, `src/options`: React extension UI.

Only files under `src/platform/chromium` and `src/platform/firefox` call browser extension APIs directly.
