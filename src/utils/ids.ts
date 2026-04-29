export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

export function createStableId(prefix: string, seed: string): string {
  return `${prefix}_${stableHash(seed)}`;
}

export function createDatedId(prefix: string, seed: string, isoDate: string): string {
  return `${prefix}_${stableHash(`${isoDate}:${seed}`)}`;
}
