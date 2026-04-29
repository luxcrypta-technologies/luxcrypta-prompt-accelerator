import type { SessionDiagnostics, SessionGovernanceState, SessionMonitors, SessionNoveltyItem, SessionOpennessState, SessionStableCore } from "@/types/governance";

function summarizeCore(core: SessionStableCore): string[] {
  return [
    `Objective: ${core.objective}`,
    core.hardConstraints.length ? `${core.hardConstraints.length} hard constraint(s) preserved.` : "No hard constraints preserved yet.",
    core.acceptedDecisions.length ? `${core.acceptedDecisions.length} accepted decision(s) retained.` : "No accepted decisions retained yet.",
    core.outputContract ? `Output contract: ${core.outputContract}` : "No output contract locked yet."
  ];
}

function summarizeNovelty(novelty: SessionNoveltyItem[]): string[] {
  const active = novelty.filter((item) => !item.accepted);
  if (!active.length) return ["No unresolved new or provisional items."];
  return active.slice(0, 6).map((item) => `${item.kind.replace(/_/g, " ")}: ${item.text}`);
}

function summarizeOpenness(openness: SessionOpennessState): string[] {
  const summary: string[] = [];
  if (openness.openQuestions.length) summary.push(`${openness.openQuestions.length} open question(s) preserved.`);
  if (openness.uncertaintyNotes.length) summary.push(`${openness.uncertaintyNotes.length} uncertainty note(s) preserved.`);
  if (openness.optionalBranches.length) summary.push(`${openness.optionalBranches.length} optional branch(es) preserved.`);
  if (openness.preservedCreativeSpace) summary.push("Exploratory space is still being preserved.");
  return summary.length ? summary : ["No open or unresolved items tracked yet."];
}

function warningsFor(monitors: SessionMonitors): string[] {
  const warnings: string[] = [];
  if (monitors.driftScore >= 65) warnings.push("Stable core is changing quickly; review before applying more changes.");
  if (monitors.noveltyLoad >= 55) warnings.push("New/provisional items are accumulating; promote or discard them soon.");
  if (monitors.opennessScore < 15) warnings.push("Open questions may be getting compressed too aggressively.");
  return warnings;
}

function suggestionsFor(monitors: SessionMonitors): string[] {
  const suggestions: string[] = [];
  if (monitors.noveltyLoad > 0) suggestions.push("Review new/provisional items and promote the ones that are now accepted.");
  if (monitors.opennessScore < 30) suggestions.push("Add or preserve unresolved questions if this is still exploratory.");
  if (monitors.compressionDensity < 35) suggestions.push("Consider a shorter carry-forward capsule for the next turn.");
  return suggestions.length ? suggestions : ["Continue with the current stable core."];
}

export function generateSessionDiagnostics(state: Omit<SessionGovernanceState, "diagnostics">, timestamp: string): SessionDiagnostics {
  return {
    stableCoreSummary: summarizeCore(state.stableCore),
    noveltySummary: summarizeNovelty(state.noveltyLane),
    opennessSummary: summarizeOpenness(state.opennessLane),
    warnings: warningsFor(state.monitors),
    actionsSuggested: suggestionsFor(state.monitors),
    generatedAt: timestamp
  };
}
