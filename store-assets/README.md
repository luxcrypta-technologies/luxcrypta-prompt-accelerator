# Store Assets

This directory contains store-listing asset guidance and generated candidate images for LuxCrypta Prompt Accelerator.

## Required Chrome Assets

- Store icon: use `public/icons/icon128.png`
- Screenshot: at least one 1280x800 or 640x400 image
- Small promotional tile: 440x280 PNG or JPEG

## Recommended Asset Set

- `screenshots/popup-1280x800.png`
- `screenshots/review-1280x800.png`
- `screenshots/session-governance-1280x800.png`
- `screenshots/options-1280x800.png`
- `screenshots/supported-toolbar-1280x800.png`
- `chrome/screenshots/*.png`
- `firefox/screenshots/*.png`
- `chrome/small-promo-440x280.png`
- `chrome/marquee-1400x560.png`

The generated images are submission candidates. Before uploading, compare them against the current live extension and replace any image that no longer matches the product UI.

The Chrome and Firefox screenshot folders contain 1280x800 PNG copies of the common screenshot set. Chrome requires 1280x800 or 640x400 screenshots; Firefox recommends 1280x800 and otherwise a 1.6:1 ratio.

Regenerate the screenshot set with:

```bash
node apps/extension/scripts/generate-store-screenshots.mjs
```

## Screenshot Guidance

Screenshots should show the actual user experience:

- popup actions
- review and diff flow
- governance/session state
- options and local-first controls
- toolbar on a supported chat surface

Keep screenshots clear, full bleed, and free of unsupported claims.
