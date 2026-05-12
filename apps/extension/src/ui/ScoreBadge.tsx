import type { TransformationScores } from "@/types/prompts";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ScoreBadge({ scores }: { scores: TransformationScores }) {
  return (
    <div className="score-badges" aria-label="Transformation scores">
      <span>Compact {percent(scores.compactnessScore)}</span>
      <span>Constraints {percent(scores.constraintPreservationScore)}</span>
      <span>Risk {percent(scores.riskScore)}</span>
    </div>
  );
}
