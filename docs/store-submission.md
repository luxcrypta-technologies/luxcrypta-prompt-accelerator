# Store Submission

This document is the upload handoff for LuxCrypta Prompt Accelerator `1.0.0`.

## Public Links

- Homepage: `https://luxcrypta.com/prompt-accelerator`
- Privacy policy: `https://luxcrypta.com/prompt-accelerator/privacy`
- Support: `https://luxcrypta.com/prompt-accelerator/support`

Publish these pages before submitting either store listing. Draft page copy is in [`store-web-pages.md`](store-web-pages.md).

## Package Outputs

Run these commands from a clean worktree:

```bash
npm run typecheck
npm test
npm run lint
npm run package:chromium
npm run package:firefox
npm run package:source
npx web-ext lint --source-dir dist/firefox
```

Expected upload files:

- Chrome Web Store: `packages/luxcrypta-prompt-accelerator-chromium.zip`
- Firefox AMO: `packages/luxcrypta-prompt-accelerator-firefox.zip`
- AMO source package, if requested: `packages/luxcrypta-prompt-accelerator-source.zip`

## Store Listing Fields

- Name: `LuxCrypta Prompt Accelerator`
- Category: `Productivity`
- Language: `English`
- Pricing: `Free`
- Distribution: `Public / listed`
- Experimental: `No`
- Homepage URL: `https://luxcrypta.com/prompt-accelerator`
- Support URL: `https://luxcrypta.com/prompt-accelerator/support`
- Privacy policy URL: `https://luxcrypta.com/prompt-accelerator/privacy`

### Short Description

```text
A local-first browser extension for cleaner prompts, stronger continuity, reusable workflows, and more controllable AI chats.
```

### Full Description

```text
LuxCrypta Prompt Accelerator is a local-first browser extension built to make AI chats easier to drive.

It helps reduce repetition, preserve important constraints, strengthen continuity across longer sessions, and turn repeated prompt work into reusable workflows. It also provides visible diff review before apply, so changes stay inspectable and under user control.

Core capabilities:
- prompt compression
- mode-based prompt rewriting
- carry-forward session capsules
- reusable workflows
- cross-model prompt adaptation
- visible diff and explanation
- session-governance features for stronger continuity and novelty handling
- local-first storage with manual export/import

This extension is designed for users who want AI chats to feel cleaner, less repetitive, and more manageable over time.

Privacy-first by default:
- local-first
- no hidden telemetry
- no silent cloud sync
- no backend required for core functionality
- manual export/import only

What it is:
- a user-side prompt and session accelerator
- a browser extension for AI chat workflows
- a local-first control layer

What it is not:
- not a model
- not hidden control over third-party AI systems
- not a release of LuxCrypta proprietary runtime systems
```

## Chrome Privacy Tab

Single purpose:

```text
LuxCrypta Prompt Accelerator improves user-triggered AI chat drafts by compressing prompts, preserving constraints, reviewing changes, saving local workflows, and generating compact carry-forward session state.
```

Data handling:

```text
The extension reads draft prompt text and shallow page context only when the user triggers an action such as transform, review, apply, workflow save, capsule generation, or export/import. Core processing is local-first. Workflows, capsules, preferences, compact session state, diagnostics, and optional history are stored in local extension storage. The extension does not use telemetry, analytics, hidden cloud sync, a backend service, or hidden prompt exfiltration.
```

User data sharing:

```text
No user data is sold, transferred, or shared with third parties by the extension. There is no remote service for core functionality.
```

Limited Use statement:

```text
The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.
```

## Permission Justifications

### `storage`

Stores local preferences, saved workflows, saved capsules, compact session state, diagnostics, and optional local action history.

### `activeTab`

Allows user-triggered popup actions to read and update the current supported chat draft.

### `scripting`

Supports content-script interaction with supported chat pages for user-triggered draft read/write and toolbar behavior.

### `sidePanel` Chromium Only

Opens the Chromium review surface when supported. Firefox uses the browser-aware fallback flow.

### Host Permissions

Host permissions are limited to supported AI chat surfaces where the extension provides visible, user-triggered prompt acceleration:

- `https://chat.openai.com/*`
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `https://gemini.google.com/*`

## Reviewer Test Instructions

```text
LuxCrypta Prompt Accelerator is a local-first prompt/session utility for supported AI chat pages.

Suggested test flow:
1. Install the extension.
2. Open the popup and confirm it renders.
3. Open a supported chat page such as ChatGPT, Claude, or Gemini.
4. Type a draft prompt in the chat input.
5. Use Compress or Focus from the popup or toolbar.
6. Confirm the review surface opens with original text, transformed text, explanation, and diff.
7. Apply or copy the transformed prompt.
8. Open Options and verify local preferences.
9. Save a workflow or capsule, then export/import the local JSON bundle.

No test credentials are provided. Reviewers can use their own supported chat account where login is required by the third-party site.

Expected behavior:
- Actions are user-triggered.
- Prompt/session processing is local-first.
- No telemetry, analytics, backend dependency, hidden cloud sync, or hidden prompt exfiltration is used.
```

## Asset Checklist

Store asset guidance and generated candidate assets live in `store-assets/`.

Required before upload:

- 128x128 store icon from `public/icons/icon128.png`
- at least one screenshot, preferably 3-5
- Chrome 440x280 small promotional tile

Recommended screenshots:

1. Popup with primary actions.
2. Review surface with original/transformed/diff.
3. Session governance panel.
4. Options page with local-first preferences.
5. Supported chat toolbar on a live chat surface.

## Submission Order

1. Publish LuxCrypta website pages.
2. Generate fresh packages and source package.
3. Upload Chrome package to Chrome Developer Dashboard.
4. Upload Firefox package to AMO Developer Hub.
5. Use deferred/manual Chrome publishing if available so both stores can be coordinated.
6. Track review status and patch only store-reported blockers.
7. After approval, install from live store listings and run production smoke.
8. Tag the approved release as `v1.0.0`.
