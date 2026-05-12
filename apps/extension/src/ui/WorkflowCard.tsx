import type { Workflow } from "@/types/workflows";

export function WorkflowCard({ workflow }: { workflow: Workflow }) {
  return (
    <article className="ui-card">
      <h3>{workflow.title}</h3>
      <p>{workflow.objective}</p>
      <div className="ui-card__meta">
        <span>{workflow.mode.replace("_", " ")}</span>
        {workflow.targetModel ? <span>{workflow.targetModel}</span> : null}
      </div>
    </article>
  );
}
