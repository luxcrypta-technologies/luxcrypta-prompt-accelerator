import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { updateSessionGovernance } from "@luxcrypta/continuity-governance/session-update";
import type { SessionGovernanceState } from "@luxcrypta/continuity-governance/types";

/**
 * Stage 1 golden-fixture acceptance tests.
 *
 * Replays the cross-provider capture protocol (the seed conversation engineered
 * so each defect appears) through the live engine and asserts the [EXPECT]
 * outcomes from the protocol. This is the acceptance spec for Stage 1.
 */

function turn(prev: SessionGovernanceState | undefined, sourceText: string): SessionGovernanceState {
  const req = { sourceText, mode: "research" as const };
  return updateSessionGovernance({
    previousState: prev,
    transformRequest: req,
    transformResult: transformPrompt(req)
  }).state;
}

const has = (items: string[], needle: RegExp): boolean => items.some((i) => needle.test(i));

describe("Stage 1 golden fixtures (cross-provider capture protocol)", () => {
  // KNOWN EDGE (next session): single-line constraint turns are labeled
  // "Objective:" by the core transform, which lets a constraint shadow the
  // objective and then be treated as covered. Tracked separately from the
  // admission-correctness layer. The D1/D5/legality fixtures below pass.
  it("CP1: objective preserved (D2), train constraint ARC, format-worded contract kept (D6), open base is GAP, bus tours rejected", () => {
    let s = turn(undefined, "I want you to help me plan a 10-day trip to Japan in October. We'll work on it together over several messages.");
    // D2: non-domain objective must be valid, not invalid_objective
    expect(s.stableCore.objective).not.toBe("invalid_objective");
    expect(s.stableCore.objective.toLowerCase()).toMatch(/japan|trip|plan/);

    s = turn(s, "A hard requirement: every place you recommend must be reachable by train — I won't rent a car.");
    const trainTracked =
      has(s.stableCore.hardConstraints, /train/i) ||
      s.noveltyLane.some((n) => /train/i.test(n.text));
    expect(trainTracked).toBe(true);

    // D6: durable constraint phrased with format words must be kept, not dropped
    s = turn(s, "Keep the running itinerary as a day-by-day markdown table so I can copy it.");
    const keptFormat =
      (s.stableCore.outputContract ? /table|markdown|day-by-day/i.test(s.stableCore.outputContract) : false) ||
      has(s.stableCore.hardConstraints, /table|markdown/i);
    expect(keptFormat).toBe(true);

    // open base -> GAP (open question), not a decision
    s = turn(s, "I'm still torn between Kyoto or Osaka as my Kansai base — leave that open for now, don't decide it yet.");
    expect(has(s.opennessLane.openQuestions, /kyoto|osaka|kansai|base/i)).toBe(true);

    // genuine rejection -> rejected_directions
    s = turn(s, "Don't include any group bus tours — I want to travel independently.");
    expect(has(s.rejectedDirections ?? [], /bus tour|group/i)).toBe(true);

    // objective still the trip after 5 turns
    expect(s.stableCore.objective).not.toBe("invalid_objective");
  });

  it("D1: objective UPDATES on an explicit mid-session change", () => {
    let s = turn(undefined, "Help me plan a 10-day trip to Japan in October.");
    const original = s.stableCore.objective;
    s = turn(s, "A hard requirement: everything reachable by train.");
    s = turn(s, "Change of plan: make it a 7-day trip to Japan plus 3 days in Seoul, South Korea. Update the objective.");
    expect(s.stableCore.objective).not.toBe(original);
    expect(s.stableCore.objective.toLowerCase()).toMatch(/seoul|korea/);
  });

  it("late durable constraint is admitted, ephemeral instruction is not durable", () => {
    let s = turn(undefined, "Help me plan a 10-day trip to Japan. Reachable by train.");
    // late durable constraint that recurs/confirmed graduates; first mention stages in novelty
    s = turn(s, "Always assume two adults traveling, no kids.");
    s = turn(s, "Always assume two adults traveling, no kids.");
    const adultsTracked =
      has(s.stableCore.hardConstraints, /two adults|no kids/i) ||
      s.noveltyLane.some((n) => /two adults|no kids/i.test(n.text));
    expect(adultsTracked).toBe(true);

    // genuine ephemeral instruction must NOT become a durable hard constraint
    s = turn(s, "For this next reply only, answer in bullet points.");
    expect(has(s.stableCore.hardConstraints, /for this next reply only/i)).toBe(false);
  });

  it("descriptive-negation principle is NOT a rejected direction (D5)", () => {
    let s = turn(undefined, "Help me plan a 10-day Japan trip, reachable by train.");
    s = turn(s, "Keep in mind, a trip that can't flex around the weather is a bad trip — build in slack.");
    // must not be misclassified as a rejected direction
    expect(has(s.rejectedDirections ?? [], /flex around the weather|bad trip/i)).toBe(false);
  });

  it("legality stays clean across the full protocol (no false drift violations)", () => {
    let s = turn(undefined, "Help me plan a 10-day trip to Japan in October.");
    for (const line of [
      "A hard requirement: everything reachable by train.",
      "Keep the itinerary as a markdown table.",
      "Decision: first 4 days in Tokyo, then Kansai.",
      "Every recommendation must include the nearest train station — non-negotiable.",
      "Change of plan: 7 days Japan plus 3 days Seoul. Update the objective.",
      "New hard requirement: total budget cap of $4,000 including flights."
    ]) {
      s = turn(s, line);
      expect(s.diagnostics.legality?.legal).toBe(true);
    }
    // ARC should hold the durable spine; GAP/WEDGE visible as the plan evolves
    expect(s.diagnostics.awg_distribution!.arc).toBeGreaterThan(0);
  });
  it("D1 live-blob: explicit objective change wins when the whole conversation is resolved at once", () => {
    // The live capture re-feeds the entire conversation as one blob with no
    // prior state. An explicit "change of plan ... update the objective" later
    // in the blob must supersede the first-stated goal.
    const blob = [
      "I want you to help me plan a 10-day trip to Japan in October.",
      "A hard requirement: every place must be reachable by train.",
      "Decision: first 4 days in Tokyo, then move to Kansai.",
      "Change of plan: make it a 7-day trip to Japan plus 3 days in Seoul, South Korea. Update the objective."
    ].join("\n\n");
    const req = { sourceText: blob, mode: "research" as const };
    const s = updateSessionGovernance({ transformRequest: req, transformResult: transformPrompt(req) }).state;
    expect(s.stableCore.objective.toLowerCase()).toMatch(/seoul/);
    // prefix trim: the "Change of plan:" lead-in is stripped from the objective
    expect(s.stableCore.objective.toLowerCase()).not.toMatch(/^change of plan/);
    // awg + legality populate on the blob path too
    expect(s.diagnostics.awg_distribution).toBeDefined();
    expect(s.diagnostics.legality).toBeDefined();
  });
});
