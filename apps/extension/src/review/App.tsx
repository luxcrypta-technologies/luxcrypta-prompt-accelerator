import { getPlatformAPI } from "@platform-runtime";
import { Check, Clipboard, Download, FilePlus2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EXTENSION_VERSION } from "@/app/constants";
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
import {
  artifactFilename,
  buildCapsuleDraft,
  buildDiagnosticState,
  buildPortableCapsuleArtifact,
  buildPortableWorkflowArtifact,
  buildWorkflowDraft,
  formatContinuityExport,
  formatDiagnosticMarkdown,
  type ReviewArtifactContext
} from "./continuity-artifacts";

const platform = getPlatformAPI();

type ToolbarAction = "apply" | "copy" | "workflow" | "capsule";
type ReviewAction =
  | ToolbarAction
  | "workflow-copy"
  | "workflow-download"
  | "capsule-copy"
  | "capsule-download"
  | "diagnostics-copy"
  | "diagnostics-download";
type FeedbackTone = "loading" | "success" | "error";

interface ToolbarFeedback {
  action: ReviewAction;
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
  if (!text.trim()) {
    throw new Error("No data available to copy.");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    if (navigator.clipboard.readText) {
      try {
        const verified = await navigator.clipboard.readText();
        if (verified !== text) {
          throw new Error("Clipboard verification failed.");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Clipboard verification failed.") {
          throw error;
        }
      }
    }
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

async function copyToClipboardSafely(text: string): Promise<boolean> {
  try {
    await writeClipboard(text);
    return true;
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    return false;
  }
}

function downloadTextFile(text: string, filename: string, type = "application/json"): void {
  if (!text.trim()) {
    throw new Error("No data available to download.");
  }
  if (typeof URL.createObjectURL !== "function") {
    throw new Error("Download export is unavailable in this browser context.");
  }
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyOrDownloadJson(text: string, filename: string): Promise<"clipboard" | "download"> {
  const copied = await copyToClipboardSafely(text);
  if (copied) {
    return "clipboard";
  }
  downloadTextFile(text, filename);
  return "download";
}

function getExtensionVersion(): string {
  try {
    return chrome.runtime?.getManifest?.().version ?? EXTENSION_VERSION;
  } catch {
    return EXTENSION_VERSION;
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
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
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

  const feedbackSummary = useCallback(
    () =>
      actionFeedback
        ? `${actionFeedback.tone}: ${actionFeedback.message}${actionFeedback.detail ? ` (${actionFeedback.detail})` : ""}`
        : undefined,
    [actionFeedback]
  );

  const artifactContext = useCallback(
    (overrides?: Partial<ReviewArtifactContext>): ReviewArtifactContext | null => {
      if (!result) return null;
      const currentFeedback = feedbackSummary();
      return {
        result,
        transformedText: editableText,
        sessionState,
        workflow,
        capsule,
        extensionVersion: getExtensionVersion(),
        currentUrl: window.location.href,
        saveStatus: currentFeedback,
        exportStatus: currentFeedback,
        errorLogs: actionFeedback?.tone === "error" ? [actionFeedback.detail ?? actionFeedback.message] : [],
        ...overrides
      };
    },
    [actionFeedback, capsule, editableText, feedbackSummary, result, sessionState, workflow]
  );

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
      const copied = await copyToClipboardSafely(formatContinuityExport(result, editableText));
      if (!copied) {
        throw new Error("Clipboard unavailable.");
      }
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

    let savedWorkflow: Workflow | null = null;
    try {
      const saved = await platform.messaging.sendMessage<BackgroundMessage, Workflow>({
        type: "workflow:save",
        payload: {
          workflow: buildWorkflowDraft(result, editableText)
        }
      });
      savedWorkflow = saved;
      setWorkflow(saved);
      const context = artifactContext({ workflow: saved });
      if (!context) {
        throw new Error("Saved workflow could not be prepared for export.");
      }
      const portableWorkflow = buildPortableWorkflowArtifact(saved, context);
      const json = JSON.stringify(portableWorkflow, null, 2);
      const retrieval = await copyOrDownloadJson(json, artifactFilename("workflow", saved.title));
      setFeedback({
        action: "workflow",
        tone: "success",
        message: `Workflow saved: ${saved.title}`,
        detail:
          retrieval === "clipboard"
            ? `Stored in extension storage and copied as JSON. ${saved.constraints.length} stable items preserved.`
            : `Stored in extension storage. Clipboard unavailable, so JSON download started. ${saved.constraints.length} stable items preserved.`
      });
    } catch (error) {
      setFeedback({
        action: "workflow",
        tone: "error",
        message: savedWorkflow ? "Workflow saved to storage, but export failed." : "Could not save workflow.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, editableText, result, setFeedback]);

  const saveCapsule = useCallback(async () => {
    if (!result) return;
    setPendingAction("capsule");
    setFeedback({ action: "capsule", tone: "loading", message: "Saving capsule..." });

    let savedCapsule: CarryForwardCapsule | null = null;
    try {
      const saved = await platform.messaging.sendMessage<BackgroundMessage, CarryForwardCapsule>({
        type: "capsule:save",
        payload: {
          capsule: buildCapsuleDraft(result, editableText)
        }
      });
      savedCapsule = saved;
      setCapsule(saved);
      const context = artifactContext({ capsule: saved });
      if (!context) {
        throw new Error("Saved capsule could not be prepared for export.");
      }
      const portableCapsule = buildPortableCapsuleArtifact(saved, context);
      const json = JSON.stringify(portableCapsule, null, 2);
      const retrieval = await copyOrDownloadJson(json, artifactFilename("capsule", saved.title));
      setFeedback({
        action: "capsule",
        tone: "success",
        message: `Capsule saved: ${saved.title}`,
        detail:
          retrieval === "clipboard"
            ? `Stored in extension storage and copied as JSON. ${saved.constraints.length} constraints, ${saved.decisions.length} decisions, ${saved.open_questions.length} open items.`
            : `Stored in extension storage. Clipboard unavailable, so JSON download started. ${saved.constraints.length} constraints, ${saved.decisions.length} decisions, ${saved.open_questions.length} open items.`
      });
    } catch (error) {
      setFeedback({
        action: "capsule",
        tone: "error",
        message: savedCapsule ? "Capsule saved to storage, but export failed." : "Could not save capsule.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, editableText, result, setFeedback]);

  const copySavedWorkflow = useCallback(async () => {
    if (!workflow) return;
    setPendingAction("workflow-copy");
    setFeedback({ action: "workflow-copy", tone: "loading", message: "Copying saved workflow..." });
    try {
      const context = artifactContext({ workflow });
      if (!context) throw new Error("No workflow data available.");
      const json = JSON.stringify(buildPortableWorkflowArtifact(workflow, context), null, 2);
      const retrieval = await copyOrDownloadJson(json, artifactFilename("workflow", workflow.title));
      setFeedback({
        action: "workflow-copy",
        tone: "success",
        message: retrieval === "clipboard" ? "Workflow copied to clipboard" : "Workflow exported as JSON",
        detail:
          retrieval === "clipboard"
            ? "Saved workflow artifact is ready to paste."
            : "Clipboard unavailable, so the saved workflow JSON download started."
      });
    } catch (error) {
      setFeedback({
        action: "workflow-copy",
        tone: "error",
        message: "Could not copy saved workflow.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, setFeedback, workflow]);

  const downloadSavedWorkflow = useCallback(() => {
    if (!workflow) return;
    setPendingAction("workflow-download");
    try {
      const context = artifactContext({ workflow });
      if (!context) throw new Error("No workflow data available.");
      const json = JSON.stringify(buildPortableWorkflowArtifact(workflow, context), null, 2);
      downloadTextFile(json, artifactFilename("workflow", workflow.title));
      setFeedback({
        action: "workflow-download",
        tone: "success",
        message: "Workflow exported as JSON",
        detail: "Saved workflow artifact download started."
      });
    } catch (error) {
      setFeedback({
        action: "workflow-download",
        tone: "error",
        message: "Could not export saved workflow.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, setFeedback, workflow]);

  const copySavedCapsule = useCallback(async () => {
    if (!capsule) return;
    setPendingAction("capsule-copy");
    setFeedback({ action: "capsule-copy", tone: "loading", message: "Copying saved capsule..." });
    try {
      const context = artifactContext({ capsule });
      if (!context) throw new Error("No capsule data available.");
      const json = JSON.stringify(buildPortableCapsuleArtifact(capsule, context), null, 2);
      const retrieval = await copyOrDownloadJson(json, artifactFilename("capsule", capsule.title));
      setFeedback({
        action: "capsule-copy",
        tone: "success",
        message: retrieval === "clipboard" ? "Capsule copied to clipboard" : "Capsule exported as JSON",
        detail:
          retrieval === "clipboard"
            ? "Saved capsule artifact is ready to paste."
            : "Clipboard unavailable, so the saved capsule JSON download started."
      });
    } catch (error) {
      setFeedback({
        action: "capsule-copy",
        tone: "error",
        message: "Could not copy saved capsule.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, capsule, setFeedback]);

  const downloadSavedCapsule = useCallback(() => {
    if (!capsule) return;
    setPendingAction("capsule-download");
    try {
      const context = artifactContext({ capsule });
      if (!context) throw new Error("No capsule data available.");
      const json = JSON.stringify(buildPortableCapsuleArtifact(capsule, context), null, 2);
      downloadTextFile(json, artifactFilename("capsule", capsule.title));
      setFeedback({
        action: "capsule-download",
        tone: "success",
        message: "Capsule exported as JSON",
        detail: "Saved capsule artifact download started."
      });
    } catch (error) {
      setFeedback({
        action: "capsule-download",
        tone: "error",
        message: "Could not export saved capsule.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, capsule, setFeedback]);

  const copyDiagnosticData = useCallback(async () => {
    const context = artifactContext({ exportStatus: "Copy Raw Diagnostic Data" });
    if (!context) return;
    setPendingAction("diagnostics-copy");
    setFeedback({ action: "diagnostics-copy", tone: "loading", message: "Copying raw diagnostic data..." });
    try {
      const markdown = formatDiagnosticMarkdown(context);
      const copied = await copyToClipboardSafely(markdown);
      if (!copied) {
        downloadTextFile(markdown, artifactFilename("diagnostic", "raw-diagnostic-data").replace(/\.json$/, ".md"), "text/markdown");
      }
      setFeedback({
        action: "diagnostics-copy",
        tone: "success",
        message: copied ? "Raw diagnostic data copied" : "Raw diagnostic data exported",
        detail: copied
          ? "Markdown diagnostic state is ready to paste into an engineering thread."
          : "Clipboard unavailable, so a Markdown diagnostic export download started."
      });
    } catch (error) {
      setFeedback({
        action: "diagnostics-copy",
        tone: "error",
        message: "Could not export diagnostic data.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, setFeedback]);

  const downloadDiagnosticJson = useCallback(() => {
    const context = artifactContext({ exportStatus: "Download Diagnostic JSON" });
    if (!context) return;
    setPendingAction("diagnostics-download");
    try {
      const json = JSON.stringify(buildDiagnosticState(context), null, 2);
      downloadTextFile(json, artifactFilename("diagnostic", "diagnostic-state"));
      setFeedback({
        action: "diagnostics-download",
        tone: "success",
        message: "Diagnostic state exported as JSON",
        detail: "Diagnostic JSON download started."
      });
    } catch (error) {
      setFeedback({
        action: "diagnostics-download",
        tone: "error",
        message: "Could not export diagnostic JSON.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, setFeedback]);

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
        {workflow ? (
          <div className="saved-artifact">
            <WorkflowCard workflow={workflow} />
            <div className="saved-artifact__actions">
              <Button icon={<Clipboard size={15} />} disabled={isActionBusy} onClick={() => void copySavedWorkflow()}>
                Copy saved workflow
              </Button>
              <Button icon={<Download size={15} />} disabled={isActionBusy} onClick={() => downloadSavedWorkflow()}>
                Download JSON
              </Button>
            </div>
          </div>
        ) : null}
        {capsule ? (
          <div className="saved-artifact">
            <CapsuleCard capsule={capsule} />
            <div className="saved-artifact__actions">
              <Button icon={<Clipboard size={15} />} disabled={isActionBusy} onClick={() => void copySavedCapsule()}>
                Copy saved capsule
              </Button>
              <Button icon={<Download size={15} />} disabled={isActionBusy} onClick={() => downloadSavedCapsule()}>
                Download JSON
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <details className="review-section diagnostics-panel">
        <summary>Advanced Diagnostics</summary>
        <div className="diagnostics-actions">
          <Button icon={<Clipboard size={15} />} disabled={isActionBusy} onClick={() => void copyDiagnosticData()}>
            Copy Raw Diagnostic Data
          </Button>
          <Button icon={<Download size={15} />} disabled={isActionBusy} onClick={() => downloadDiagnosticJson()}>
            Export Diagnostic State
          </Button>
        </div>
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
            buildDiagnosticState(
              artifactContext({
                exportStatus: "Advanced Diagnostics visible state"
              }) ?? {
                result,
                transformedText: editableText,
                sessionState,
                extensionVersion: getExtensionVersion(),
                currentUrl: window.location.href
              }
            ),
            null,
            2
          )}
        </pre>
      </details>

      <p className="status-line">{status}</p>
    </main>
  );
}
