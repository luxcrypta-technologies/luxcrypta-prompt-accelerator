export const STORAGE_PREFIXES = {
  workflow: "workflow:",
  capsule: "capsule:",
  history: "history:",
  preference: "pref:"
} as const;

export const PREFERENCE_KEY = `${STORAGE_PREFIXES.preference}user`;

export function workflowKey(id: string): string {
  return `${STORAGE_PREFIXES.workflow}${id}`;
}

export function capsuleKey(id: string): string {
  return `${STORAGE_PREFIXES.capsule}${id}`;
}

export function historyKey(id: string): string {
  return `${STORAGE_PREFIXES.history}${id}`;
}
