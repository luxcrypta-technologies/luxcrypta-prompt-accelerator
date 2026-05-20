# Operational Cognition State

Operational Cognition State is the future persistence primitive for LuxCrypta Prompt Accelerator. It is not a chat log and not a prompt snippet. It preserves the working intelligence of a workflow: mission, active objective, stable constraints, governance principles, rejected directions, accepted decisions, unresolved tensions, risks, transfer notes, reconstruction prompt, lineage, and diagnostics.

Current implementation scope:

- Save Capsule remains the compressed portable continuity object.
- Save Workflow remains the fuller operational environment checkpoint.
- Diagnostic Export remains the engineering/debugging export.
- Operational Cognition State remains a first-class data contract for future product work.

The scaffolded contracts live in:

- `apps/extension/src/types/operational-cognition.ts`
- `packages/continuity-types/src/operational-cognition.ts`

Future storage direction:

- Persist `WorkflowState` by `workflow_id`.
- Persist `CognitionState` as versioned records under a parent workflow.
- Persist `Capsule` records as portable reconstruction artifacts linked by `parent_workflow_id`.
- Persist `DiagnosticState` records as an append-only diagnostic history.

The UI should not flatten these into one generic save feature. Workflow, Capsule, Diagnostic State, and Cognition State are separate primitives with separate retrieval and reconstruction jobs.
