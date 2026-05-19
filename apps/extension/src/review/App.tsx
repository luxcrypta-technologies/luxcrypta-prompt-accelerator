import { getPlatformAPI } from "@platform-runtime";
import { Check, Clipboard, FilePlus2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { SessionGovernanceState, SessionUpdateResult } from "@/types/governance";
import type { BackgroundMessage, ContentMessage, ContentMessageResult, ReviewState } from "@/types/messages";
import type { TransformResult } from "@/types/prompts";
import type { Workflow } from "@/types/workflows";
import { ActionBar } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { CapsuleCard } from "@/ui/CapsuleCard";
import { DiffView } from "@/ui/DiffView";
import { ScoreBadge } from "@/ui/ScoreBadge";
import { WorkflowCard } from "@/ui/WorkflowCard";
import { buildCapsuleDraft, buildWorkflowDraft, formatContinuityExport } from "./continuity-artifacts";

const platform = getPlatformAPI();

type ToolbarAction = "apply" | "copy" | "workflow" | "capsule";
type FeedbackTone = "loading" | "success" | "error";

interface ToolbarFeedback {
  action: ToolbarAction;
  tone: FeedbackTone;
  message: string;
  detail?: string;
}

const ACTION_LABELS: Record<ToolbarAction, { idle: string; pending: string; success: string }> = {
  apply: { idle: "Apply", pending: "Applying...", success: "Applied" },
  copy: { idle: "Copy", pending: "Copying...", success: "Copied" },
  workflow: { idle: "Save Workflow", pending: "Saving workflow...", success: "Workflow saved" },
  capsule: { idle: "Save Capsule", pending: "Saving capsule...", success: "Capsule saved" }
};

function reviewIdFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get("reviewId") ?? undefined;
}

function errorDetail(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Clipboard write was blocked.");
  }
}

function ReviewListSection({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section className="review-section continuity-section">
      <h2>{title}</h2>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="governance-muted">{emptyText}</p>
      )}
    </section>
  );
}

export function App() {
  const [state, setState] = useState<ReviewState | null>(null);
  const [editableText, setEditableText] = useState("");
  const [status, setStatus] = useState("Loading review...");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [capsule, setCapsule] = useState<CarryForwardCapsule | null>(null);
  const [sessionState, setSessionState] = useState<SessionGovernanceState | null>(null);
  const [pendingAction, setPendingAction] = useState<ToolbarAction | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ToolbarFeedback | null>(null);

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
  }, [loadSessionState]);

  const result: TransformResult | null = state?.result ?? null;
  const sourcePreviewText = result?.continuityReview.diagnostics.rawCapsule ? result.normalizedText : result?.originalText ?? "";
  const isActionBusy = pendingAction !== null;

  const setFeedback = useCallback((feedback: ToolbarFeedback) => {
    setActionFeedback(feedback);
    setStatus(feedback.message);
  }, []);

  const actionLabel = useCallback(
    (action: ToolbarAction) => {
      if (pendingAction === action) return ACTION_LABELS[action].pending;
      if (actionFeedback?.action === action && actionFeedback.tone === "success") return ACTION_LABELS[action].success;
      return ACTION_LABELS[action].idle;
    },
    [actionFeedback, pendingAction]
  );

  const apply = useCallback(async () => {
    setPendingAction("apply");
    setFeedback({ action: "apply", tone: "loading", message: "Applying..." });

    try {
      const response = await platform.messaging.sendMessage<ContentMessage, ContentMessageResult>({
        type: "content:draft:apply",
        payload: { text: editableText, targetTabId: state?.sourceTabId }
      });
      const applyResponse = response && "applied" in response ? response : null;
      if (!applyResponse?.applied) {
        throw new Error("The draft surface rejected the update.");
      }
      if ("text" in applyResponse && applyResponse.text !== undefined && applyResponse.text.trim() !== editableText.trim()) {
        throw new Error("The draft text could not be verified after applying.");
      }

      let detail: string | undefined;
      if (result) {
        try {
          const updated = await platform.messaging.sendMessage<BackgroundMessage, SessionUpdateResult | null>({
            type: "session:update",
            payload: {
              transformResult: { ...result, transformedText: editableText },
              sourceSurface: result.targetModelApplied
            }
          });
          setSessionState((current) => updated?.state ?? current);
        } catch (error) {
          detail = errorDetail(error) ? "Draft updated. Session state refresh did not complete." : undefined;
        }
      }

      setFeedback({ action: "apply", tone: "success", message: "Applied to draft", detail });
    } catch (error) {
      setFeedback({
        action: "apply",
        tone: "error",
        message: "Could not apply to draft. Use Copy instead.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [editableText, result, setFeedback, state?.sourceTabId]);

  const copy = useCallback(async () => {
    if (!result) return;
    setPendingAction("copy");
    setFeedback({ action: "copy", tone: "loading", message: "Copying..." });

    try {
      await writeClipboard(formatContinuityExport(result, editableText));
      setFeedback({
        action: "copy",
        tone: "success",
        message: "Copied continuity review",
        detail: "Clean export copied with objective, stable core, provisional items, open items, next actions, and transformed draft."
      });
    } catch (error) {
      setFeedback({
        action: "copy",
        tone: "error",
        message: "Could not copy continuity review.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [editableText, result, setFeedback]);

  const saveWorkflow = useCallback(async () => {
    if (!result) return;
    setPendingAction("workflow");
    setFeedback({ action: "workflow", tone: "loading", message: "Saving workflow..." });

    try {
      const saved = await platform.messaging.sendMessage<BackgroundMessage, Workflow>({
        type: "workflow:save",
        payload: {
          workflow: buildWorkflowDraft(result, editableText)
        }
      });
      setWorkflow(saved);
      setFeedback({
        action: "workflow",
        tone: "success",
        message: `Workflow saved: ${saved.title}`,
        detail: `${saved.constraints.length} stable items preserved.`
      });
    } catch (error) {
      setFeedback({
        action: "workflow",
        tone: "error",
        message: "Could not save workflow.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [editableText, result, setFeedback]);

  const saveCapsule = useCallback(async () => {
    if (!result) return;
    setPendingAction("capsule");
    setFeedback({ action: "capsule", tone: "loading", message: "Saving capsule..." });

    try {
      const saved = await platform.messaging.sendMessage<BackgroundMessage, CarryForwardCapsule>({
        type: "capsule:save",
        payload: {
          capsule: buildCapsuleDraft(result, editableText)
        }
      });
      setCapsule(saved);
      setFeedback({
        action: "capsule",
        tone: "success",
        message: `Capsule saved: ${saved.title}`,
        detail: `${saved.constraints.length} constraints, ${saved.decisions.length} decisions, ${saved.open_questions.length} open items.`
      });
    } catch (error) {
      setFeedback({
        action: "capsule",
        tone: "error",
        message: "Could not save capsule.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [editableText, result, setFeedback]);

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
          <p className="eyebrow">Powered by LuxCrypta</p>
          <h1>Continuity Review</h1>
        </div>
        <ScoreBadge scores={result.scores} />
      </header>

      <ActionBar>
        <Button icon={<Check size={15} />} variant="primary" disabled={isActionBusy} onClick={() => void apply()}>
          {actionLabel("apply")}
        </Button>
        <Button icon={<Clipboard size={15} />} disabled={isActionBusy} onClick={() => void copy()}>
          {actionLabel("copy")}
        </Button>
        <Button icon={<Save size={15} />} disabled={isActionBusy} onClick={() => void saveWorkflow()}>
          {actionLabel("workflow")}
        </Button>
        <Button icon={<FilePlus2 size={15} />} disabled={isActionBusy} onClick={() => void saveCapsule()}>
          {actionLabel("capsule")}
        </Button>
      </ActionBar>
      {actionFeedback ? (
        <div
          className={`toolbar-feedback toolbar-feedback--${actionFeedback.tone}`}
          role={actionFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <strong>{actionFeedback.message}</strong>
          {actionFeedback.detail ? <span>{actionFeedback.detail}</span> : null}
        </div>
      ) : null}

      <section className="review-section clean-summary">
        <h2>Clean Summary</h2>
        <p>{result.continuityReview.cleanSummary}</p>
      </section>

      <section className="review-section active-objective">
        <h2>Active Objective</h2>
        <p>{result.continuityReview.activeObjective}</p>
      </section>

      <div className="review-grid continuity-grid">
        <ReviewListSection
          title="Stable Core"
          items={result.continuityReview.stableCore}
          emptyText="No stable constraints or accepted decisions detected yet."
        />
        <ReviewListSection
          title="New / Provisional"
          items={result.continuityReview.newProvisional}
          emptyText="No new provisional changes detected."
        />
        <ReviewListSection
          title="Open / Unresolved"
          items={result.continuityReview.openUnresolved}
          emptyText="No open questions or unresolved risks detected."
        />
        <ReviewListSection
          title="What Changed"
          items={result.continuityReview.whatChanged}
          emptyText="No material runtime changes detected."
        />
      </div>

      <ReviewListSection
        title="Recommended Next Actions"
        items={result.continuityReview.recommendedNextActions}
        emptyText="No next actions suggested."
      />

      <section className="review-grid review-comparison" aria-label="Continuity comparison">
        <article className="review-pane review-pane--comparison">
          <h2>Continuity Source</h2>
          <pre className="review-pane__content">{sourcePreviewText}</pre>
        </article>
        <article className="review-pane review-pane--comparison">
          <h2>Transformed</h2>
          <textarea
            className="review-pane__content"
            aria-label="Transformed continuity draft"
            value={editableText}
            onChange={(event) => setEditableText(event.target.value)}
          />
        </article>
      </section>

      <section className="review-section">
        <h2>Diff</h2>
        <DiffView blocks={result.diff} />
      </section>

      <section className="review-grid">
        {workflow ? <WorkflowCard workflow={workflow} /> : null}
        {capsule ? <CapsuleCard capsule={capsule} /> : null}
      </section>

      <details className="review-section diagnostics-panel">
        <summary>Advanced Diagnostics</summary>
        <div className="health-grid">
          <span>Continuity {sessionState?.monitors.continuityScore ?? result.scores.constraintPreservationScore * 100}%</span>
          <span>Drift {sessionState?.monitors.driftScore ?? 0}%</span>
          <span>Novelty {sessionState?.monitors.noveltyLoad ?? result.continuityReview.newProvisional.length}</span>
          <span>Open {sessionState?.monitors.opennessScore ?? result.continuityReview.openUnresolved.length}</span>
          <span>Density {sessionState?.monitors.compressionDensity ?? result.scores.compactnessScore * 100}%</span>
          <span>Status {sessionState?.monitors.sessionHealth ?? "review"}</span>
        </div>
        <h3>Raw Capsule / Diagnostic Data</h3>
        <pre className="diagnostics-json">
          {JSON.stringify(
            {
              continuity: result.continuityReview.diagnostics,
              session: sessionState,
              scores: result.scores
            },
            null,
            2
          )}
        </pre>
      </details>

      <p className="status-line">{status}</p>
    </main>
  );
}
