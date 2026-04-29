import { getPlatformAPI } from "@platform-runtime";
import { ClipboardCheck, FileJson, ListChecks, PenLine, Save, Sparkles, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PRIMARY_ACTIONS, SECONDARY_ACTIONS } from "@/app/constants";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { BackgroundMessage, ContentMessage, ContentMessageResult } from "@/types/messages";
import type { ModeName } from "@/types/modes";
import type { TargetModel } from "@/types/models";
import type { TransformResult } from "@/types/prompts";
import { ActionBar } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";

const platform = getPlatformAPI();

function isDraftResult(value: ContentMessageResult): value is { text: string; surfaceId?: string } {
  return Boolean(value && "text" in value);
}

export function App() {
  const [draft, setDraft] = useState("");
  const [surfaceId, setSurfaceId] = useState<string | undefined>();
  const [status, setStatus] = useState("Ready");
  const [preview, setPreview] = useState<TransformResult | null>(null);
  const [capsule, setCapsule] = useState<CarryForwardCapsule | null>(null);

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

  const runTransform = useCallback(
    async (mode?: ModeName, targetModel?: TargetModel) => {
      const currentDraft = await loadDraft();
      const sourceText = (currentDraft?.text ?? draft).trim();
      if (!sourceText) {
        setStatus("No draft text found.");
        return;
      }
      setStatus("Transforming locally...");
      const result = await platform.messaging.sendMessage<BackgroundMessage, TransformResult>(
        {
          type: "prompt:transform",
          payload: {
            sourceText,
            mode,
            targetModel,
            preserveConstraints: true,
            sourceSurface: currentDraft?.surfaceId ?? surfaceId
          }
        }
      );
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
    },
    [draft, loadDraft, surfaceId]
  );

  const continueSession = useCallback(async () => {
    const snapshot = await platform.messaging.sendMessage<ContentMessage, ContentMessageResult>({
      type: "content:snapshot:get"
    });
    const result = await platform.messaging.sendMessage<BackgroundMessage, CarryForwardCapsule>(
      {
        type: "capsule:generate",
        payload: { snapshot: snapshot && "turns" in snapshot ? snapshot : undefined, sourceSurface: surfaceId }
      }
    );
    setCapsule(result);
    setStatus("Capsule saved locally.");
  }, [surfaceId]);

  const saveWorkflow = useCallback(async () => {
    const currentDraft = await loadDraft();
    const sourceText = (currentDraft?.text ?? draft).trim();
    if (!sourceText) {
      setStatus("No draft text found.");
      return;
    }
    await platform.messaging.sendMessage<BackgroundMessage, unknown>(
      {
        type: "workflow:save",
        payload: {
          workflow: {
            title: sourceText.split("\n")[0].slice(0, 60) || "Saved workflow",
            objective: sourceText,
            mode: "focus",
            constraints: [],
            outputPreferences: [],
            targetModel: "generic"
          }
        }
      }
    );
    setStatus("Workflow saved locally.");
  }, [draft, loadDraft]);

  const actionIcons = useMemo(
    () => ({
      compress: <Zap size={15} />,
      focus: <ListChecks size={15} />,
      continue_session: <ClipboardCheck size={15} />,
      save_workflow: <Save size={15} />
    }),
    []
  );

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
        <p>{draft.trim() || "Open ChatGPT, Claude, or Gemini and start a draft."}</p>
      </section>

      <div className="primary-grid">
        {PRIMARY_ACTIONS.map((action) => (
          <Button
            key={action.id}
            icon={actionIcons[action.id]}
            variant={action.id === "compress" ? "primary" : "secondary"}
            onClick={() => {
              if (action.id === "continue_session") void continueSession();
              else if (action.id === "save_workflow") void saveWorkflow();
              else void runTransform(action.mode as ModeName | undefined);
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <ActionBar>
        {SECONDARY_ACTIONS.map((action) => (
          <Button
            key={action.id}
            icon={action.targetModel ? <Sparkles size={14} /> : <FileJson size={14} />}
            variant="quiet"
            onClick={() => void runTransform(action.mode, action.targetModel)}
          >
            {action.label}
          </Button>
        ))}
      </ActionBar>

      <p className="status-line">{status}</p>

      <Modal title="Quick review" open={Boolean(preview || capsule)} onClose={() => { setPreview(null); setCapsule(null); }}>
        {preview ? <pre className="preview-text">{preview.transformedText}</pre> : null}
        {capsule ? <pre className="preview-text">{JSON.stringify(capsule, null, 2)}</pre> : null}
      </Modal>
    </main>
  );
}
