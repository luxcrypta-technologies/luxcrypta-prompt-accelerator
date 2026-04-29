import { getPlatformAPI } from "@platform-runtime";
import { Check, Clipboard, FilePlus2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { SessionGovernanceState, SessionUpdateResult } from "@/types/governance";
import type { BackgroundMessage, ContentMessage, ContentMessageResult, ReviewState } from "@/types/messages";
import type { TransformResult } from "@/types/prompts";
import type { UserPreferences } from "@/types/preferences";
import type { Workflow } from "@/types/workflows";
import { ActionBar } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { CapsuleCard } from "@/ui/CapsuleCard";
import { DiffView } from "@/ui/DiffView";
import { ScoreBadge } from "@/ui/ScoreBadge";
import { WorkflowCard } from "@/ui/WorkflowCard";
import { SessionStatePanel } from "./components";

const platform = getPlatformAPI();

function reviewIdFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get("reviewId") ?? undefined;
}

export function App() {
  const [state, setState] = useState<ReviewState | null>(null);
  const [editableText, setEditableText] = useState("");
  const [status, setStatus] = useState("Loading review...");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [capsule, setCapsule] = useState<CarryForwardCapsule | null>(null);
  const [sessionState, setSessionState] = useState<SessionGovernanceState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  const loadSessionState = useCallback(async () => {
    const next = await platform.messaging.sendMessage<BackgroundMessage, SessionGovernanceState | null>({
      type: "session:get"
    });
    setSessionState(next);
  }, []);

  useEffect(() => {
    platform.messaging
      .sendMessage<BackgroundMessage, ReviewState | null>({
        type: "review:get",
        payload: { reviewId: reviewIdFromUrl() }
      })
      .then((review) => {
        const next = review;
        setState(next);
        setEditableText(next?.result.transformedText ?? "");
        setStatus(next ? "Ready to review." : "Review expired. Run a prompt action again.");
        void loadSessionState();
      })
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Unable to load review."));
    platform.messaging
      .sendMessage<BackgroundMessage, UserPreferences>({ type: "preferences:get" })
      .then(setPreferences)
      .catch(() => setPreferences(null));
  }, [loadSessionState]);

  const result: TransformResult | null = state?.result ?? null;

  const apply = useCallback(async () => {
    const response = await platform.messaging.sendMessage<ContentMessage, ContentMessageResult>({
      type: "content:draft:apply",
      payload: { text: editableText, targetTabId: state?.sourceTabId }
    });
    if (response && "applied" in response && response.applied && result) {
      const updated = await platform.messaging.sendMessage<BackgroundMessage, SessionUpdateResult | null>({
        type: "session:update",
        payload: {
          transformResult: { ...result, transformedText: editableText },
          sourceSurface: result.targetModelApplied
        }
      });
      setSessionState(updated?.state ?? sessionState);
      setStatus("Applied to draft.");
      return;
    }
    setStatus("Unable to apply.");
  }, [editableText, result, sessionState, state?.sourceTabId]);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(editableText);
    setStatus("Copied.");
  }, [editableText]);

  const saveWorkflow = useCallback(async () => {
    if (!result) return;
    const saved = await platform.messaging.sendMessage<BackgroundMessage, Workflow>(
      {
        type: "workflow:save",
        payload: {
          workflow: {
            title: result.normalizedText.split("\n")[0].slice(0, 60) || "Reviewed prompt",
            objective: editableText,
            mode: result.modeApplied ?? "focus",
            constraints: result.extractedConstraints.map((constraint) => constraint.text),
            outputPreferences: result.explanation,
            targetModel: result.targetModelApplied ?? "generic"
          }
        }
      }
    );
    setWorkflow(saved);
    setStatus("Workflow saved locally.");
  }, [editableText, result]);

  const saveCapsule = useCallback(async () => {
    if (!result) return;
    const saved = await platform.messaging.sendMessage<BackgroundMessage, CarryForwardCapsule>(
      {
        type: "capsule:generate",
        payload: {
          snapshot: {
            title: "Reviewed prompt",
            turns: [
              { role: "user", text: result.originalText },
              { role: "assistant", text: editableText }
            ]
          },
          sourceSurface: result.targetModelApplied
        }
      }
    );
    setCapsule(saved);
    setStatus("Capsule saved locally.");
  }, [editableText, result]);

  const promoteNovelty = useCallback(
    async (id: string) => {
      const promoted = await platform.messaging.sendMessage<BackgroundMessage, SessionGovernanceState | null>({
        type: "session:promote-novelty",
        payload: { noveltyIds: [id] }
      });
      setSessionState(promoted);
      setStatus(promoted ? "Promoted into stable core." : "No session state to update.");
    },
    []
  );

  const explanation = useMemo(() => result?.explanation ?? [], [result]);

  if (!result) {
    return (
      <main className="review-shell review-shell--empty">
        <h1>Prompt Review</h1>
        <p>{status}</p>
      </main>
    );
  }

  return (
    <main className="review-shell">
      <header className="review-header">
        <div>
          <p className="eyebrow">Review diff</p>
          <h1>Prompt Review</h1>
        </div>
        <ScoreBadge scores={result.scores} />
      </header>

      <ActionBar>
        <Button icon={<Check size={15} />} variant="primary" onClick={() => void apply()}>
          Apply
        </Button>
        <Button icon={<Clipboard size={15} />} onClick={() => void copy()}>
          Copy
        </Button>
        <Button icon={<Save size={15} />} onClick={() => void saveWorkflow()}>
          Save Workflow
        </Button>
        <Button icon={<FilePlus2 size={15} />} onClick={() => void saveCapsule()}>
          Save Capsule
        </Button>
      </ActionBar>

      <section className="review-grid">
        <div className="review-pane">
          <h2>Original</h2>
          <pre>{result.originalText}</pre>
        </div>
        <div className="review-pane">
          <h2>Transformed</h2>
          <textarea value={editableText} onChange={(event) => setEditableText(event.target.value)} />
        </div>
      </section>

      <section className="review-section">
        <h2>What changed</h2>
        <ul>
          {explanation.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="review-section">
        <h2>Diff</h2>
        <DiffView blocks={result.diff} />
      </section>

      <SessionStatePanel
        state={sessionState}
        showDiagnostics={Boolean(preferences?.showAdvancedDiagnostics)}
        onPromote={promoteNovelty}
      />

      <section className="review-grid">
        {workflow ? <WorkflowCard workflow={workflow} /> : null}
        {capsule ? <CapsuleCard capsule={capsule} /> : null}
      </section>

      <p className="status-line">{status}</p>
    </main>
  );
}
