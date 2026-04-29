import type { SessionStableCore } from "@/types/governance";

export function StableCoreCard({ core }: { core: SessionStableCore }) {
  return (
    <section className="review-section governance-card">
      <h2>Stable Core</h2>
      <p className="governance-objective">{core.objective}</p>
      <dl className="governance-list">
        <dt>Hard constraints</dt>
        <dd>{core.hardConstraints.length ? core.hardConstraints.join("; ") : "None locked yet."}</dd>
        <dt>Accepted decisions</dt>
        <dd>{core.acceptedDecisions.length ? core.acceptedDecisions.join("; ") : "None retained yet."}</dd>
        {core.outputContract ? (
          <>
            <dt>Output contract</dt>
            <dd>{core.outputContract}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
