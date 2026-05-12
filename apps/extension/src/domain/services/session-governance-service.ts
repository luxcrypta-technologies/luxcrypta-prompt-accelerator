import { createCarryForwardFromGovernance } from "@/governance/carry-forward";
import { generateSessionDiagnostics } from "@/governance/diagnostics";
import { computeSessionMonitors } from "@/governance/monitors";
import { promoteNoveltyItems } from "@/governance/novelty";
import { updateSessionGovernance } from "@/governance/session-update";
import { DiagnosticsStore } from "@/storage/diagnostics-store";
import { PreferenceStore } from "@/storage/preference-store";
import { SessionStore } from "@/storage/session-store";
import type { DiagnosticSnapshot } from "@/types/diagnostics";
import type { SessionDiagnostics, SessionGovernanceState, SessionUpdateInput, SessionUpdateResult } from "@/types/governance";
import type { PlatformStorage } from "@/types/platform";
import { createDatedId } from "@/utils/ids";
import { nowIso } from "@/utils/time";

export class SessionGovernanceService {
  private readonly sessions: SessionStore;
  private readonly diagnostics: DiagnosticsStore;
  private readonly preferences: PreferenceStore;

  constructor(private readonly storage: PlatformStorage) {
    this.sessions = new SessionStore(storage);
    this.diagnostics = new DiagnosticsStore(storage);
    this.preferences = new PreferenceStore(storage);
  }

  getCurrent(): Promise<SessionGovernanceState | null> {
    return this.sessions.getCurrent();
  }

  async update(input: SessionUpdateInput): Promise<SessionUpdateResult | null> {
    const preferences = await this.preferences.get();
    if (!preferences.sessionGovernanceEnabled) return null;

    const previousState = input.previousState ?? (await this.sessions.getCurrent());
    const result = updateSessionGovernance({
      ...input,
      previousState,
      preserveOpenQuestions: preferences.preserveOpenQuestions,
      conservativeStableCoreUpdates: preferences.conservativeStableCoreUpdates
    });

    if (preferences.saveSessionStateLocally) {
      await this.sessions.save(result.state);
      await this.saveDiagnostics(result.state);
    }

    return result;
  }

  async promoteNovelty(noveltyIds: string[]): Promise<SessionGovernanceState | null> {
    const current = await this.sessions.getCurrent();
    if (!current) return null;
    const timestamp = nowIso();
    const promoted = promoteNoveltyItems(current, noveltyIds, timestamp);
    const monitors = computeSessionMonitors({
      previousState: current,
      stableCore: promoted.stableCore,
      noveltyLane: promoted.noveltyLane,
      opennessLane: promoted.opennessLane,
      originalLength: promoted.stableCore.objective.length
    });
    const base = { ...promoted, monitors, updatedAt: timestamp };
    const next: SessionGovernanceState = {
      ...base,
      diagnostics: generateSessionDiagnostics(base, timestamp)
    };
    await this.sessions.save(next);
    await this.saveDiagnostics(next);
    return next;
  }

  async reset(): Promise<null> {
    await this.sessions.resetCurrent();
    return null;
  }

  async getDiagnostics(): Promise<SessionDiagnostics | null> {
    const current = await this.sessions.getCurrent();
    return current?.diagnostics ?? null;
  }

  createCarryForward(state: SessionGovernanceState) {
    return createCarryForwardFromGovernance(state);
  }

  private async saveDiagnostics(state: SessionGovernanceState): Promise<void> {
    const snapshot: DiagnosticSnapshot = {
      id: createDatedId("diagnostic", `${state.id}:${state.updatedAt}`, state.updatedAt),
      sessionId: state.id,
      diagnostics: state.diagnostics,
      createdAt: state.updatedAt
    };
    await this.diagnostics.save(snapshot);
  }
}
