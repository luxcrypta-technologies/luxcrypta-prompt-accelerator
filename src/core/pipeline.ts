import { compressPrompt } from "./compress";
import { extractConstraints } from "./constraints";
import { buildDiff } from "./diff";
import { buildExplanation } from "./explain";
import { applyModeTemplate } from "./modes";
import { adaptForModel } from "./model-adapters";
import { normalizePrompt } from "./normalize";
import { computeTransformationScores } from "./scoring";
import type { TransformRequest, TransformResult } from "@/types/prompts";

export function transformPrompt(request: TransformRequest): TransformResult {
  const normalized = normalizePrompt(request.sourceText);
  const constraints = extractConstraints(normalized);
  const compressed = compressPrompt(normalized, constraints, request);
  const modeAdjusted = applyModeTemplate(compressed, request.mode, constraints);
  const modelAdjusted = adaptForModel(modeAdjusted, request.targetModel, request.mode);
  const diff = buildDiff(request.sourceText, modelAdjusted);
  const explanation = buildExplanation({
    original: request.sourceText,
    normalized,
    transformed: modelAdjusted,
    constraints,
    mode: request.mode,
    targetModel: request.targetModel
  });
  const scores = computeTransformationScores({
    original: request.sourceText,
    transformed: modelAdjusted,
    constraints,
    mode: request.mode,
    targetModel: request.targetModel
  });

  return {
    originalText: request.sourceText,
    normalizedText: normalized,
    transformedText: modelAdjusted,
    modeApplied: request.mode,
    targetModelApplied: request.targetModel,
    extractedConstraints: constraints,
    explanation,
    diff,
    scores
  };
}
