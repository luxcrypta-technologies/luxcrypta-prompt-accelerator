export const STORAGE_PREFIXES = {
  workflow: "workflow:",
  capsule: "capsule:",
  history: "history:",
  preference: "pref:",
  session: "session:",
  diagnostic: "diagnostic:",
  review: "review:"
} as const;

export const PREFERENCE_KEY = `${STORAGE_PREFIXES.preference}user`;
export const CURRENT_SESSION_KEY = `${STORAGE_PREFIXES.session}current`;

export function workflowKey(id: string): string {
  return `${STORAGE_PREFIXES.workflow}${id}`;
}

export function capsuleKey(id: string): string {
  return `${STORAGE_PREFIXES.capsule}${id}`;
}

export function historyKey(id: string): string {
  return `${STORAGE_PREFIXES.history}${id}`;
}

export function sessionKey(id: string): string {
  return `${STORAGE_PREFIXES.session}${id}`;
}

export function diagnosticKey(id: string): string {
  return `${STORAGE_PREFIXES.diagnostic}${id}`;
}

export function reviewStateKey(id: string): string {
  return `${STORAGE_PREFIXES.review}${id}`;
}
