import { transformPrompt } from "@/core/pipeline";
import { HistoryService } from "@/domain/services/history-service";
import { PreferenceService } from "@/domain/services/preference-service";
import type { HistoryAction } from "@/types/actions";
import type { PlatformStorage } from "@/types/platform";
import type { TransformRequest, TransformResult } from "@/types/prompts";

function actionFromRequest(request: TransformRequest): HistoryAction {
  if (request.targetModel) return "adapt_model";
  return "continuity_runtime";
}

export async function executeTransformPrompt(
  request: TransformRequest,
  deps: { storage: PlatformStorage }
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
