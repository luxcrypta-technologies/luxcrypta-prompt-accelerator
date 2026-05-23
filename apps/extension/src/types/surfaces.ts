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
  writeback_attempted?: boolean;
  writeback_status?: "not_attempted" | "success" | "failed";
  writeback_success: boolean;
  review_open_attempted?: boolean;
  review_open_status?: "not_attempted" | "pending" | "success" | "retry_success" | "failed";
  review_open_error?: string;
  review_open_events?: string[];
  click_detected?: boolean;
  navigation_attempted?: boolean;
  surface_created?: boolean;
  app_mounted?: boolean;
  first_content_rendered?: boolean;
  visible_to_user?: boolean;
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
