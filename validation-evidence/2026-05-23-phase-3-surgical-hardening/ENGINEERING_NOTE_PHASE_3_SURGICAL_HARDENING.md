# Phase 3 Surgical Hardening Engineering Note

Date: 2026-05-23

## Status

Still not production-good.

The surgical runtime pass improved the capture/classify/review-open layer locally, but authenticated live Prompt Review validation across all six providers was blocked. Per the phase scope, this cannot be closed as production-good without authenticated provider evidence.

## What Changed

- Added a body-first content extraction helper that keeps composer text dominant and, when the composer is empty after send, falls back only to the last user-authored turn.
- Removed the whole-transcript fallback that could admit assistant prose, provider titles, and page chrome as source text.
- Preserved Perplexity retrieved/source-card material only after the user-authored body and with `Retrieved evidence:` labeling so it remains quarantinable.
- Added provider-health extraction provenance: extraction source, source summary, segment count, and body-first success.
- Added bucket integrity diagnostics: collision count, exclusive bucket violation count, durable/trusted leakage count, cross-ref count, and negative-state loss flag.
- Added explicit rejected-direction and unresolved-tension recall scores alongside existing governance, invariant, safeguard, and negative-state metrics.
- Refreshed review readiness after `review:rendered` so open-success is only reported after visible/persisted acknowledgement, and stale pre-render unsafe blockers do not survive after success.
- Added Prompt Review debug sections for extraction source and bucket integrity without redesigning the review UI.
- Kept unsafe handoff/export blocking fail-closed with specific blockers.

## Files Changed

- `apps/extension/src/background/message-router.ts`
- `apps/extension/src/content/content-script.ts`
- `apps/extension/src/content/extraction.ts`
- `apps/extension/src/review/App.tsx`
- `apps/extension/src/review/continuity-artifacts.ts`
- `apps/extension/src/surfaces/dom.ts`
- `apps/extension/src/types/messages.ts`
- `apps/extension/src/types/prompts.ts`
- `apps/extension/src/types/surfaces.ts`
- `packages/continuity-core/src/pipeline.ts`
- `packages/continuity-core/src/scoring.ts`
- `packages/continuity-types/src/prompts.ts`
- `packages/continuity-types/src/surfaces.ts`
- `tests/integration/content-extraction.test.ts`
- `tests/integration/review-flow.test.ts`
- `tests/integration/review-open-truth.test.ts`
- `tests/unit/continuity-hardening.test.ts`
- `tests/unit/scoring.test.ts`
- `validation-evidence/2026-05-23-phase-3-surgical-hardening/*`

Pre-existing Phase 2 hardening fixture files and the Phase 2 note were already present as untracked/dirty workspace state before this pass.

## Test Results

- `npm run typecheck`: passed
- `npm test`: passed, 32 files / 128 tests
- `npm run lint`: passed
- `npm run build:chromium`: passed
- `npm run build:firefox`: passed

## Live Validation Results

Evidence directory: `validation-evidence/2026-05-23-phase-3-surgical-hardening`

| Provider | Auth State | Prompt Runs | Result |
|---|---|---:|---|
| ChatGPT | logged out / auth required | 0 | Blocked: toolbar unavailable in fresh extension profile |
| Claude | logged out / Cloudflare verification | 0 | Blocked: toolbar and input unavailable |
| Gemini | logged out / auth required | 0 | Blocked: toolbar unavailable |
| Grok | logged out / auth required | 0 | Blocked: toolbar unavailable |
| Perplexity | logged out / auth required | 0 | Blocked: toolbar unavailable |
| DeepSeek | human verification | 0 | Blocked: toolbar and input unavailable |

The active normal Chrome/Brave sessions were not launched with a remote debugging port, so the runner could not attach to authenticated tabs to capture raw diagnostic review state, persisted review state, reload behavior, or copy/export behavior.

## Remaining Risks

- No authenticated live provider run reached Prompt Review after this pass.
- Provider selector updates may still be needed once authenticated CDP validation can run against real post-send DOM on all six providers.
- The new last-user-turn fallback is covered locally, but still needs live proof against each provider’s current DOM and transcript structure.
- Copy/export blocking is locally covered, but live clipboard/export behavior remains unproven for this pass.

## Production-Good Statement

This pass is not production-good yet. Local hardening is materially better, but the required authenticated live-provider evidence is blocked and must be rerun before closure.
