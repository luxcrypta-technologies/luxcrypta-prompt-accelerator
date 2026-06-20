import { describe, expect, it } from "vitest";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";

// F5: a user request phrased entirely as a question is a VALID objective.
// The live temp-chat capsule for "What is a fantastic recipe to make a
// blueberry pie without sugar but using monk fruit?" came back with
// active_objective = "invalid_objective" (and UNSAFE_FOR_HANDOFF), because the
// objective deriver treated any text containing "?" as a constraint/open item
// and, when the whole request was question-form, found no candidate and emitted
// the invalid sentinel. A question can be the objective.
function objectiveFor(text: string): string {
  return transformPrompt({ sourceText: text, mode: "precision" }).continuityReview.activeObjective;
}

describe("F5: question-form requests yield a valid objective", () => {
  it("does not return invalid_objective for a single question request", () => {
    const obj = objectiveFor(
      "What is a fantastic recipe to make a blueberry pie without sugar but using monk fruit?"
    );
    expect(obj).not.toBe("invalid_objective");
    expect(obj.toLowerCase()).toContain("blueberry");
  });

  it("does not return invalid_objective for a multi-question request", () => {
    const obj = objectiveFor(
      "What is a fantastic recipe to make a blueberry pie without sugar but using monk fruit?\n" +
        "I'm trying to be more keto-friendly. Is there a type of dough or crust that doesn't have much sugar?"
    );
    expect(obj).not.toBe("invalid_objective");
  });

  it("still prefers a clear imperative objective over a trailing question", () => {
    const obj = objectiveFor(
      "Plan a 5-day Tokyo itinerary. Should I include a day trip to Hakone?"
    );
    expect(obj).not.toBe("invalid_objective");
    expect(obj.toLowerCase()).toContain("tokyo");
  });
});
