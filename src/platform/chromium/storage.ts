import type { PlatformStorage } from "@/types/platform";

function rejectLastError(): Error | null {
  return chrome.runtime.lastError ? new Error(chrome.runtime.lastError.message) : null;
}

export const chromiumStorage: PlatformStorage = {
  get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (items) => {
        const error = rejectLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve((items[key] as T | undefined) ?? null);
      });
    });
  },

  set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        const error = rejectLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  },

  remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        const error = rejectLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  },

  list<T>(prefix: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (items) => {
        const error = rejectLastError();
        if (error) {
          reject(error);
          return;
        }
        resolve(
          Object.entries(items)
            .filter(([key]) => key.startsWith(prefix))
            .map(([, value]) => value as T)
        );
      });
    });
  }
};
