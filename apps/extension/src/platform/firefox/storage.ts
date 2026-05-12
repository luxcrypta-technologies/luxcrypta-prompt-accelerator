import type { PlatformStorage } from "@/types/platform";

export const firefoxStorage: PlatformStorage = {
  async get<T>(key: string): Promise<T | null> {
    const items = await browser.storage.local.get(key);
    return (items[key] as T | undefined) ?? null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  },

  async remove(key: string): Promise<void> {
    await browser.storage.local.remove(key);
  },

  async list<T>(prefix: string): Promise<T[]> {
    const items = await browser.storage.local.get(null);
    return Object.entries(items)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value as T);
  }
};
