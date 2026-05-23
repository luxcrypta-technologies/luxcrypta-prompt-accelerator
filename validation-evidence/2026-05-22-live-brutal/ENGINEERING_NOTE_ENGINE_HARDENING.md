# Continuity Engine Hardening Note

## Changed

- Moved review bucket construction onto role-aware `GovernanceStatement` extraction so speaker/source provenance is retained through Stable Core, Open / Unresolved, and Provisional state selection.
- Restricted Stable Core admission to user-authored or trusted-prior statements from explicit stable/objective sections, plus parsed capsule state. Flattened assistant prose no longer qualifies after provenance is lost.
- Expanded section and semantic recognizers for mission, stable constraints, stable requirements, accepted decisions, open questions, open tensions, unresolved tensions, recovery mechanisms, reconstruction instructions, cross-model transfer notes, operational risks, and priority models.
- Reset section carryover when a new speaker block starts, preventing an earlier user/assistant section from contaminating later turns.
- Treated retrieved evidence lines as retrieved external content during statement splitting, not as whatever durable bucket happened to be active previously.

## Hardened

- Assistant-authored reconstruction prose such as "A future model reconstructing this state must..." and "Restore the mission exactly" now fails closed into quarantine unless explicitly promoted.
- Stable constraints such as "Preserve governance integrity" and "Do not overwrite trusted state" are preserved as invariants instead of collapsing into Stable Core.
- Rejected directions remain primary rejected items, with cross-refs only when they also mention governance.
- Open / Unresolved parsing now handles `Open / Unresolved`, `Open question`, `Open tensions`, and related labels with slash/spacing variations.
- Open-state loss scoring no longer treats bare category names like "unresolved tensions" as lost open content, but still flags real unresolved items when present and dropped.

## Metrics

- Assistant-authored durable-state contamination is now scored as a stronger source purity and durable precision failure.
- Governance, invariant, and rejected-direction loss penalties were raised.
- Captured live ChatGPT Prompt 2 replay after this patch removes assistant reconstruction text from Stable Core, preserves governance/invariants/rejections, and records blocked assistant items in admission counts.

## Remaining Risks

- Bucket exclusivity scoring is still conservative when many legitimate cross-refs are produced; this may need a distinction between prevented collisions and actual duplicate primary admission.
- Live browser re-validation should be rerun against ChatGPT with the rebuilt extension before expanding back to Claude/Gemini/Grok/Perplexity/DeepSeek.
- Provider-specific extraction may still need separate tuning once the core engine is no longer failing on the captured ChatGPT path.
