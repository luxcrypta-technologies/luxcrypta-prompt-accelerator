# Browser Portability

The extension uses a WebExtensions-style baseline with target-specific manifests.

- Chromium build: MV3 service worker and side panel when available.
- Firefox build: MV3 background scripts and review-tab fallback.
- Core logic does not import runtime APIs.
- Review behavior is selected through capability detection.

Chromium ships first. Firefox remains architecture-ready through the platform layer and split manifest.
