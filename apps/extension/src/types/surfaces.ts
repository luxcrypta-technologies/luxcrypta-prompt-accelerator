export interface ConversationSnapshot {
  title?: string;
  turns: Array<{
    role: "user" | "assistant" | "system" | "unknown";
    text: string;
    timestamp?: string;
  }>;
}

export interface ProviderProfile {
  provider: string;
  continuity_style: string;
  preferred_handoff: string;
  capsule_bias: string;
  risk_profile: string[];
  recommended_runtime_emphasis: string[];
  retrieved_content_default_state?: "provisional_or_quarantine";
}

export interface ProviderHealth {
  provider: string;
  surface_detected: boolean;
  input_detected: boolean;
  toolbar_mounted: boolean;
  draft_read_success: boolean;
  extraction_status?: "success" | "degraded" | "failed";
  extraction_source?: "composer" | "last_user_turn" | "retrieved_context_only" | "empty";
  extraction_source_summary?: string;
  extracted_segment_count?: number;
  body_first_extraction_success?: boolean;
  extraction_warnings?: string[];
  contamination_markers?: string[];
  writeback_attempted?: boolean;
  writeback_status?: "not_attempted" | "success" | "failed";
  writeback_success: boolean;
  review_open_attempted?: boolean;
  review_open_status?:
    | "not_attempted"
    | "requested"
    | "surface_created"
    | "mounted"
    | "rendered"
    | "visible_acknowledged"
    | "persisted"
    | "open_success"
    | "open_failed";
  review_open_stage?:
    | "requested"
    | "surface_created"
    | "mounted"
    | "rendered"
    | "visible_acknowledged"
    | "persisted"
    | "open_success"
    | "open_failed";
  review_open_error?: string;
  review_open_events?: string[];
  click_detected?: boolean;
  navigation_attempted?: boolean;
  surface_created?: boolean;
  app_mounted?: boolean;
  first_content_rendered?: boolean;
  visible_to_user?: boolean;
  persisted?: boolean;
  retry_count?: number;
  failure_stage?: string;
  failure_reason?: string;
  dom_mount_status?: "mounted" | "missing" | "stale" | "rebinding";
  duplicate_guard_active: boolean;
  runtime_errors: string[];
}

export interface ChatSurfaceAdapter {
  id: string;
  label: string;
  matches(url: string): boolean;
  isReady(): boolean;
  getInputElement(): HTMLElement | HTMLTextAreaElement | null;
  getCurrentDraftText(): string;
  setCurrentDraftText(text: string): boolean;
  insertText(text: string): boolean;
  getConversationSnapshot?(): ConversationSnapshot | null;
  getProviderProfile?(): ProviderProfile;
}
