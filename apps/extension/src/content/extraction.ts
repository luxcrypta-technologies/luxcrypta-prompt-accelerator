import { stripProviderChromeLines } from "@/surfaces/dom";
import type { ChatSurfaceAdapter, ConversationSnapshot, ProviderHealth } from "@/types/surfaces";

export interface AuthoredSourceExtraction {
  text: string;
  source: NonNullable<ProviderHealth["extraction_source"]>;
  sourceSummary: string;
  segmentCount: number;
  bodyFirst: boolean;
  warnings: string[];
}

function cleanTurnText(value: string): string {
  return stripProviderChromeLines(value)
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function retrievedEvidenceText(value: string): string {
  return cleanTurnText(value).replace(
    /^\s*retrieved evidence(?:\s*\([^)]*\))?\s*:\s*/i,
    "Retrieved evidence: "
  );
}

function authoredFromSnapshot(
  snapshot: ConversationSnapshot | null | undefined,
  providerId: string
): AuthoredSourceExtraction {
  const turns = snapshot?.turns ?? [];
  const userTurns = turns
    .filter((turn) => turn.role === "user")
    .map((turn) => cleanTurnText(turn.text))
    .filter(Boolean);
  const retrievedTurns = turns
    .filter(
      (turn) =>
        turn.role === "unknown" &&
        /\bretrieved evidence|source|citation|web result|search result\b/i.test(turn.text)
    )
    .map((turn) => retrievedEvidenceText(turn.text))
    .filter(Boolean);
  const lastUserBody = userTurns.at(-1) ?? "";

  if (lastUserBody) {
    const retrieved =
      providerId === "perplexity"
        ? retrievedTurns
            .map((turn) =>
              /^retrieved evidence\s*:/i.test(turn) ? turn : `Retrieved evidence: ${turn}`
            )
            .slice(0, 6)
        : [];
    // The session/admission engine needs the WHOLE conversation, not just the
    // last turn. When the composer is empty (the normal state when opening the
    // review after sending), recover every user-authored turn in order so the
    // objective, constraints, decisions and open items across the session are
    // all available to the transform. Reducing to the last turn here was
    // starving the admission engine (objective came back invalid/garbage and
    // stable_core was empty even though the snapshot captured the full thread).
    const orderedUserSegments = userTurns.map((body) => body);
    const segments =
      orderedUserSegments.length > 0
        ? [orderedUserSegments.join("\n\n"), ...retrieved]
        : [lastUserBody, ...retrieved];
    const multiTurn = userTurns.length > 1;
    return {
      text: segments.join("\n\n").trim(),
      source: "last_user_turn",
      sourceSummary: multiTurn
        ? `composer empty; recovered ${orderedUserSegments.length} user-authored turns from conversation${
            retrieved.length ? " with retrieved evidence quarantinable" : ""
          }`
        : retrieved.length
          ? "composer empty; recovered last user-authored turn with retrieved evidence quarantinable"
          : "composer empty; recovered last user-authored turn",
      segmentCount: segments.length,
      bodyFirst: true,
      warnings: []
    };
  }

  if (retrievedTurns.length) {
    return {
      text: retrievedTurns
        .map((turn) => (/^retrieved evidence\s*:/i.test(turn) ? turn : `Retrieved evidence: ${turn}`))
        .join("\n")
        .trim(),
      source: "retrieved_context_only",
      sourceSummary: "no user-authored draft body found; only retrieved context was available",
      segmentCount: retrievedTurns.length,
      bodyFirst: false,
      warnings: ["No user-authored draft body found; retrieved context is not trusted state."]
    };
  }

  return {
    text: "",
    source: "empty",
    sourceSummary: "no composer body or user-authored snapshot turn found",
    segmentCount: 0,
    bodyFirst: false,
    warnings: ["No user-authored draft body was available for extraction."]
  };
}

export function extractAuthorSourceFromSurface(
  surface: ChatSurfaceAdapter
): AuthoredSourceExtraction {
  const direct = cleanTurnText(surface.getCurrentDraftText());
  if (direct) {
    return {
      text: direct,
      source: "composer",
      sourceSummary: "composer editable body",
      segmentCount: 1,
      bodyFirst: true,
      warnings: []
    };
  }

  return authoredFromSnapshot(surface.getConversationSnapshot?.(), surface.id);
}
