const BULLET_PATTERN = /^[\s]*(?:[\u2022\u25E6\u2043\u2219*]|[0-9]+[.)])\s+/;

export function normalizePrompt(sourceText: string): string {
  return sourceText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(BULLET_PATTERN, "- ")
        .replace(/[ \t]+/g, " ")
        .trimEnd()
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
