import type { CarryForwardCapsule } from "@/types/capsules";

export function CapsuleCard({ capsule }: { capsule: CarryForwardCapsule }) {
  return (
    <article className="ui-card">
      <h3>{capsule.title}</h3>
      <p>{capsule.objective}</p>
      <div className="ui-card__meta">
        <span>{capsule.constraints.length} constraints</span>
        <span>{capsule.decisions.length} decisions</span>
      </div>
    </article>
  );
}
