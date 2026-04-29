# LuxCrypta Prompt Accelerator

LuxCrypta Prompt Accelerator is a local-first browser extension that helps users reshape AI chat prompts before they send them. It compresses repetitive drafts, applies practical modes, preserves hard constraints, creates carry-forward capsules, adapts prompt formatting for common chat products, and shows a review diff before apply.

The Phase 2 session governance layer adds compact local continuity state: a stable core, new/provisional items, open/unresolved items, and optional diagnostics for long-running sessions.

The v1 product is a public utility layer. It is not a model, and it does not access or control private behavior inside third-party chat products.

## Architecture

- Browser-agnostic core logic in `src/core`, `src/governance`, `src/domain`, `src/storage`, and `src/types`.
- WebExtensions-style runtime adapters under `src/platform/chromium` and `src/platform/firefox`.
- Split manifests in `manifests/`.
- Chromium is the first packaged target.
- Firefox is supported by design through a target-specific manifest and platform adapter.
- Local storage only for workflows, capsules, compact session state, diagnostics snapshots, history, and preferences.
- Manual JSON export/import.
- No backend, usage reporting, hidden remote calls, or remote AI dependency for core transformations.

## Supported surfaces

- ChatGPT web: `chat.openai.com`, `chatgpt.com`
- Claude web: `claude.ai`
- Gemini web: `gemini.google.com`

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build:chromium
npm run build:firefox
```

Build output is written to `dist/chromium` and `dist/firefox`.
