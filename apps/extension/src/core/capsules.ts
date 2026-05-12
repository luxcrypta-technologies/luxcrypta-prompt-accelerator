import { extractConstraints } from "./constraints";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { ModeName } from "@/types/modes";
import type { ConversationSnapshot } from "@/types/surfaces";
import { createDatedId } from "@/utils/ids";
import { nowIso } from "@/utils/time";
import { firstMeaningfulLine, uniqueStrings } from "@/utils/text";

function inferMode(text: string): ModeName | undefined {
  const lower = text.toLowerCase();
  if (/\b(code|typescript|bug|test|api|component)\b/.test(lower)) return "code";
  if (/\b(research|source|cite|compare|evidence)\b/.test(lower)) return "research";
  if (/\b(summary|executive|recommendation)\b/.test(lower)) return "executive_summary";
  if (/\b(argue|debate|tradeoff|counterargument)\b/.test(lower)) return "debate";
  if (/\b(creative|ideas|brainstorm)\b/.test(lower)) return "creative";
  return "focus";
}

function extractDecisions(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => /\b(decided|decision|we will|chosen|approved)\b/i.test(line))
    .slice(0, 8);
}

function extractOpenQuestions(text: string): string[] {
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("?") || /\b(open question|unclear|needs confirmation)\b/i.test(line))
    .slice(0, 8);
}

export function createCapsuleFromSnapshot(
  snapshot: ConversationSnapshot | undefined,
  sourceSurface?: string
): CarryForwardCapsule {
  const timestamp = nowIso();
  const turns = snapshot?.turns ?? [];
  const joined = turns.map((turn) => turn.text).join("\n");
  const sourceText = joined || "Continue this session with the same objective and constraints.";
  const constraints = extractConstraints(sourceText).map((constraint) => constraint.text);
  const title = snapshot?.title || firstMeaningfulLine(sourceText, "Carry-forward capsule");
  const userTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const objective = firstMeaningfulLine(userTurns.join("\n") || sourceText, "Continue the active session.");

  return {
    capsule_version: 1,
    id: createDatedId("capsule", `${title}:${sourceText.slice(0, 120)}`, timestamp),
    title,
    objective,
    constraints: uniqueStrings(constraints).slice(0, 10),
    decisions: uniqueStrings(extractDecisions(sourceText)).slice(0, 8),
    open_questions: uniqueStrings(extractOpenQuestions(sourceText)).slice(0, 8),
    preferred_mode: inferMode(sourceText),
    notes: "Generated from a shallow, user-triggered session snapshot.",
    sourceSurface,
    created_at: timestamp,
    updated_at: timestamp
  };
}
