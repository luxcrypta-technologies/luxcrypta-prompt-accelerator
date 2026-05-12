export interface ConversationSnapshot {
  title?: string;
  turns: Array<{
    role: "user" | "assistant" | "system" | "unknown";
    text: string;
    timestamp?: string;
  }>;
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
}
