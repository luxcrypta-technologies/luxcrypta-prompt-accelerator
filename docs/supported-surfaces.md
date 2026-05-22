# Supported Surfaces

V1 supports these chat pages:

- ChatGPT: `https://chat.openai.com/*`, `https://chatgpt.com/*`
- Claude: `https://claude.ai/*`
- Gemini: `https://gemini.google.com/*`
- Grok: `https://grok.com/*`
- DeepSeek: `https://chat.deepseek.com/*`, `https://deepseek.com/chat*`, `https://www.deepseek.com/chat*`
- Perplexity: `https://perplexity.ai/*`, `https://www.perplexity.ai/*`

Each surface adapter owns its selectors and degrades safely if the page changes.

DeepSeek and Perplexity are provider-expansion adapters for continuity validation. Keep release copy conservative until live smoke checks confirm the current production DOMs.

The desktop MVP supports provider-targeted continuity handoff packaging for:

- ChatGPT
- Claude
- Gemini
- Grok
- DeepSeek
- Perplexity

Desktop support is explicit copy/export handoff formatting, not provider automation or hidden integration with model internals.
