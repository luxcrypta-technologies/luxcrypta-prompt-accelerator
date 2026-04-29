import type { SessionGovernanceState } from "@/types/governance";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { NoveltyCard } from "./NoveltyCard";
import { OpennessCard } from "./OpennessCard";
import { StableCoreCard } from "./StableCoreCard";

export function SessionStatePanel({
  state,
  showDiagnostics,
  onPromote
}: {
  state: SessionGovernanceState | null;
  showDiagnostics: boolean;
  onPromote: (id: string) => void;
}) {
  if (!state) {
    return (
      <section className="review-section">
        <h2>Session State</h2>
        <p className="governance-muted">Session governance has not started for this review yet.</p>
      </section>
    );
  }

  return (
    <section className="session-state-panel">
      <header className="session-state-header">
        <h2>Session Health</h2>
        <span className={`health-pill health-pill--${state.monitors.sessionHealth}`}>
          {state.monitors.sessionHealth}
        </span>
      </header>
      <div className="review-grid">
        <StableCoreCard core={state.stableCore} />
        <NoveltyCard items={state.noveltyLane} onPromote={onPromote} />
        <OpennessCard openness={state.opennessLane} />
        <section className="review-section governance-card">
          <h2>Continuity</h2>
          <div className="health-grid">
            <span>Continuity {state.monitors.continuityScore}%</span>
            <span>Drift {state.monitors.driftScore}%</span>
            <span>Novelty {state.monitors.noveltyLoad}%</span>
            <span>Openness {state.monitors.opennessScore}%</span>
          </div>
        </section>
      </div>
      <DiagnosticsPanel diagnostics={state.diagnostics} monitors={state.monitors} expanded={showDiagnostics} />
    </section>
  );
}
