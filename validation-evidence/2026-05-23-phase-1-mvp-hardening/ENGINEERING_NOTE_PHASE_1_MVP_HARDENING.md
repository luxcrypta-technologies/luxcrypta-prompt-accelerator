# Phase 1 MVP Hardening Engineering Note

Date: 2026-05-23

## What Failed Before

- Provider captures could still include page/review chrome such as `Show more`, `Copy JSON`, `Prompt Review`, and provider controls before the continuity runtime classified state.
- Source admission was too trusting once text looked semantically clean; assistant/model prose, pasted review artifacts, and unknown provenance could be considered alongside user-authored state.
- Stable Core seeding could become too confident after provenance was lost.
- Bucket collisions were normalized, but the diagnostics and scoring did not always make the collision visible or costly enough.
- Dirty outputs could score better than their actual trust posture.
- Prompt Review opening was already pending-gated, but copy/export could still operate from transient edited review text without first persisting that visible state.

## What Was Hardened

- Added body-first draft extraction for ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek with shared UI-line stripping and provider-specific body selectors.
- Added extraction contamination markers for chrome-heavy, assistant-role, short-body, and scaffold-dominant captures.
- Expanded source roles to include the Phase 1 trust vocabulary: trusted user input, trusted state, prior review state, provider UI, assistant output, retrieval content, export artifact, and unknown.
- Unknown provenance now fails closed, export/review artifact text is blocked from trusted re-admission, and assistant/model output is quarantined unless it arrives through a trusted source path.
- Strengthened governance, invariant, rejected-direction, and unresolved-state pattern families, including `outranks`, `Transparency outranks`, `If violated`, `Invariant`, `Rejected direction`, and `Unresolved tension`.
- Made bucket priority deterministic with invariant/governance/rejection/stable/open/provisional/quarantine ordering and exposed collision counts.
- Added admission counts for admitted durable, quarantined, rejected, unknown dropped, assistant quarantined, and chrome dropped.
- Strengthened scoring penalties and clamps for assistant contamination, unknown durable admission, export artifact re-entry, extraction degradation, and major trust-boundary failures.
- Added a persisted `review:update` path and made top-level review copy/export/save flows persist the visible review payload before generating portable artifacts.
- Surfaced admission counts in Prompt Review alongside warnings and scores.

## Validation Run

- `npm run typecheck`
- `npm test`
- `npm run build:chromium`
- `npm run build:firefox`

Local regression coverage now includes brutal fixtures or body-first surface fixtures across ChatGPT, Claude, Gemini, Grok, Perplexity, and DeepSeek.

## Deferred To Phase 2

- Full semantic normalization across every provider phrasing variant.
- Exhaustive adversarial paraphrase coverage.
- Broad UX polish and advanced score visualization.
- Advanced live-browser behavior profiling across every provider shell variation.
- Live provider validation with authenticated real provider pages was not run in this local pass, so this note does not claim live-provider completion.
