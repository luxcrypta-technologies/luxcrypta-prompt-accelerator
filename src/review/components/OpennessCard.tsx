import type { SessionOpennessState } from "@/types/governance";

export function OpennessCard({ openness }: { openness: SessionOpennessState }) {
  return (
    <section className="review-section governance-card">
      <h2>Open / Unresolved</h2>
      <dl className="governance-list">
        <dt>Open questions</dt>
        <dd>{openness.openQuestions.length ? openness.openQuestions.join("; ") : "None tracked yet."}</dd>
        <dt>Uncertainty</dt>
        <dd>{openness.uncertaintyNotes.length ? openness.uncertaintyNotes.join("; ") : "None tracked yet."}</dd>
        <dt>Optional branches</dt>
        <dd>{openness.optionalBranches.length ? openness.optionalBranches.join("; ") : "None tracked yet."}</dd>
      </dl>
      {openness.preservedCreativeSpace ? (
        <p className="governance-muted">Exploratory space is being preserved.</p>
      ) : null}
    </section>
  );
}
