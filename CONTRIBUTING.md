# Contributing

Thanks for helping improve LuxCrypta Prompt Accelerator.

Keep contributions aligned with the v1 boundaries:

- Keep core logic browser-independent.
- Keep browser runtime calls inside platform adapters.
- Keep transformations deterministic and local.
- Avoid adding backend services or hidden remote calls.
- Keep public UI language plain and user-facing.

Run these checks before submitting changes:

```bash
npm run typecheck
npm test
npm run build:chromium
npm run build:firefox
```
