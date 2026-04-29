export function toLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function firstMeaningfulLine(text: string, fallback = "Untitled"): string {
  const line = toLines(text)[0];
  return line ? line.slice(0, 80) : fallback;
}

export function clampText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      output.push(trimmed);
    }
  }
  return output;
}

const SECTION_LABEL_RE = /^\s*(objective|context|requirements?|hard requirements?|output contract|accepted decisions?):\s*/i;

function stripSectionLabel(text: string): string {
  return text.replace(SECTION_LABEL_RE, "").replace(/^[-*•]\s*/, "").trim();
}

export function normalizeMeaning(text: string): string {
  return stripSectionLabel(text)
    .toLowerCase()
    .replace(/\bcitations\b/g, "citation")
    .replace(/\bsources\b/g, "source")
    .replace(/\brequirements?\b/g, "requirement")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function meaningTokens(text: string): Set<string> {
  return new Set(
    normalizeMeaning(text)
      .split(" ")
      .map((word) => (word.length > 4 ? word.replace(/s$/, "") : word))
      .filter((word) => word.length > 2)
  );
}

export function meaningSimilarity(left: string, right: string): number {
  const leftMeaning = normalizeMeaning(left);
  const rightMeaning = normalizeMeaning(right);
  if (!leftMeaning || !rightMeaning) return 0;
  if (leftMeaning === rightMeaning) return 1;
  const shorter = leftMeaning.length <= rightMeaning.length ? leftMeaning : rightMeaning;
  const longer = leftMeaning.length > rightMeaning.length ? leftMeaning : rightMeaning;
  if (shorter.length >= 18 && longer.includes(shorter)) return 0.92;

  const leftTokens = meaningTokens(leftMeaning);
  const rightTokens = meaningTokens(rightMeaning);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((word) => rightTokens.has(word)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function isMeaningfullyDuplicate(left: string, right: string, threshold = 0.72): boolean {
  return meaningSimilarity(left, right) >= threshold;
}

function clarityScore(text: string): number {
  const clean = stripSectionLabel(text);
  let score = 0;
  if (!SECTION_LABEL_RE.test(text)) score += 2;
  if (!/\s[-*•]\s/.test(text)) score += 2;
  if (clean.length <= 180) score += 2;
  if (/\b(must|do not|only|required|keep|cite|citation|bullet|json|markdown|table)\b/i.test(clean)) score += 1;
  return score;
}

export function uniqueMeaningfulStrings(values: string[], references: string[] = [], threshold = 0.72): string[] {
  const output: string[] = [];
  const allReferences = [...references];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const duplicateReference = allReferences.some((reference) => isMeaningfullyDuplicate(trimmed, reference, threshold));
    if (duplicateReference) continue;

    const duplicateIndex = output.findIndex((item) => isMeaningfullyDuplicate(item, trimmed, threshold));
    if (duplicateIndex >= 0) {
      if (clarityScore(trimmed) > clarityScore(output[duplicateIndex])) {
        output[duplicateIndex] = trimmed;
      }
      continue;
    }

    output.push(trimmed);
    allReferences.push(trimmed);
  }

  return output;
}
