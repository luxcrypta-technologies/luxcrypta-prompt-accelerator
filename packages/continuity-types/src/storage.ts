export interface ContinuityStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
}
