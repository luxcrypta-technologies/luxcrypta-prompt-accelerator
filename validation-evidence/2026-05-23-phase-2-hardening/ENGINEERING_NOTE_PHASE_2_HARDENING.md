# Phase 2 Hardening Engineering Note

Date: 2026-05-23

## Files Changed

- `packages/continuity-core/src/pipeline.ts`
- `packages/continuity-core/src/scoring.ts`
- `packages/continuity-types/src/prompts.ts`
- `packages/continuity-types/src/surfaces.ts`
- `apps/extension/src/types/prompts.ts`
- `apps/extension/src/types/surfaces.ts`
- `apps/extension/src/types/messages.ts`
- `apps/extension/src/surfaces/dom.ts`
- `apps/extension/src/background/message-router.ts`
- `apps/extension/src/content/content-script.ts`
- `apps/extension/src/review/App.tsx`
- `apps/extension/src/review/continuity-artifacts.ts`
- `tests/unit/continuity-hardening.test.ts`
- `tests/integration/review-flow.test.ts`
- `tests/integration/review-open-truth.test.ts`
- `tests/fixtures/brutal/chatgpt-chrome-heavy-contaminated-review.txt`
- `tests/fixtures/brutal/chatgpt-assistant-prose-leak.txt`
- `tests/fixtures/brutal/deepseek-fused-governance-invariant-rejection.txt`
- `tests/fixtures/brutal/deepseek-negative-state-loss.txt`
- `tests/fixtures/brutal/gemini-prompt-restatement-contamination.txt`
- `tests/fixtures/brutal/grok-persona-contamination.txt`
- `tests/fixtures/brutal/perplexity-retrieval-chrome-contamination.txt`
- `tests/fixtures/brutal/header-only-fragments.txt`
- `tests/fixtures/brutal/prompt-scaffolding-durable-leak.txt`
- `tests/fixtures/brutal/negative-state-laundering.txt`
- `tests/fixtures/brutal/review-ui-copy-export-debris.txt`
- `validation-evidence/2026-05-23-phase-2-hardening/ENGINEERING_NOTE_PHASE_2_HARDENING.md`

## Hardening Behaviors Added

- Added explicit fail-closed source-role admission aliases for user input, trusted runtime/review state, model output, retrieved content, provider chrome, review UI, toolbar UI, export artifacts, and unknown provenance.
- Split provider preparation into a cleanup/fragment-isolation stage and semantic classification stage with cleaned-fragment diagnostics.
- Added deterministic negative-state extraction with original text, normalized text, reason, provenance, confidence, and durable eligibility.
- Tightened prompt scaffolding and task-local instruction detection so stage labels, answer-shape rules, final-score requirements, and similar prompt furniture become diagnostic-only.
- Enforced exclusive primary buckets and moved retrieved evidence out of `New / Provisional` when it is also quarantined.
- Added provider cleanup for common copied chrome, provider labels, thought banners, powered-by labels, and Grok/xAI persona chrome.
- Suppressed orphan headers from durable admission and added header binding counters.

## New Diagnostics And Scores

- `admission_counts_by_source_role`
- `quarantined_counts_by_source_role`
- `fail_closed_unknown_count`
- `preclean_fragment_count`
- `postclean_fragment_count`
- `chrome_removed_count`
- `ui_debris_removed_count`
- `provider_chrome_removed_count`
- `body_first_extraction_success`
- `provider_surface_confidence`
- `prompt_scaffolding_detected_count`
- `task_local_leakage_count`
- `durable_from_scaffolding_blocked_count`
- `negative_state_detected_count`
- `rejected_direction_preserved_count`
- `negative_state_loss_flag`
- `bucket_collision_attempt_count`
- `bucket_exclusivity_score`
- `cross_ref_count`
- `orphan_header_count`
- `header_payload_bind_success_count`
- `safeguardDetectionCompleteness`
- `readiness_blockers`
- `readiness_metadata`
- `missing_state_summary`

## New Blocker Conditions

Export/handoff is marked `UNSAFE_FOR_HANDOFF` when:

- rejected directions, governance principles, invariants, or continuity safeguards appear present but are not preserved
- provider/review chrome survives in durable buckets
- assistant/model-authored prose survives in durable buckets
- prompt scaffolding or task-local instruction survives in durable buckets
- bucket exclusivity falls below `0.85`
- source purity falls below `0.80`
- review-open was attempted but not visibly acknowledged and persisted
- extraction failure or major fidelity degradation is present

The review UI now renders handoff readiness and blocks copy/save/export handoff actions when blockers are present. Diagnostic export remains available as evidence.

## Fixture Coverage Added

Added brutal fixtures for:

- ChatGPT chrome-heavy contaminated review
- ChatGPT assistant prose leaking into stable-state-shaped text
- DeepSeek fused governance/invariant/rejection block
- DeepSeek negative-state loss regression
- Gemini prompt-restatement contamination
- Grok persona/self-identity contamination
- Perplexity retrieval/chrome contamination
- header-only fragments
- prompt scaffolding mistaken for durable state
- negative-state laundering/dropped prohibitions
- copy/export/review UI text contamination

`tests/integration/review-open-truth.test.ts` covers partial review-open success without visible rendered acknowledgement.

## Test And Build Results

- `npm run typecheck`: passed
- `npm test`: passed, 31 files / 119 tests
- `npm run lint`: passed
- `npm run build:chromium`: passed
- `npm run build:firefox`: passed

## Not Live-Validated

- Live authenticated provider validation was not run in this pass.
- Browser-store packaged ZIP installation was not manually exercised.
- The review-open state machine is covered by unit/integration tests, not by a live browser window acknowledgement run against authenticated provider pages.
