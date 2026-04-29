# Capsules

Carry-forward capsules are compact JSON summaries generated from shallow, user-triggered conversation snapshots.

They contain:

- objective
- constraints
- decisions
- open questions
- preferred mode

They are stored locally and can be exported manually as part of an export bundle.

When session governance state exists, capsule generation prioritizes the governed stable core:

- stable objective
- accepted hard constraints
- accepted decisions
- unresolved questions that still matter
- preferred mode

This keeps long-session continuation compact without silently dropping open questions or new/provisional items.
