export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoDate(value: Date | string): string {
  return typeof value === "string" ? new Date(value).toISOString() : value.toISOString();
}
