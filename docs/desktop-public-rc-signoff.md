# Desktop Public RC Final Sign-Off

## Scope

This gate promotes the packaged desktop MVP to a public release candidate only if final release mechanics pass:

- macOS signing and notarization readiness
- Windows release trust and native smoke
- Linux native smoke
- packaged runtime validation
- privacy and local-first validation

Do not add features or redesign UI during this cycle. Patch only true release blockers.

## Current Status

- Electron desktop packaging implemented.
- macOS, Windows, and Linux artifacts generated.
- macOS packaged app smoke-tested.
- Continuity update, capsule save, and restart persistence work in packaged mode.
- Local-first persistence and export/import paths are hardened.
- Typecheck, tests, desktop build, Chromium build, and Firefox build pass.

Remaining gates:

- Signed/notarized macOS validation.
- Native Windows smoke test.
- Native Linux smoke test.

## macOS Signing And Notarization

Checklist:

- Confirm `com.luxcrypta.promptaccelerator.desktop` is the final bundle identifier.
- Confirm product metadata: app name, version, icon, and publisher fields.
- Confirm unsigned packaged app launches locally.
- Provide signing credentials through environment or keychain.
- Produce signed macOS build.
- Verify signature.
- Submit for notarization when required.
- Staple notarization ticket when applicable.
- Re-test workspace create/load, continuity update, capsule save, export/import, and restart persistence.
- Record install friction, warnings, or trust dialogs.

Pass condition:

- A signed build is generated, notarization is complete or ready for the chosen release path, and the signed build still passes core runtime checks.

## Windows Release Trust And Native Smoke

Checklist:

- Confirm product name, version, publisher metadata, and icon.
- Generate installer and portable build.
- Sign Windows binaries/installers when a certificate is available.
- Verify installer and portable launch on a real Windows machine.
- Record SmartScreen or trust warnings.
- Test workspace create/rename/load, continuity update, stable/provisional/open review, capsule save, workflow save, provider selection, handoff preview/copy, export/import, and restart persistence.

Pass condition:

- Windows package installs or launches correctly, runtime behavior is correct, and trust/signing status is documented.

## Linux Native Smoke

Checklist:

- Test AppImage or deb on a real Linux machine or reliable native Linux environment.
- Verify launch, UI render, workspace create/load, continuity update, capsule save, workflow save, provider selection, handoff preview/copy, export/import, and restart persistence.

Pass condition:

- Core flows work natively with no blocker-level runtime or persistence issue.

## Packaged Runtime Integrity

Verify on packaged builds:

- Shared packages resolve correctly.
- No path assumptions depend on dev mode.
- Local persistence works in packaged mode.
- Export and import work in packaged mode.
- Versioned envelopes are written correctly.
- Malformed imports fail gracefully.
- Restart persistence works.
- No packaged-only core crash appears.

## Privacy And Local-First Verification

Verify on packaged builds:

- No hidden outbound network calls.
- No telemetry.
- No automatic sync.
- No hidden account dependency.
- Core state remains local.
- Export/import remains manual and explicit.

## Blockers

Any blocker is `NO-GO`:

- Signed/notarized macOS build fails to launch.
- Windows native build fails to install or launch reliably.
- Linux native build fails to launch reliably.
- Packaged build loses or corrupts workspace/session/capsule/workflow state.
- Export/import corrupts continuity data.
- Shared-package resolution fails in packaged mode.
- Privacy/local-first posture regresses.
- Core continuity update flow breaks in packaged mode.
- Capsule/workflow save or reload fails in packaged mode.
- Severe packaged-only crash occurs during core use.

## Scoring

Score each area 0-2:

- A. macOS packaging/signing readiness
- B. macOS runtime integrity
- C. Windows packaging/trust readiness
- D. Windows native runtime integrity
- E. Linux packaging/runtime integrity
- F. Workspace persistence integrity
- G. Continuity engine packaged behavior
- H. Capsule/workflow packaged behavior
- I. Export/import packaged integrity
- J. Privacy/local-first packaged integrity
- K. Shared-package resolution integrity
- L. Overall desktop release confidence

Maximum score: 24.

Decision guide:

- 22-24 and no blockers: `GO`
- 18-21 and no blockers: `GO WITH MINOR PATCHES`
- 17 or below: `NO-GO`
- Any blocker: `NO-GO`

## Final Sign-Off Template

```text
Desktop Public RC Decision:
- GO / GO WITH MINOR PATCHES / NO-GO

Total Score:
- __ / 24

Blockers Found:
- None / list

High-Severity Issues:
- None / list

macOS Signing / Notarization Readiness:
- Pass / Fail
Notes:

Windows Release Trust / Native Runtime:
- Pass / Fail
Notes:

Linux Native Runtime:
- Pass / Fail
Notes:

Packaged Persistence Integrity:
- Pass / Fail
Notes:

Export / Import Integrity:
- Pass / Fail
Notes:

Privacy / Local-First Integrity:
- Pass / Fail
Notes:

Shared-Core Runtime Integrity:
- Pass / Fail
Notes:

Required Patch List Before Final GO:
1.
2.
3.

Recommended Post-RC Improvements:
1.
2.
3.

Final Sign-Off:
- Approved for public release candidate
- Approved after minor patch cycle
- Not approved
```
