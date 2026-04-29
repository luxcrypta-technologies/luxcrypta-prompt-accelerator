# Launch Pack

This pack contains public-facing launch material for LuxCrypta Prompt Accelerator `0.1.0`.

Launch baseline:

- Core code baseline: `1185a86` - `Improve post-release prompt quality and surface resilience`
- Targets: Chromium and Firefox
- Package outputs: `packages/luxcrypta-prompt-accelerator-chromium.zip` and `packages/luxcrypta-prompt-accelerator-firefox.zip`

## Release Notes

### LuxCrypta Prompt Accelerator 0.1.0

LuxCrypta Prompt Accelerator is a local-first browser extension for improving AI chat prompts before they are sent. It helps compress repetitive drafts, preserve hard requirements, review changes with a diff, save reusable workflows, and create compact carry-forward capsules for longer sessions.

This release includes:

- Prompt transforms for compression, focus, research, creative work, debate, code tasks, speed, precision, and executive summaries.
- Review-before-apply workflow with original text, transformed text, explanation, and diff.
- Local workflows for reusable prompt patterns.
- Carry-forward capsules for compact session continuity.
- Session governance with stable core, new/provisional items, open/unresolved items, health scoring, and optional diagnostics.
- Manual JSON export/import for workflows, capsules, preferences, compact session state, and diagnostics.
- Supported chat surfaces: ChatGPT, Claude, and Gemini.
- Chromium and Firefox packaging.
- Local-only operation with no backend, telemetry, analytics, or hidden network path.

Post-release stabilization already included:

- Stronger deduplication for already-structured prompts.
- Cleaner novelty handling and recurring novelty suggestions.
- Improved long-session health scoring.
- Safer surface input read/write behavior.
- Expanded regression coverage.

## Store Page Copy

### Short Description

Local-first prompt compression, review, workflows, and session continuity for AI chat.

### Long Description

LuxCrypta Prompt Accelerator helps you prepare better prompts before sending them to AI chat tools.

It runs as a local-first browser extension for ChatGPT, Claude, and Gemini. Draft a prompt, then use the extension to compress repetition, focus the request, preserve hard constraints, adapt the prompt for common work modes, and review a clear diff before applying the result back to the chat input.

The extension is built for people who work across longer AI sessions and want better continuity without sending their drafts to a backend service.

Key features:

- Compress repetitive prompts while preserving hard requirements.
- Apply practical modes such as Focus, Research, Code, Debate, Precision, Creative, Speed, and Executive Summary.
- Review original and transformed text before applying.
- See explanations and diffs for trust and transparency.
- Save reusable workflows locally.
- Generate carry-forward capsules for compact session continuity.
- Track compact session state with stable core, new/provisional items, and open/unresolved questions.
- Export and import local JSON bundles manually.
- Use Chromium or Firefox builds.

Privacy posture:

- Core transformations run locally.
- Workflows, capsules, compact session state, diagnostics, preferences, and history stay in local extension storage.
- There is no backend service.
- There is no telemetry or analytics.
- There are no hidden outbound network calls from extension logic.
- Export/import is manual and user-triggered.

LuxCrypta Prompt Accelerator is a public browser utility. It does not control third-party AI systems, alter model policies, or promise model-side behavior. It helps users make prompts clearer, more compact, and easier to carry forward.

## Feature Summary

### Prompt Improvement

- Compression removes low-information repetition.
- Constraint preservation keeps hard requirements visible.
- Mode templates help shape prompts for specific work patterns.
- Model formatting profiles keep output practical for common chat surfaces.

### Review And Trust

- Original and transformed prompts are shown side by side.
- Diff view highlights changed content.
- Explanations describe what changed.
- Apply, Copy, Save Workflow, and Save Capsule actions are explicit.

### Session Continuity

- Stable Core keeps the current objective, hard constraints, accepted decisions, and output contract compact.
- New / Provisional lane separates new or changing requirements from accepted session state.
- Open / Unresolved lane preserves uncertainty, open questions, and optional branches.
- Session Health gives plain-language continuity, drift, novelty, openness, and density signals.
- Advanced diagnostics are optional and local.

### Local Reuse

- Workflows store reusable prompt patterns.
- Capsules create compact carry-forward state.
- Manual export/import supports portability without cloud sync.

### Browser Support

- Chromium target uses the Chromium manifest and platform adapter.
- Firefox target uses the Firefox manifest and review-tab fallback behavior.
- Shared core logic remains browser-independent.

## Privacy Summary

LuxCrypta Prompt Accelerator is designed as a local-first extension.

What is stored locally:

- Preferences
- Action history, if enabled
- Saved workflows
- Saved capsules
- Compact session governance state
- Compact diagnostics snapshots

What is not part of the product:

- No backend account
- No cloud sync
- No analytics
- No telemetry
- No hidden prompt exfiltration
- No remote AI dependency for core transformations
- No default full-transcript storage

The extension reads draft text and shallow page context only for user-triggered actions. Session governance stores compact summaries by default rather than transcript dumps.

## What This Is / What This Is Not

### This Is

- A local-first prompt and session accelerator.
- A browser extension for improving drafts before they are sent.
- A tool for reducing repetition, preserving constraints, and improving continuity.
- A transparent review layer with diffs and explanations.
- A compact local workflow, capsule, and session-state utility.
- A cross-browser extension with Chromium and Firefox packaging.

### This Is Not

- Not a model.
- Not a backend service.
- Not a cloud synchronization product.
- Not an analytics or telemetry system.
- Not a tool for controlling private behavior inside third-party AI systems.
- Not a promise of model-side speed, cognition, policy, or final answer quality.
- Not a proprietary internal runtime.

## Public Positioning Sheet

### One-Line Positioning

LuxCrypta Prompt Accelerator is a local-first browser extension that makes AI chat prompts clearer, tighter, and easier to carry across long sessions.

### Audience

- Researchers who need constraints and uncertainty preserved.
- Builders who reuse prompt workflows.
- Operators who want fast review before sending prompts.
- Power users who work across long AI chat sessions.
- Privacy-conscious users who prefer local browser utilities over cloud prompt tooling.

### Primary Value

LuxCrypta Prompt Accelerator improves prompt quality and continuity before the user sends the prompt. It helps users avoid repetitive drafts, lost constraints, and messy long-session carry-forward.

### Trust Message

The extension shows what changed, keeps data local, and does not rely on hidden network behavior. Users stay in control through review, apply, copy, save, export, and import actions.

### Boundaries

Use plain public language. Do not claim private control over third-party AI systems, deterministic model cognition, policy enforcement inside chat products, or promised model-side performance gains.

## Launch Checklist

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run package:chromium`
- `npm run package:firefox`
- Confirm generated packages under `packages/`
- Confirm privacy docs match runtime behavior
- Confirm store copy avoids hidden-control claims
- Confirm supported surface list matches manifests

## Known Operational Notes

- Supported chat pages can change their DOM. The extension includes conservative fallback selectors and input handling, but real-world surface drift should be monitored after launch.
- Session governance is compact and heuristic. It is designed to guide review, not to replace user judgment.
- Firefox and Chromium may use different review surfaces depending on browser API support.
