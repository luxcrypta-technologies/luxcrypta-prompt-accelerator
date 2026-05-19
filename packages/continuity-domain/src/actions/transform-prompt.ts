import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import { HistoryService } from "@luxcrypta/continuity-domain/services/history-service";
import { PreferenceService } from "@luxcrypta/continuity-domain/services/preference-service";
import type { HistoryAction } from "@luxcrypta/continuity-types/actions";
import type { ContinuityStorage } from "@luxcrypta/continuity-types/storage";
import type { TransformRequest, TransformResult } from "@luxcrypta/continuity-types/prompts";

function actionFromRequest(request: TransformRequest): HistoryAction {
  if (request.targetModel) return "adapt_model";
  return "continuity_runtime";
}

export async function executeTransformPrompt(
  request: TransformRequest,
  deps: { storage: ContinuityStorage }
): Promise<TransformResult> {
  const result = transformPrompt(request);
  const preferences = await new PreferenceService(deps.storage).get();
  if (preferences.saveHistoryEnabled) {
    await new HistoryService(deps.storage).record({
      action: actionFromRequest(request),
      originalText: request.sourceText,
      transformedText: result.transformedText,
      mode: request.mode,
      targetModel: request.targetModel
    });
  }
  return result;
}
