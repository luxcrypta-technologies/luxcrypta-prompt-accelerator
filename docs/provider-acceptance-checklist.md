# Provider Acceptance Checklist

Use this checklist for the live cross-provider acceptance pass after the final cleanup. The goal is to confirm real behavior on provider pages, not just build or unit correctness.

## Capture Format

For each provider, capture:

- Before input: raw draft or prompt body used for the test.
- Prompt Review output: screenshot or copied block showing Stable Core, Provisional State, Open / Unresolved, Rejected Directions, Governance Principles, Invariants, Quarantine / Deferred, Metric Warnings, Provider Health, and Raw JSON.
- Copy proof: paste result from at least one section Copy button and one Copy JSON button.
- Score proof: continuity/risk/source-purity/bucket-exclusivity metrics when available.
- Advanced proof: whether Advanced opened on first click, after retry, or surfaced a visible failure state.

Record each outcome as Pass, Fail, or Needs Investigation with one sentence of evidence.

## Shared Acceptance Gates

- Prompt scaffolding is not admitted as durable Stable Core.
- Task-local answer instructions are separated from durable continuity state.
- Assistant/model-authored text is quarantined or provisional unless explicitly user-promoted.
- Page chrome and extension UI text do not enter admitted continuity state.
- Each semantic item has one authoritative primary bucket.
- Rejected Directions contains only durable operational exclusions.
- Scores drop when chrome contamination, assistant contamination, bucket overlap, rejected-direction ambiguity, or empty-state collapse occurs.
- Prompt Review section Copy and Copy JSON buttons work for every major block.
- Copy All Review, Copy Review + Raw JSON, and Copy Engineering Summary work.
- Advanced click has no silent no-op; retry or visible failure state appears when open fails.

## Perplexity

Primary risk: page chrome and retrieval scaffolding replacing the real draft body.

Test prompt should include:

- A clear Objective.
- Stable Core or hard requirements.
- Governance Principles.
- Invariants.
- Open / Unresolved item.
- Retrieved evidence marked provisional.
- Nearby UI/chrome text such as Show more / Show less if present naturally on page.

Pass criteria:

- Stable Core, Governance Principles, Invariants, and Open / Unresolved populate from the real draft body.
- "Show more", "Show less", copy/share/source labels, and related UI text do not appear in Stable Core, Provisional State, or Rejected Directions.
- Retrieved evidence is Provisional or Quarantine unless explicitly promoted.
- If the runtime cannot find a real body, it fails closed with diagnostics rather than admitting chrome.

## DeepSeek

Primary risk: schema fusion and legitimate content being dumped into Rejected Directions.

Test prompt should include:

- Trusted State.
- Governance Principles.
- Invariants.
- Continuity Safeguards.
- Rejected Directions.
- Deferred Items.
- Mutation Targets.
- Open tensions.

Pass criteria:

- Category headers such as Mission, Invariants, Failure Modes, and Tensions are not classified as rejected content.
- Genuine governance and invariant content lands in Governance Principles or Invariants.
- Rejected Directions contains only true durable "do not do this again" exclusions.
- Bucket overlap is materially reduced and metric warnings reflect any remaining ambiguity.

## Gemini

Primary risk: preserving rich content from the wrong source.

Test prompt should include:

- User-authored trusted state.
- A pasted block explicitly labeled as assistant/model output, for example "assistant: Gemini said...".
- A user question asking to analyze the pasted model output without adopting it.

Pass criteria:

- User-authored state can enter Stable Core.
- Assistant/model-authored block does not enter Stable Core by default.
- Model output is tagged as untrusted, provisional, or quarantined unless the user explicitly says adopt/promote/save/remember.
- Scores penalize any assistant contamination.

## Claude

Primary risk: assistant echo canonization.

Test prompt should include:

- Durable user-authored governance/state.
- Prior assistant-authored wording pasted for comparison.
- No explicit user adoption language.

Pass criteria:

- Claude-specific wording is not treated as canonical stable state.
- Assistant-derived material defaults to Provisional or Quarantine.
- Governance hierarchy remains intact.
- Prompt scaffolding and answer-contract phrasing are not over-preserved.

## ChatGPT

Primary risk: clean extraction but over-sticky prompt mechanics.

Test prompt should include:

- Durable mission/governance content.
- Formatting instructions such as "use a table", "end with a score", or "separate into six sections".
- A rejected direction that is truly durable.

Pass criteria:

- Durable mission/governance survives.
- Formatting instructions are task-local, not Stable Core.
- Rejected Directions is not polluted by prompt-local forbidden text.
- Continuity score is not perfect if scaffolding leakage occurs.

## Grok

Primary risk: mild over-preservation of how-to-answer directives.

Test prompt should include:

- Stable user-authored continuity state.
- Output-contract instructions.
- Open/unresolved tension.
- Rejected direction.

Pass criteria:

- Stable state stays clean and selective.
- Output-contract instructions are demoted unless clearly durable.
- Open / Unresolved and Rejected Directions remain distinct.
- Grok remains a high-performing baseline without over-admitting prompt mechanics.

## Acceptance Summary Template

| Provider | Body extraction | Source purity | Bucket integrity | Copy controls | Advanced open | Scoring realism | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Perplexity |  |  |  |  |  |  |  |
| DeepSeek |  |  |  |  |  |  |  |
| Gemini |  |  |  |  |  |  |  |
| Claude |  |  |  |  |  |  |  |
| ChatGPT |  |  |  |  |  |  |  |
| Grok |  |  |  |  |  |  |  |

## Ship Gate

Do not call the cleanup accepted until every provider has either:

- Pass across all shared gates, or
- A documented Needs Investigation item with copied Prompt Review evidence and Raw JSON showing why the remaining issue is provider-surface-specific rather than runtime classification failure.
