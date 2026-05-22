# Desktop MVP Packaging + Release Checklist

## Objective

Package and validate LuxCrypta Prompt Accelerator Desktop MVP as a distributable local-first desktop application. Keep the cycle focused on packaging, QA, persistence integrity, import/export reliability, and release-candidate readiness.

## Pre-Packaging Verification

Run:

```bash
npm run typecheck
npm test
npm run build:desktop
npm run build:chromium
npm run build:firefox
```

## Packaging Commands

Current host architecture:

```bash
npm run package:desktop:mac
npm run package:desktop:win
npm run package:desktop:linux
```

Unsigned macOS controlled-RC builds:

```bash
npm run package:desktop:mac:unsigned
npm run package:desktop:mac:unsigned:arm64
npm run package:desktop:mac:unsigned:x64
```

Full controlled-RC artifact matrix:

```bash
npm run package:desktop:mac:arm64
npm run package:desktop:mac:x64
npm run package:desktop:win:arm64
npm run package:desktop:win:x64
npm run package:desktop:linux:arm64
npm run package:desktop:linux:x64
```

Useful local smoke-test target:

```bash
npm run package:desktop:dir
```

Artifacts are written to `release/desktop/`.
The normal macOS package commands are signing-ready and use Electron Builder's `CSC_*` / Apple notarization environment variables when provided. Use the explicit unsigned scripts for internal smoke builds that intentionally skip signing.

## Signing Readiness

macOS signing uses a Developer ID Application certificate through `CSC_LINK` + `CSC_KEY_PASSWORD`, or a local keychain identity through `CSC_NAME`. Notarization is activated by Apple credentials such as `APPLE_API_KEY` / `APPLE_API_KEY_ID` / `APPLE_API_ISSUER`, or `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.

Windows signing can use `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` when the Windows certificate should differ from the macOS signing certificate.

Keep signing credentials out of the repo and provide them through the local shell or CI secret store.

## RC QA Checklist

- Create, rename, reload, and switch workspaces.
- Confirm state separation across workspaces.
- Update continuity state and review stable, provisional, unresolved, and health panels.
- Create and reload capsules.
- Save, reuse, and edit workflows through the selected-workflow save path.
- Generate and copy handoffs for ChatGPT, Claude, Gemini, Grok, DeepSeek, and Perplexity.
- Export workspace data, inspect the JSON envelope, import it, and confirm state restoration.
- Restart the packaged app and confirm workspace, capsule, workflow, and session persistence.
- Confirm malformed JSON does not crash app startup.
- Confirm no backend, account, telemetry, automatic sync, or hidden network dependency was added.

## Decision States

- `GO`: packaging, launch, persistence, import/export, privacy, and UI sanity all pass.
- `GO WITH MINOR PATCHES`: packaging and core flows pass; only narrow non-blocking issues remain.
- `NO-GO`: launch, persistence, import/export, provider handoff, privacy posture, or app stability is materially broken.

## Scoring

Score each area 0-2:

- Packaging success
- App launch stability
- Workspace persistence
- Continuity engine behavior
- Capsule behavior
- Workflow behavior
- Provider handoff behavior
- Export/import integrity
- Packaged-mode persistence integrity
- Privacy/local-first integrity
- UI clarity/sanity
- Cross-package runtime integrity

Maximum score: 24. A blocker means `NO-GO` regardless of score.
