# Launch Pack

This pack contains public-facing launch material for LuxCrypta Prompt Accelerator `1.0.0`.

Launch baseline:

- Core code baseline: `1.0.0` store submission preparation
- Targets: Chromium and Firefox
- Package outputs: `packages/luxcrypta-prompt-accelerator-chromium.zip` and `packages/luxcrypta-prompt-accelerator-firefox.zip`

## Release Notes

### LuxCrypta Prompt Accelerator 1.0.0

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

A local-first browser extension for cleaner prompts, stronger continuity, reusable workflows, and more controllable AI chats.

### Long Description

LuxCrypta Prompt Accelerator is a local-first browser extension built to make AI chats easier to drive.

It helps reduce repetition, preserve important constraints, strengthen continuity across longer sessions, and turn repeated prompt work into reusable workflows. It also provides visible diff review before apply, so changes stay inspectable and under user control.

This extension is designed for users who want AI chats to feel cleaner, less repetitive, and more manageable over time.

Core capabilities:

- Prompt compression
- Mode-based prompt rewriting
- Carry-forward session capsules
- Reusable workflows
- Cross-model prompt adaptation
- Visible diff and explanation
- Session-governance features for stronger continuity and novelty handling
- Local-first storage with manual export/import

Privacy-first by default:

- Local-first
- No hidden telemetry
- No silent cloud sync
- No backend required for core functionality
- Manual export/import only

What it is:

- A user-side prompt and session accelerator
- A browser extension for AI chat workflows
- A local-first control layer

What it is not:

- Not a model
- Not hidden control over third-party AI systems
- Not a release of LuxCrypta proprietary runtime systems

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

## Store Page Feature Bullets

- Compress prompts without dropping important requirements.
- Rewrite prompts for Focus, Precision, Research, Code, and more.
- Preserve continuity across longer chat sessions.
- Save and reuse strong workflows.
- Generate carry-forward capsules.
- Review changes before apply.
- Adapt prompt structure for different AI systems.
- Keep core behavior local-first.

## Store Page Privacy Blurb

Privacy matters here.

LuxCrypta Prompt Accelerator is designed to operate locally for its core behavior. It does not depend on hidden cloud processing, does not use hidden telemetry, and does not silently sync chat data. Export/import is manual and user-controlled.

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

### Positioning Options

1. LuxCrypta Prompt Accelerator helps make AI chats cleaner, tighter, and easier to manage over time.
2. A local-first prompt and session accelerator for people who want more control over AI chat workflows.
3. Reduce repetition, preserve continuity, and keep AI chats easier to drive.

### GitHub / Website Blurb

LuxCrypta Prompt Accelerator is a local-first browser extension for improving AI chat workflows through prompt compression, mode-based rewriting, carry-forward continuity, reusable workflows, visible review, and stronger session-state handling over longer chat runs.

### Why LuxCrypta Built This

AI chats are powerful, but long-running sessions often become bloated, repetitive, and harder to steer. LuxCrypta Prompt Accelerator was built to improve that experience from the user side: cleaner prompts, better preserved constraints, stronger continuity, and less wasted effort across repeated workflows.

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

Public tone should be plain, product-grade, privacy-respecting, confident, non-mystical, and non-academic. Avoid deep internal jargon, exaggerated memory claims, hidden-control language, surveillance-sounding language, and opaque automation claims.

## Launch Checklist

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run package:chromium`
- `npm run package:firefox`
- `npm run package:source`
- `npx web-ext lint --source-dir dist/firefox`
- Confirm generated packages under `packages/`
- Confirm privacy docs match runtime behavior
- Confirm store copy avoids hidden-control claims
- Confirm supported surface list matches manifests

## Known Operational Notes

- Supported chat pages can change their DOM. The extension includes conservative fallback selectors and input handling, but real-world surface drift should be monitored after launch.
- Session governance is compact and heuristic. It is designed to guide review, not to replace user judgment.
- Firefox and Chromium may use different review surfaces depending on browser API support.
