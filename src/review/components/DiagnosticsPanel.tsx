import type { SessionDiagnostics, SessionMonitors } from "@/types/governance";

export function DiagnosticsPanel({
  diagnostics,
  monitors,
  expanded
}: {
  diagnostics: SessionDiagnostics;
  monitors: SessionMonitors;
  expanded: boolean;
}) {
  return (
    <details className="review-section diagnostics-panel" open={expanded}>
      <summary>Advanced diagnostics</summary>
      <div className="health-grid">
        <span>Continuity {monitors.continuityScore}%</span>
        <span>Drift {monitors.driftScore}%</span>
        <span>Novelty {monitors.noveltyLoad}%</span>
        <span>Openness {monitors.opennessScore}%</span>
        <span>Density {monitors.compressionDensity}%</span>
        <span>Status {monitors.sessionHealth}</span>
      </div>
      {diagnostics.warnings.length ? (
        <>
          <h3>Warnings</h3>
          <ul>
            {diagnostics.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h3>Suggested actions</h3>
      <ul>
        {diagnostics.actionsSuggested.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </details>
  );
}
