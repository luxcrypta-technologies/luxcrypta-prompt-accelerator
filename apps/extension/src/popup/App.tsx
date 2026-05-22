import { getPlatformAPI } from "@platform-runtime";
import { PenLine, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ADVANCED_ACTION, RUNTIME_LABEL } from "@/app/constants";
import type { BackgroundMessage, ContentMessage, ContentMessageResult } from "@/types/messages";
import type { TransformResult } from "@/types/prompts";
import type { ProviderHealth, ProviderProfile } from "@/types/surfaces";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";

const platform = getPlatformAPI();

function isDraftResult(value: ContentMessageResult): value is {
  text: string;
  surfaceId?: string;
  providerProfile?: ProviderProfile;
  providerHealth?: ProviderHealth;
} {
  return Boolean(value && "text" in value);
}

export function App() {
  const [draft, setDraft] = useState("");
  const [surfaceId, setSurfaceId] = useState<string | undefined>();
  const [status, setStatus] = useState("Ready");
  const [preview, setPreview] = useState<TransformResult | null>(null);

  const loadDraft = useCallback(async () => {
    const result = await platform.messaging.sendMessage<ContentMessage, ContentMessageResult>({
      type: "content:draft:get"
    });
    if (isDraftResult(result)) {
      setDraft(result.text);
      setSurfaceId(result.surfaceId);
      return result;
    }
    return null;
  }, []);

  useEffect(() => {
    void loadDraft().catch(() => setStatus("Open a supported chat page to use draft actions."));
  }, [loadDraft]);

  const openAdvanced = useCallback(async () => {
    const currentDraft = await loadDraft();
    const sourceText = (currentDraft?.text ?? draft).trim();
    if (!sourceText) {
      setStatus("No draft text found.");
      return;
    }
    setStatus("Opening continuity review...");
    const result = await platform.messaging.sendMessage<BackgroundMessage, TransformResult>({
      type: "prompt:transform",
      payload: {
        sourceText,
        preserveConstraints: true,
        sourceSurface: currentDraft?.surfaceId ?? surfaceId,
        providerProfile: currentDraft?.providerProfile,
        providerHealth: currentDraft?.providerHealth
      }
    });
    setPreview(result);
    try {
      await platform.messaging.sendMessage<BackgroundMessage, { reviewId: string }>({
        type: "review:open",
        payload: { result }
      });
      setStatus("Review opened.");
    } catch {
      setStatus("Quick review shown. Full review could not open.");
    }
  }, [draft, loadDraft, surfaceId]);

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">{surfaceId ? surfaceId : "No surface detected"}</p>
          <h1>Prompt Accelerator</h1>
        </div>
        <Button icon={<PenLine size={15} />} variant="quiet" onClick={() => void loadDraft()}>
          Refresh
        </Button>
      </header>

      <section className="draft-box">
        <span>Current draft</span>
        <p>{draft.trim() || "Open a supported chat surface and start a draft."}</p>
      </section>

      <div className="runtime-row" aria-label="LuxCrypta continuity runtime">
        <span>{RUNTIME_LABEL}</span>
        <Button
          icon={<SlidersHorizontal size={15} />}
          variant="primary"
          onClick={() => void openAdvanced()}
        >
          {ADVANCED_ACTION.label}
        </Button>
      </div>

      <p className="status-line">{status}</p>

      <Modal title="Continuity review" open={Boolean(preview)} onClose={() => setPreview(null)}>
        {preview ? (
          <div className="quick-review">
            <h2>Clean Summary</h2>
            <p>{preview.continuityReview.cleanSummary}</p>
            <h2>Active Objective</h2>
            <p>{preview.continuityReview.activeObjective}</p>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
