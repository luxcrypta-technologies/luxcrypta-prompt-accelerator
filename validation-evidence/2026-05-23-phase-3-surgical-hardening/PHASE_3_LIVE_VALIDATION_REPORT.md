# Phase 3 Live Validation Report

Date: 2026-05-23

Status: live validation attempt for Phase 3 surgical hardening.

This is a validation-access blocker, not evidence of a passing Phase 3 and not yet evidence of a trust-runtime regression.

## Provider Results

| Provider | Auth State | Verdict | Runs | Blocker |
|---|---|---:|---:|---|
| chatgpt | logged_out_or_auth_required | BLOCKED | 0 | toolbar_or_input_unavailable |
| claude | logged_out_or_auth_required | BLOCKED | 0 | toolbar_or_input_unavailable |
| gemini | logged_out_or_auth_required | BLOCKED | 0 | toolbar_or_input_unavailable |
| grok | logged_out_or_auth_required | BLOCKED | 0 | toolbar_or_input_unavailable |
| perplexity | logged_out_or_auth_required | BLOCKED | 0 | toolbar_or_input_unavailable |
| deepseek | unknown_or_anonymous | BLOCKED | 0 | toolbar_or_input_unavailable |

## Remaining Issues

| Provider | Run | Failure | Class | Evidence |
|---|---|---|---|---|
| chatgpt | availability | toolbar_or_input_unavailable | validation access | chatgpt/availability.json |
| claude | availability | toolbar_or_input_unavailable | validation access | claude/availability.json |
| gemini | availability | toolbar_or_input_unavailable | validation access | gemini/availability.json |
| grok | availability | toolbar_or_input_unavailable | validation access | grok/availability.json |
| perplexity | availability | toolbar_or_input_unavailable | validation access | perplexity/availability.json |
| deepseek | availability | toolbar_or_input_unavailable | validation access | deepseek/availability.json |

## Evidence

- `live-validation-summary.json`
- Per-provider `availability.json` and `availability.png`
- Per-run `prompt-input.png`, `provider-response.png`, `review-surface.png`, `raw-diagnostic-review-state.json`, `copied-review-text.txt`, `copy-button-check.json`, and `reload-check.json` when the provider run reached Prompt Review.

## Access Attempts

- Disposable Chrome profile clone: provider sessions did not carry into the instrumented profile and the unpacked extension toolbar was unavailable.
- Clean Brave profile with unpacked extension: extension mounted on several provider pages, but providers were logged out or blocked by security checks.
- Disposable Brave profile clone: extension mounted on ChatGPT, Gemini, Grok, and Perplexity, but authenticated provider state still did not carry; Claude and DeepSeek were stopped by security verification.
- Existing normal Brave session: ChatGPT was visibly authenticated and the LuxCrypta toolbar was present, but the browser was not launched with remote debugging, so the required raw diagnostic JSON, persisted review inspection, reload, and copy/export automation could not be collected without disrupting the live user session.

## Recommendation

PHASE 3 LIVE VALIDATION BLOCKED

## Notes

- This report is generated from live provider DOM through the unpacked Chromium extension build.
- Providers marked blocked did not produce authenticated live Prompt Review evidence and cannot be counted toward Phase 3 closure.
- Required next step: run the same script against a dedicated authenticated debug profile, or relaunch an authenticated browser with remote debugging and the unpacked extension available.
- Authenticated CDP rerun path: relaunch the authenticated browser with `--remote-debugging-port=9262`, then run `LCPA_LIVE_CDP_ENDPOINT=http://127.0.0.1:9262 node validation-evidence/2026-05-23-phase-3-surgical-hardening/run-live-validation.mjs`.
