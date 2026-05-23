# ChatGPT Engine Rerun Evidence

Date: 2026-05-22
Build: rebuilt `dist/chromium` after continuity-engine hardening
Browser path: Brave via remote debugging, clean temporary profile
Auth state: logged out, but live ChatGPT composer and extension toolbar were available

## Execution Notes

- Initial Playwright-launched profile hit a Cloudflare "Verify you are human" interstitial. It was not solved or bypassed.
- The successful run used the prior validation style: normal Brave launched with `--remote-debugging-port=9262`, rebuilt unpacked extension loaded, then automation attached over CDP.
- All four brutal prompts were sent to live ChatGPT in fresh chats.
- Each run captured prompt, model response, chat screenshot, visible review text, review screenshot, raw diagnostic review state, review-open events, and run summary.
- Prompt 4 also ran copy-button checks.

## Evidence Index

- Summary JSON: `chatgpt-rerun-engine/chatgpt-rerun-summary.json`
- Availability: `chatgpt-rerun-engine/availability.json`, `availability.png`
- Prompt evidence folders:
  - `chatgpt-rerun-engine/prompt-1`
  - `chatgpt-rerun-engine/prompt-2`
  - `chatgpt-rerun-engine/prompt-3`
  - `chatgpt-rerun-engine/prompt-4`

Each prompt folder contains:

- `prompt.txt`
- `model-response.txt`
- `chat-response.png`
- `review-visible-output.txt`
- `review-surface.png`
- `raw-diagnostic-review-state.json`
- `review-open-events.json`
- `run-summary.json`

## Result Matrix

| Prompt | Review opened truthfully | Stable Core purity | Governance | Invariants | Rejections | Open tensions | Assistant contamination | Chrome contamination | Bucket exclusivity | Export readiness | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | yes | pass | pass | pass | pass | n/a | pass | pass | weak, 0.66 | 0.58 / unsafe | partial pass |
| 2 | yes | strict-empty | fail | weak | fail | fail | pass | pass | weak, 0.66 | 0.03 / unsafe | fail |
| 3 | yes | strict-empty | weak | weak | pass | weak/contaminated | pass | fail | weak, 0.48 | 0.19 / unsafe | fail |
| 4 | yes | strict-empty | fail | fail | fail | fail | pass | pass | weak, 0.48 | 0.00 / unsafe | fail |

## Key Metrics

| Prompt | Source purity | Assistant contamination | Chrome contamination | Durable precision | Durable recall | Negative-state preservation | Review truthfulness |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1.00 | 0.00 | 0.00 | 1.00 | 1.00 | 1.00 | 0.80 |
| 2 | 1.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.80 |
| 3 | 0.56 | 0.00 | 1.00 | 0.76 | 1.00 | 1.00 | 0.90 |
| 4 | 1.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.80 |

## What Improved

- Prompt Review opened visibly and truthfully on all four ChatGPT rerun prompts.
- The old Prompt 2 failure mode, assistant-authored reconstruction prose entering Stable Core, did not recur.
- Assistant/model output was blocked aggressively:
  - Prompt 1: 70 assistant-generated blocked items
  - Prompt 2: 378 assistant-generated blocked items
  - Prompt 3: 218 assistant-generated blocked items
  - Prompt 4: 269 assistant-generated blocked items
- Prompt 1 now preserves mission, governance principles, invariants, and rejected directions cleanly.
- Exports were not falsely marked ready; every run was `UNSAFE_FOR_HANDOFF`.

## Remaining Failures

### Provider Extraction

- ChatGPT logged-out mode was usable, but authenticated workspace validation remains unconfirmed after the previous logged-in profile became unavailable.
- Prompt 3 still admitted `Show moreShow less` into Open / Unresolved: `Keep the tensions explicit.Show moreShow less`.
- ChatGPT surface extraction still needs stricter DOM/body extraction around collapsed response controls and host UI artifacts.

### Admission Logic

- Assistant-output quarantine is now strict enough to prevent Stable Core contamination, but the system has no governed way to evaluate a user-requested assistant-produced state as candidate state without making it durable.
- Prompt 2 and Prompt 4 therefore become strict-empty/unsafe rather than a clean reviewed reconstruction. This is safer than contamination, but operationally incomplete.

### Bucketing

- Bucket exclusivity remains weak:
  - Prompt 1: 0.66
  - Prompt 2: 0.66
  - Prompt 3: 0.48
  - Prompt 4: 0.48
- Prompt 3 has category-label artifacts in governance/invariants:
  - `Governance principles`
  - `Priority model for what wins when constraints collide`
  - `Open tensions that must remain unresolved`
- Prompt 4 misses governance, invariants, rejected directions, and open unresolved items entirely.

### Scoring

- Scoring is more honest than before: export readiness is unsafe and recall/negative-state preservation collapse when extraction fails.
- `riskScore` remains hard to interpret because it stays `1` on every run. If `1` means high risk, the label is okay but the review surface needs clearer wording. If users read it as health, this is still misleading.

### Review Truth

- Review-open truth passed all four live ChatGPT rerun prompts:
  - `review_open_status: success`
  - `visible_to_user: true`
  - `review_app_mounted`
  - `review_first_content_rendered`
  - `review_visible_to_user`
- No refresh was required.

### Copy / Export UX

- Prompt 4 copy checks:
  - `Copy Review + Raw JSON`: worked, 426,570 chars
  - `Copy Engineering Summary`: worked, 994 chars
  - `Copy Portable Capsule`: worked, 12,603 chars
  - `Copy Workflow Export`: worked, 15,856 chars
  - Section copy buttons: 60 detected
- `Copy All Review` is visible in the review text but failed role-based automation because its accessible name is `Copy` via `aria-label`, not `Copy All Review`.
- Top-level `Copy Raw JSON` was not found. Raw JSON is capturable via storage and bundled in `Copy Review + Raw JSON`, but the required standalone top-level action is still missing or not exposed.
- Section JSON copy buttons were not detected.

## Executive Verdict

Current status: **engine improved, ChatGPT still unstable**.

The old dishonest UI failure is not present in this rerun. Review-open truth is good, persistence works, and the worst Stable Core contamination from assistant reconstruction text is fixed.

The continuity engine is still not pass-grade under the live brutal protocol because governance/invariant/rejection recall collapses on Prompts 2 and 4, bucket exclusivity remains weak, ChatGPT chrome still leaks on Prompt 3, and required copy controls are incomplete or inaccessible.

Bluntly:

**The wrapper stayed honest. The engine stopped one major contamination path. The system still fails cross-prompt continuity fidelity.**
