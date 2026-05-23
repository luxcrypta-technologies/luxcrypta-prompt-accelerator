import type { CarryForwardCapsule } from "./capsules";
import type { HistoryItem } from "./actions";
import type { ReviewSurfaceKind } from "./platform";
import type { TransformRequest, TransformResult } from "./prompts";
import type { ConversationSnapshot, ProviderHealth, ProviderProfile } from "./surfaces";
import type { DiagnosticSnapshot } from "./diagnostics";
import type {
  SessionDiagnostics,
  SessionGovernanceState,
  SessionUpdateInput,
  SessionUpdateResult
} from "./governance";
import type { UserPreferences } from "./preferences";
import type { Workflow } from "./workflows";

export type CapsuleSaveInput = Omit<
  CarryForwardCapsule,
  "capsule_version" | "id" | "created_at" | "updated_at"
>;

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  workflows: Workflow[];
  capsules: CarryForwardCapsule[];
  preferences?: UserPreferences;
  sessions?: SessionGovernanceState[];
  diagnostics?: DiagnosticSnapshot[];
}

export interface ImportBundleResult {
  workflowsImported: number;
  capsulesImported: number;
  preferencesImported: boolean;
  sessionsImported?: number;
  diagnosticsImported?: number;
}

export type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ReviewState {
  id: string;
  result: TransformResult;
  surface: ReviewSurfaceKind;
  createdAt: string;
  sourceTabId?: number;
}

export type BackgroundMessage =
  | { type: "prompt:transform"; payload: TransformRequest }
  | {
      type: "capsule:generate";
      payload: { snapshot?: ConversationSnapshot; sourceSurface?: string };
    }
  | { type: "capsule:save"; payload: { capsule: CapsuleSaveInput } }
  | {
      type: "workflow:save";
      payload: { workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt"> };
    }
  | { type: "history:list"; payload?: { limit?: number } }
  | { type: "preferences:get" }
  | { type: "preferences:update"; payload: Partial<UserPreferences> }
  | { type: "export:create" }
  | { type: "import:apply"; payload: { bundle: unknown } }
  | { type: "session:get" }
  | { type: "session:update"; payload: SessionUpdateInput }
  | { type: "session:promote-novelty"; payload: { noveltyIds: string[] } }
  | { type: "session:reset" }
  | { type: "diagnostics:get" }
  | { type: "review:open"; payload: { result: TransformResult } }
  | { type: "review:get"; payload: { reviewId?: string } }
  | { type: "review:update"; payload: { reviewId: string; result: TransformResult } }
  | { type: "review:status"; payload: { reviewId: string } }
  | { type: "review:rendered"; payload: { reviewId: string } };

export type ContentMessage =
  | { type: "content:draft:get" }
  | { type: "content:draft:apply"; payload: { text: string; targetTabId?: number } }
  | { type: "content:snapshot:get" };

export type ExtensionMessage = BackgroundMessage | ContentMessage;

export type BackgroundMessageResult =
  | TransformResult
  | CarryForwardCapsule
  | Workflow
  | HistoryItem[]
  | UserPreferences
  | ExportBundle
  | ImportBundleResult
  | SessionGovernanceState
  | SessionUpdateResult
  | SessionDiagnostics
  | ReviewState
  | {
      reviewId: string;
      surface: ReviewSurfaceKind;
      visibleToUser?: boolean;
      openStatus?: ProviderHealth["review_open_status"];
    }
  | null;

export type ContentMessageResult =
  | {
      text: string;
      surfaceId?: string;
      providerProfile?: ProviderProfile;
      providerHealth?: ProviderHealth;
    }
  | {
      applied: boolean;
      text?: string;
      surfaceId?: string;
      providerProfile?: ProviderProfile;
      providerHealth?: ProviderHealth;
    }
  | ConversationSnapshot
  | null;
