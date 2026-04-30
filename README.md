# LuxCrypta Prompt Accelerator

LuxCrypta Prompt Accelerator is a local-first browser extension that makes AI chats easier to drive.

It helps reduce repetition, preserve important constraints, strengthen continuity across longer sessions, and turn repeated chat work into reusable workflows. It also gives users a clear review layer before changes are applied, so prompt improvements stay visible and inspectable.

## What It Does

- Compresses prompts without dropping important requirements.
- Rewrites prompts for different working modes.
- Preserves useful continuity across longer sessions.
- Adapts prompts for different AI systems.
- Saves reusable workflows.
- Generates carry-forward capsules.
- Shows diffs and explanations before apply.
- Keeps core behavior local-first.

## Why It Exists

Most AI chat sessions degrade over time:

- Prompts get bloated.
- Constraints get buried.
- Repeated work gets repetitive.
- Continuity drifts.
- Good prompt patterns get lost.

LuxCrypta Prompt Accelerator exists to make those chats cleaner, tighter, and easier to manage.

## What This Is

LuxCrypta Prompt Accelerator is a user-side prompt and session accelerator for AI chat.

It improves the input and continuity layer around chat workflows by helping users:

- Clean up prompts.
- Preserve stable requirements.
- Carry useful session state forward.
- Reuse proven workflows.
- Review changes before sending.

## What This Is Not

LuxCrypta Prompt Accelerator is not:

- A model.
- Hidden control over third-party AI systems.
- A claim of deterministic control over closed-model cognition.
- A release of LuxCrypta's deeper proprietary runtime systems.

It is a practical browser extension for improving how chats are structured and maintained over time.

## Features

### Prompt Compression

Reduce repetition, merge overlapping instructions, and keep important constraints intact.

### Mode-Based Rewriting

Rewrite prompts for different working styles:

- Focus
- Speed
- Precision
- Creative
- Debate
- Research
- Code
- Executive Summary

### Carry-Forward Continuity

Generate compact session state that preserves:

- Current objective
- Important constraints
- Decisions already made
- Unresolved questions
- Preferred output style

### Workflow Reuse

Save strong prompt patterns and reuse them later with less repetitive setup.

### Cross-Model Adaptation

Adapt prompt structure for different AI systems without claiming hidden internal control.

### Diff And Review

See what changed before applying a transformation.

### Session Governance

Keep a more stable session core, isolate new or provisional changes, preserve useful open questions, and maintain stronger long-session continuity.

### Local-First Storage

Keep workflows, capsules, preferences, and session state local by default.

## How It Helps

LuxCrypta Prompt Accelerator is designed to improve the practical feel of long AI chat sessions.

Instead of treating each prompt as isolated, it helps preserve:

- What the session is trying to do.
- What requirements must stay intact.
- What has already been decided.
- What is still unresolved.
- What changed recently.

The result is a chat workflow that feels less repetitive, less wasteful, and easier to steer over time.

## Privacy

LuxCrypta Prompt Accelerator is designed to be local-first.

That means:

- No hidden telemetry.
- No silent cloud sync.
- No backend required for core functionality.
- Manual export/import only.
- User-triggered actions drive prompt and session processing.

The extension is designed to read only the page data needed for active user actions such as:

- Reading the current draft.
- Applying a transformed prompt.
- Generating a carry-forward capsule.
- Updating local session state.

It is not designed to silently harvest full chat histories or exfiltrate prompt content.

## Installation

Current build targets:

- Chromium-based browsers
- Firefox

Load the packaged build or unpacked extension according to your browser's extension workflow.

## Browser Support

LuxCrypta Prompt Accelerator is built with a cross-browser architecture and packaged for Chromium and Firefox.

Supported chat surfaces:

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
npm run package:chromium
npm run package:firefox
npm run package:source
```

Build output is written to `dist/chromium` and `dist/firefox`.
Package output is written to `packages/`.

## FAQ

### Does This Send My Prompts To A Server?

Core behavior is local-first. It does not rely on a backend for its main functionality.

### Is This A Model?

No. It is a browser extension that improves the prompt and session layer around AI chat.

### Does It Control The Model Internally?

No. It improves how instructions and continuity are structured before they reach the model.

### What Kinds Of Tasks Is It Useful For?

Research, writing, coding, planning, structured analysis, and long-running chat workflows.

### What Makes It Different From A Prompt Library?

It combines prompt compression, session continuity, reusable workflows, visible diff review, and governance-style session management in a local-first browser extension.

## Launch Materials

Public release notes, store copy, feature summary, privacy summary, and positioning language live in [`docs/launch-pack.md`](docs/launch-pack.md).

Store upload fields, permission justifications, privacy disclosure text, reviewer instructions, and package checklist live in [`docs/store-submission.md`](docs/store-submission.md).

Public website copy for the extension homepage, privacy policy, and support page lives in [`docs/store-web-pages.md`](docs/store-web-pages.md). Candidate store screenshots and promotional images live in [`store-assets/`](store-assets/).

## License

MIT License. See [`LICENSE`](LICENSE).
