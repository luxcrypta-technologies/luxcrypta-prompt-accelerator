import type { SessionGovernanceState, SessionMonitors, SessionOpennessState, SessionStableCore } from "@luxcrypta/continuity-types/governance";
import { createDatedId } from "@luxcrypta/continuity-types/utils/ids";

export function createInitialSessionState(input: {
  stableCore: SessionStableCore;
  opennessLane: SessionOpennessState;
  monitors: SessionMonitors;
  timestamp: string;
  title?: string;
}): Omit<SessionGovernanceState, "diagnostics"> {
  return {
    id: createDatedId("session", input.stableCore.objective, input.timestamp),
    title: input.title,
    stableCore: input.stableCore,
    noveltyLane: [],
    opennessLane: input.opennessLane,
    monitors: input.monitors,
    createdAt: input.timestamp,
    updatedAt: input.timestamp
  };
}
