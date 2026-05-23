# Post-Hardening Brutal Validation - Partial Live Evidence

Date: 2026-05-22
Owner requested: Razak
Status: **not a pass**. The full six-provider sweep was not completed because the live environment exposed hard blockers and hard failures early.

## Build Under Test

- Local hardened Chromium extension: `dist/chromium`
- Browser capable of loading unpacked extension: Brave test profiles via remote debugging
- Google Chrome cannot be used for this local build path: Chrome logs `--load-extension is not allowed in Google Chrome, ignoring.`
- During validation, a real review durability gap was found and patched: review state was only in background-worker memory. It is now persisted under `review:*` in extension storage and covered by `tests/integration/review-open-truth.test.ts`.

Verification after that patch:

- `npm test`: 31 files / 93 tests passed
- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build:chromium`: passed

## Provider Availability

| Provider | Live state in hardened Brave test profile | Toolbar | Input | Run status |
|---|---:|---:|---:|---|
| ChatGPT | Logged in | yes | yes | Prompt 1 complete; Prompt 2 partially/late captured; Prompt 3 sent but not reviewed; Prompt 4 not run |
| Gemini | Logged in | yes | yes | Available, not swept |
| DeepSeek | Logged in via Chrome-profile-under-Brave clone | yes | yes | Available, not swept |
| Claude | Login wall | no | no | Blocked |
| Grok | Logged out, input visible | yes | yes | Untrusted/unauthenticated, not swept |
| Perplexity | Logged out, input visible | yes | yes | Available unauthenticated, not swept |

Availability evidence:

- `provider-availability/availability.json`
- `provider-availability/chatgpt.png`
- `provider-availability/gemini.png`
- `provider-availability/deepseek.png`
- `provider-availability/claude.png`
- `provider-availability/grok.png`
- `provider-availability/perplexity.png`

## ChatGPT Evidence Captured

Prompt 1 complete evidence:

- `chatgpt/prompt-1/prompt.txt`
- `chatgpt/prompt-1/model-response.txt`
- `chatgpt/prompt-1/chat-response.png`
- `chatgpt/prompt-1/review-visible-output.txt`
- `chatgpt/prompt-1/review-surface.png`
- `chatgpt/prompt-1/raw-diagnostic-review-state.json`
- `chatgpt/prompt-1/review-open-events.json`
- `chatgpt/prompt-1/run-summary.json`

Prompt 2 evidence:

- `chatgpt/prompt-2/prompt.txt`
- `chatgpt/prompt-2/model-response.txt` was captured too early by the first automation timeout and should not be treated as final.
- `chatgpt/prompt-2/model-response-late-captured.txt` contains the later full ChatGPT response after the page eventually completed.
- `chatgpt/prompt-2/chat-response.png` shows the response still incomplete when review was opened.
- `chatgpt/prompt-2/review-visible-output.txt`
- `chatgpt/prompt-2/review-surface.png`
- `chatgpt/prompt-2/raw-diagnostic-review-state.json`
- `chatgpt/prompt-2/copy-button-check.json`

Prompt 3:

- `chatgpt/prompt-3/prompt.txt` exists because the automation began Prompt 3 before being stopped.
- No model response or review evidence should be considered valid for Prompt 3.

## ChatGPT Verdict

**ChatGPT is unstable under this validation.**

Prompt Review opened truthfully on the complete Prompt 1 click path:

- `review_open_success`
- `surface_created: true`
- `app_mounted: true`
- `first_content_rendered: true`
- `visible_to_user: true`

However, content fidelity failed hard:

- Prompt 1 had `invariantDetectionCompleteness: 0` even though invariant-like stable constraints were present.
- Prompt 1 did not preserve rejected directions in a clean `rejected_directions` bucket.
- Prompt 1 duplicated trusted material into quarantine.
- Prompt 1 had `bucketExclusivityScore: 0.48`, `chromeContaminationScore: 0.45`, and `exportReadiness: 0.25`.
- Prompt 2 admitted assistant-generated reconstruction prose into `stableCore`, including:
  - `A future model reconstructing this state must do the following:`
  - `Restore the mission exactly.`
  - `Whether future models should preserve wording exactly or semantically.`
- Prompt 2 still reported `assistantContaminationScore: 0` despite obvious assistant-generated state entering Stable Core.
- Prompt 2 reported `riskScore: 1` while bucket overlap and admission failures were present.

Copy controls:

- Top-level copy actions were present and produced non-empty payloads:
  - Copy All Review: 21,204 chars
  - Copy Review + Raw JSON: 473,216 chars
  - Copy Engineering Summary: 676 chars
  - Copy Portable Capsule: 34,479 chars
  - Copy Workflow Export: 30,319 chars
  - Copy Raw JSON: 451,879 chars

## Defects

### Provider Extraction

- Claude cannot be validated without login; no toolbar/input state was available.
- Chrome cannot load the local unpacked extension, so live validation must use Brave/Chromium or an installed build.
- Side-panel review surfaces are not directly visible as DevTools page targets; validation needs either a test-visible review tab mode or reliable persisted state lookup by `reviewId`.

### Admission Logic

- Assistant-generated ChatGPT response structure entered Stable Core in Prompt 2.
- Trusted governance/state fragments were duplicated into quarantine.
- Prompt 1 failed to preserve rejected directions as a clean durable bucket.
- Category headers and structural helper phrases still survive as candidate state.

### Bucketing

- Bucket exclusivity failed materially (`0.48` on both captured ChatGPT reviews).
- Governance, stable constraints, rejected directions, and quarantine still overlap.
- Rejected directions were not cleanly represented in the expected primary bucket.

### Scoring

- `assistantContaminationScore` stayed `0` while assistant-generated prose entered Stable Core.
- `riskScore` stayed `1` despite extraction/admission failures.
- Prompt 1 correctly penalized invariant loss, but the review still looked operationally polished.
- Export readiness was low, but this must be more visibly dominant in the review verdict.

### Review Truth

- Review-open telemetry can report visible success for the side panel, but the validation path showed why persisted review state is required after worker sleep/restart.
- A stale toolbar status was observed during an empty-source retry experiment: the event stream showed failure while the toolbar retained `Review opened.` from a previous run.
- Prompt 2 review was opened while the ChatGPT response was still incomplete in the live screenshot; that run should be treated as contaminated validation evidence, not a pass.

### Copy / Export UX

- Required top-level copy actions exist and produce payloads.
- Section-level controls exist, but many appear as repeated generic `Copy` / `JSON` labels in the DOM, which is operationally usable visually but weak for automated auditability.
- Export cleanliness still needs content inspection; current raw review state shows dirty admission before export, so exported artifacts are not trusted by default.

## Decision

Do not advance this as a successful post-hardening sweep.

The hardening improved open telemetry and copy surface coverage, and the new persistence patch removes one review-state durability failure. But the live ChatGPT evidence still proves:

- bucket exclusivity is not strong enough,
- rejected-direction preservation is not clean enough,
- assistant-generated structure can still contaminate Stable Core,
- scoring can look healthier than the content deserves,
- and provider availability/auth must be solved before a six-provider acceptance sweep is meaningful.
