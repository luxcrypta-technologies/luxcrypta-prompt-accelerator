# Prompt Accelerator

A local-first browser extension that gives a long AI chat session **continuity**.

It reads the conversation on the page, builds a structured snapshot of it — your active objective, the constraints and decisions that have actually stuck, and the questions still open — and lets you copy that snapshot as a portable text **capsule** you can paste into a different model to pick up exactly where you left off.

It runs entirely in your browser, stores nothing remotely, and works across **Claude, ChatGPT, Gemini, Grok, DeepSeek, and Perplexity**.

[![Watch the demo](https://img.youtube.com/vi/aBVWjn6nCSEtqvAyeMC34A/maxresdefault.jpg)](https://youtube.com/shorts/jn6nCSEtqvA)

> **[▶ Watch the demo on YouTube](https://youtube.com/shorts/aBVWyeMC34A)**

---

## Why

Long AI sessions degrade. As a conversation grows, constraints get forgotten, the objective drifts, earlier decisions get contradicted, and open questions quietly disappear — so you end up re-explaining context or starting over. Bigger context windows don't fix this on their own; the state still isn't tracked, separated, or movable.

Prompt Accelerator tracks that state explicitly and lets you carry it with you.

---

## How it works

- **Per-surface capture.** Each supported site has a dedicated capture adapter, so the extension reads the *real* conversation on that surface rather than guessing from generic page text.
- **State separation.** A local continuity engine sorts the session into what's *stable* (validated constraints and decisions), what's *provisional/new*, and what's *unresolved or ruled out* — instead of letting everything blur together.
- **Continuity Review.** A periodic, continuity-aware reconstruction of the session that surfaces drift instead of silently absorbing it, and produces a readiness verdict for whether the state is coherent enough to hand off.
- **Portable Capsule.** One click serializes the reviewed state — objective, durable constraints/decisions, open conditions, source platform, and detected model — into a self-contained text snapshot you can move to another session, model, or tool.

As of **v2.5.8**, capsule hand-off is validated across all six supported models.

---

## Install

**One click:**

- **Chrome / Chromium:** [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/luxcrypta-prompt-accelera/cmefhfgeajmgkaiofknkgfeiaojggnck)
- **Firefox:** [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/luxcrypta-prompt-accelerator/)

**Build from source (for developers):**

```bash
npm install
npm run build:chromium   # output: dist/chromium
npm run build:firefox    # output: dist/firefox
```

- Chrome / Chromium: open `chrome://extensions`, enable Developer mode, "Load unpacked", select `dist/chromium`.
- Firefox: open `about:debugging` → This Firefox → "Load Temporary Add-on", select a file in `dist/firefox`.

Run tests and type checks:

```bash
npm test
npm run typecheck
```

---

## Privacy

Prompt Accelerator runs entirely in your browser. It collects no data and sends nothing to any server — no analytics, no telemetry, no remote calls. Continuity state lives locally on your device. The extension requests only minimal permissions (local storage, plus the side panel on Chromium) and runs only on the supported AI domains.

---

## Features

- **Portable Capsule** — copy the workflow's continuity state as a structured, self-contained snapshot you can paste into another model to resume work.
- **Continuity Review** — reconstruct session state on demand; separates stable from new/unresolved/rejected and surfaces drift.
- **Workflow Save / Capsule Save** — persist a workflow or capsule locally so long-horizon work survives across sessions.
- **Engineering / Workflow Export** — structured exports of the reviewed state for downstream use.

---

## Supported surfaces

| Surface | Notes |
|---|---|
| Claude | Full multi-turn capture |
| ChatGPT | Full multi-turn capture |
| Gemini | Full multi-turn capture |
| Grok | Full multi-turn capture |
| DeepSeek | Full multi-turn capture |
| Perplexity | Captures the user query and governs retrieved sources (search surface) |

The continuity engine is provider-independent; each surface has its own capture adapter. Capture is heuristic by nature — if a provider changes its page structure, an adapter may need an update. Issue reports for a specific surface are welcome.

---

## Continuity Engineering

Prompt Accelerator comes out of a line of work LuxCrypta calls **Continuity Engineering** — the premise that AI systems fail in practice not because the model is weak, but because *continuity degrades faster than intelligence improves*. Once a workflow's objective, constraints, and decisions stop being tracked, the smartest model still drifts.

Continuity Engineering treats a workflow as an evolving, state-bearing system that should be inspectable and movable, rather than a stream of disconnected prompts. Prompt Accelerator is the first practical tool built on that idea. Background and research: https://luxcrypta.ai

---

## License

MIT. See [LICENSE](LICENSE).

---

## Company

LUXCRYPTA Technologies LLC — Continuity Engineering for governable AI systems.
Website: https://luxcrypta.ai
