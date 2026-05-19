# Final Desktop RC Closeout Checklist

## Goal

Move LuxCrypta Prompt Accelerator Desktop from `GO WITH MINOR PATCHES` to `GO`.

This checklist is only for:

- Apple signing and notarization
- Windows native smoke
- Linux native smoke
- final privacy and local-first verification

Do not add features, redesign UI, or change continuity/governance logic unless a real blocker is found.

## Apple Signing And Notarization

- [ ] Apple signing credentials available
- [ ] macOS build signed successfully
- [ ] notarization submitted successfully
- [ ] notarization completed successfully
- [ ] notarization ticket stapled if applicable
- [ ] signed/notarized app launches on macOS
- [ ] packaged app still loads workspace correctly
- [ ] continuity update still works
- [ ] capsule save still works
- [ ] export/import still works
- [ ] restart persistence still works

Pass condition:

- [ ] signed/notarized macOS build works with no blocker-level regression

## Windows Native Smoke

Test on a real Windows machine.

- [ ] installer or portable build launches
- [ ] main UI renders correctly
- [ ] workspace create/load works
- [ ] continuity update works
- [ ] capsule save works
- [ ] workflow save works
- [ ] provider target selection works
- [ ] handoff preview/copy works
- [ ] export/import works
- [ ] restart persistence works
- [ ] no blocker-level crash appears

Pass condition:

- [ ] core desktop MVP works natively on Windows

## Linux Native Smoke

Test on a real Linux machine or reliable native Linux environment.

- [ ] packaged app launches
- [ ] UI renders correctly
- [ ] workspace create/load works
- [ ] continuity update works
- [ ] capsule save works
- [ ] workflow save works
- [ ] provider target selection works
- [ ] handoff preview/copy works
- [ ] export/import works
- [ ] restart persistence works
- [ ] no blocker-level runtime issue appears

Pass condition:

- [ ] core desktop MVP works natively on Linux

## Privacy And Local-First Check

- [ ] no hidden outbound network calls
- [ ] no telemetry added
- [ ] no account requirement introduced
- [ ] all core state remains local
- [ ] export/import remains manual and explicit

Pass condition:

- [ ] desktop RC still preserves local-first behavior

## Final Decision Rule

Promote to `GO` if:

- [ ] Apple signing/notarization pass
- [ ] Windows native smoke pass
- [ ] Linux native smoke pass
- [ ] no blockers found
- [ ] no privacy regression found

Stay at `GO WITH MINOR PATCHES` if:

- [ ] only narrow install/trust friction remains
- [ ] no continuity or persistence blocker exists

Use `NO-GO` if:

- [ ] packaged runtime breaks on a target platform
- [ ] persistence fails
- [ ] export/import corrupts state
- [ ] privacy/local-first posture regresses

## Final Sign-Off Template

```text
Desktop Final Release Decision:
- GO / GO WITH MINOR PATCHES / NO-GO

Apple Signing / Notarization:
- Pass / Fail
Notes:

Windows Native Smoke:
- Pass / Fail
Notes:

Linux Native Smoke:
- Pass / Fail
Notes:

Privacy / Local-First Integrity:
- Pass / Fail
Notes:

Blockers:
- None / list

Required Final Patches:
1.
2.
3.

Final Sign-Off:
- Approved for desktop public release
- Approved after minor patch cycle
- Not approved
```
