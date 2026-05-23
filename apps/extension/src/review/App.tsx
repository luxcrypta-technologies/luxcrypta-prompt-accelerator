import { getPlatformAPI } from "@platform-runtime";
import { Check, Clipboard, Download, FilePlus2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EXTENSION_VERSION } from "@/app/constants";
import type { CarryForwardCapsule } from "@/types/capsules";
import type { SessionGovernanceState, SessionUpdateResult } from "@/types/governance";
import type {
  BackgroundMessage,
  ContentMessage,
  ContentMessageResult,
  ReviewState
} from "@/types/messages";
import type { TransformResult } from "@/types/prompts";
import type { ProviderHealth } from "@/types/surfaces";
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
type ReviewAction = string;
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

async function copyOrDownloadJson(
  text: string,
  filename: string
): Promise<"clipboard" | "download"> {
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

function markdownBlock(title: string, content: string | string[], emptyText?: string): string {
  const items = Array.isArray(content) ? content.filter(Boolean) : [content].filter(Boolean);
  return [
    title,
    ...(items.length
      ? items.map((item) => (Array.isArray(content) ? `- ${item}` : item))
      : [emptyText ?? "No data available."])
  ]
    .filter(Boolean)
    .join("\n");
}

function stableJsonPayload(
  title: string,
  payload: unknown,
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  return {
    title,
    payload,
    metadata
  };
}

function handoffBlockers(result: TransformResult): string[] {
  const blockers = result.continuityReview.diagnostics.readiness_blockers ?? [];
  if (result.continuityReview.diagnostics.export_readiness_decision === "UNSAFE_FOR_HANDOFF") {
    return blockers.length ? blockers : ["handoff readiness is unsafe"];
  }
  return [];
}

function assertSafeForHandoff(result: TransformResult): void {
  const blockers = handoffBlockers(result);
  if (blockers.length) {
    throw new Error(`UNSAFE_FOR_HANDOFF: ${blockers.join("; ")}`);
  }
}

function SectionCopyControls({
  title,
  text,
  jsonPayload,
  onCopy
}: {
  title: string;
  text: string;
  jsonPayload?: unknown;
  onCopy: (label: string, text: string, jsonPayload?: unknown) => void;
}) {
  return (
    <div className="section-copy-controls" aria-label={`${title} copy controls`}>
      <button
        type="button"
        className="section-copy-button"
        aria-label={`Copy ${title}`}
        title={`Copy ${title}`}
        onClick={() => onCopy(title, text)}
      >
        <Clipboard size={13} />
        Copy
      </button>
      <button
        type="button"
        className="section-copy-button"
        aria-label={`Copy ${title} as JSON`}
        title={`Copy ${title} as JSON`}
        onClick={() =>
          onCopy(`${title} JSON`, JSON.stringify(jsonPayload ?? { title, text }, null, 2))
        }
      >
        JSON
      </button>
    </div>
  );
}

function ReviewSectionHeader({
  title,
  text,
  jsonPayload,
  onCopy
}: {
  title: string;
  text: string;
  jsonPayload?: unknown;
  onCopy: (label: string, text: string, jsonPayload?: unknown) => void;
}) {
  return (
    <div className="review-section__header">
      <h2>{title}</h2>
      <SectionCopyControls title={title} text={text} jsonPayload={jsonPayload} onCopy={onCopy} />
    </div>
  );
}

function ReviewListSection({
  title,
  items,
  emptyText,
  metadata,
  variant = "section",
  onCopy
}: {
  title: string;
  items: string[];
  emptyText: string;
  metadata?: Record<string, unknown>;
  variant?: "section" | "block";
  onCopy: (label: string, text: string, jsonPayload?: unknown) => void;
}) {
  const text = markdownBlock(title, items, emptyText);
  return (
    <section
      className={
        variant === "block"
          ? "diagnostics-block continuity-section"
          : "review-section continuity-section"
      }
    >
      <ReviewSectionHeader
        title={title}
        text={text}
        jsonPayload={stableJsonPayload(title, items, metadata)}
        onCopy={onCopy}
      />
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

function ReviewTextSection({
  className,
  title,
  text,
  emptyText,
  jsonPayload,
  onCopy
}: {
  className?: string;
  title: string;
  text?: string;
  emptyText: string;
  jsonPayload?: unknown;
  onCopy: (label: string, text: string, jsonPayload?: unknown) => void;
}) {
  const displayText = text?.trim() || emptyText;
  const copyText = markdownBlock(title, displayText);
  return (
    <section className={`review-section${className ? ` ${className}` : ""}`}>
      <ReviewSectionHeader
        title={title}
        text={copyText}
        jsonPayload={jsonPayload ?? stableJsonPayload(title, displayText)}
        onCopy={onCopy}
      />
      <p>{displayText}</p>
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
    const next = await platform.messaging.sendMessage<
      BackgroundMessage,
      SessionGovernanceState | null
    >({
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
      .catch((error: unknown) =>
        setStatus(error instanceof Error ? error.message : "Unable to load review.")
      );
  }, [loadSessionState]);

  useEffect(() => {
    if (!state?.id || !state.result) return;
    const frame = window.requestAnimationFrame(() => {
      void platform.messaging
        .sendMessage<
          BackgroundMessage,
          {
            providerHealth?: ProviderHealth;
            openStatus?: ProviderHealth["review_open_status"];
            result?: TransformResult;
          } | null
        >({
          type: "review:rendered",
          payload: { reviewId: state.id }
        })
        .then((ack) => {
          if (!ack?.providerHealth) return;
          setState((current) => {
            if (!current || current.id !== state.id) return current;
            if (ack.result) {
              return {
                ...current,
                result: ack.result
              };
            }
            return {
              ...current,
              result: {
                ...current.result,
                continuityReview: {
                  ...current.result.continuityReview,
                  diagnostics: {
                    ...current.result.continuityReview.diagnostics,
                    providerHealth: ack.providerHealth
                  }
                }
              }
            };
          });
        })
        .catch((error: unknown) => {
          console.warn("Prompt Review visible-render acknowledgement failed:", error);
          const detail = errorDetail(error);
          setActionFeedback({
            action: "review-rendered",
            tone: "error",
            message: "Review visibility could not be confirmed.",
            detail
          });
          setStatus(detail ? `Review visibility could not be confirmed. ${detail}` : "Review visibility could not be confirmed.");
        });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state?.id, state?.result]);

  const result: TransformResult | null = state?.result ?? null;
  const sourcePreviewText = result?.continuityReview.diagnostics.rawCapsule
    ? result.normalizedText
    : (result?.originalText ?? "");
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
        errorLogs:
          actionFeedback?.tone === "error" ? [actionFeedback.detail ?? actionFeedback.message] : [],
        ...overrides
      };
    },
    [actionFeedback, capsule, editableText, feedbackSummary, result, sessionState, workflow]
  );

  const persistVisibleReviewState = useCallback(async (): Promise<TransformResult | null> => {
    if (!state || !result) return result;
    const nextResult = { ...result, transformedText: editableText };
    const persisted = await platform.messaging.sendMessage<BackgroundMessage, ReviewState | null>({
      type: "review:update",
      payload: { reviewId: state.id, result: nextResult }
    });
    if (!persisted?.result) {
      throw new Error("Prompt Review state could not be persisted.");
    }
    setState(persisted);
    return persisted.result;
  }, [editableText, result, state]);

  const actionLabel = useCallback(
    (action: ToolbarAction) => {
      if (pendingAction === action) return ACTION_LABELS[action].pending;
      if (actionFeedback?.action === action && actionFeedback.tone === "success")
        return ACTION_LABELS[action].success;
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
      if (
        "text" in applyResponse &&
        applyResponse.text !== undefined &&
        applyResponse.text.trim() !== editableText.trim()
      ) {
        throw new Error("The draft text could not be verified after applying.");
      }

      let detail: string | undefined;
      if (result) {
        try {
          const updated = await platform.messaging.sendMessage<
            BackgroundMessage,
            SessionUpdateResult | null
          >({
            type: "session:update",
            payload: {
              transformResult: { ...result, transformedText: editableText },
              sourceSurface: result.targetModelApplied
            }
          });
          setSessionState((current) => updated?.state ?? current);
        } catch (error) {
          detail = errorDetail(error)
            ? "Draft updated. Session state refresh did not complete."
            : undefined;
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
    setFeedback({ action: "copy", tone: "loading", message: "Copying all review..." });

    try {
      const persistedResult = await persistVisibleReviewState();
      if (!persistedResult) throw new Error("No persisted review state available.");
      assertSafeForHandoff(persistedResult);
      const copied = await copyToClipboardSafely(
        formatContinuityExport(persistedResult, editableText)
      );
      if (!copied) {
        throw new Error("Clipboard unavailable.");
      }
      setFeedback({
        action: "copy",
        tone: "success",
        message: "Copied continuity review",
        detail:
          "Clean export copied with objective, stable core, provisional items, open items, next actions, and transformed draft."
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
  }, [editableText, persistVisibleReviewState, result, setFeedback]);

  const diagnosticStateJson = useCallback(() => {
    const context =
      artifactContext({
        exportStatus: "Prompt Review visible state"
      }) ??
      (result
        ? {
            result,
            transformedText: editableText,
            sessionState,
            extensionVersion: getExtensionVersion(),
            currentUrl: window.location.href
          }
        : null);
    return context ? JSON.stringify(buildDiagnosticState(context), null, 2) : "";
  }, [artifactContext, editableText, result, sessionState]);

  const engineeringSummary = useCallback(() => {
    if (!result) return "";
    const review = result.continuityReview;
    const governance = review.diagnostics.adversarialGovernance;
    return [
      "Engineering Summary",
      `Provider: ${review.diagnostics.providerProfile?.provider ?? review.diagnostics.sourceSurface ?? "unknown"}`,
      `Active Objective: ${review.activeObjective}`,
      `Stable Core Count: ${review.stableCore.length}`,
      `Provisional Count: ${review.newProvisional.length}`,
      `Open / Unresolved Count: ${review.openUnresolved.length}`,
      `Rejected Directions Count: ${governance?.rejected_directions.length ?? 0}`,
      `Quarantine Count: ${governance?.quarantine_log.length ?? 0}`,
      `Source Purity: ${result.scores.sourcePurityScore ?? "n/a"}`,
      `Bucket Exclusivity: ${result.scores.bucketExclusivityScore ?? "n/a"}`,
      "",
      "Metric Warnings",
      ...(review.diagnostics.metric_warnings?.length
        ? review.diagnostics.metric_warnings.map((item) => `- ${item}`)
        : ["- None"])
    ].join("\n");
  }, [result]);

  const copyReviewWithJson = useCallback(async () => {
    if (!result) return;
    setPendingAction("review-json-copy");
    setFeedback({
      action: "review-json-copy",
      tone: "loading",
      message: "Copying review and raw JSON..."
    });
    try {
      const persistedResult = await persistVisibleReviewState();
      if (!persistedResult) throw new Error("No persisted review state available.");
      assertSafeForHandoff(persistedResult);
      const text = [
        formatContinuityExport(persistedResult, editableText),
        "Raw JSON",
        diagnosticStateJson()
      ].join("\n\n");
      const copied = await copyToClipboardSafely(text);
      if (!copied) throw new Error("Clipboard unavailable.");
      setFeedback({
        action: "review-json-copy",
        tone: "success",
        message: "Copied review and raw JSON"
      });
    } catch (error) {
      setFeedback({
        action: "review-json-copy",
        tone: "error",
        message: "Could not copy review and raw JSON.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [diagnosticStateJson, editableText, persistVisibleReviewState, result, setFeedback]);

  const copyEngineeringSummary = useCallback(async () => {
    if (!result) return;
    setPendingAction("engineering-summary-copy");
    setFeedback({
      action: "engineering-summary-copy",
      tone: "loading",
      message: "Copying engineering summary..."
    });
    try {
      const copied = await copyToClipboardSafely(engineeringSummary());
      if (!copied) throw new Error("Clipboard unavailable.");
      setFeedback({
        action: "engineering-summary-copy",
        tone: "success",
        message: "Copied engineering summary"
      });
    } catch (error) {
      setFeedback({
        action: "engineering-summary-copy",
        tone: "error",
        message: "Could not copy engineering summary.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [engineeringSummary, result, setFeedback]);

  const copyWorkflowExport = useCallback(async () => {
    if (!result) return;
    setPendingAction("workflow-export-copy");
    setFeedback({
      action: "workflow-export-copy",
      tone: "loading",
      message: "Copying workflow export..."
    });
    try {
      const persistedResult = await persistVisibleReviewState();
      if (!persistedResult) throw new Error("No persisted review state available.");
      assertSafeForHandoff(persistedResult);
      const now = new Date().toISOString();
      const draft = buildWorkflowDraft(persistedResult, editableText);
      const exportWorkflow: Workflow = {
        ...draft,
        id: "unsaved-workflow-export",
        workflow_id: "unsaved-workflow-export",
        createdAt: now,
        updatedAt: now
      };
      const context = artifactContext({ result: persistedResult, workflow: exportWorkflow });
      if (!context) throw new Error("No workflow export data available.");
      const copied = await copyToClipboardSafely(
        JSON.stringify(buildPortableWorkflowArtifact(exportWorkflow, context), null, 2)
      );
      if (!copied) throw new Error("Clipboard unavailable.");
      setFeedback({
        action: "workflow-export-copy",
        tone: "success",
        message: "Copied workflow export"
      });
    } catch (error) {
      setFeedback({
        action: "workflow-export-copy",
        tone: "error",
        message: "Could not copy workflow export.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, editableText, persistVisibleReviewState, result, setFeedback]);

  const copyPortableCapsule = useCallback(async () => {
    if (!result) return;
    setPendingAction("portable-capsule-copy");
    setFeedback({
      action: "portable-capsule-copy",
      tone: "loading",
      message: "Copying portable capsule..."
    });
    try {
      const persistedResult = await persistVisibleReviewState();
      if (!persistedResult) throw new Error("No persisted review state available.");
      assertSafeForHandoff(persistedResult);
      const now = new Date().toISOString();
      const draft = buildCapsuleDraft(persistedResult, editableText);
      const exportCapsule: CarryForwardCapsule = {
        capsule_version: 1,
        ...draft,
        id: "unsaved-capsule-export",
        capsule_id: "unsaved-capsule-export",
        created_at: now,
        updated_at: now
      };
      const context = artifactContext({ result: persistedResult, capsule: exportCapsule });
      if (!context) throw new Error("No capsule export data available.");
      const copied = await copyToClipboardSafely(
        JSON.stringify(buildPortableCapsuleArtifact(exportCapsule, context), null, 2)
      );
      if (!copied) throw new Error("Clipboard unavailable.");
      setFeedback({
        action: "portable-capsule-copy",
        tone: "success",
        message: "Copied portable capsule"
      });
    } catch (error) {
      setFeedback({
        action: "portable-capsule-copy",
        tone: "error",
        message: "Could not copy portable capsule.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, editableText, persistVisibleReviewState, result, setFeedback]);

  const copyReviewBlock = useCallback(
    async (label: string, text: string) => {
      setPendingAction(`section-copy:${label}`);
      setFeedback({
        action: `section-copy:${label}`,
        tone: "loading",
        message: `Copying ${label}...`
      });
      try {
        const copied = await copyToClipboardSafely(text);
        if (!copied) throw new Error("Clipboard unavailable.");
        setFeedback({
          action: `section-copy:${label}`,
          tone: "success",
          message: `Copied ${label}`
        });
      } catch (error) {
        setFeedback({
          action: `section-copy:${label}`,
          tone: "error",
          message: `Could not copy ${label}.`,
          detail: errorDetail(error)
        });
      } finally {
        setPendingAction(null);
      }
    },
    [setFeedback]
  );

  const saveWorkflow = useCallback(async () => {
    if (!result) return;
    setPendingAction("workflow");
    setFeedback({ action: "workflow", tone: "loading", message: "Saving workflow..." });

    let savedWorkflow: Workflow | null = null;
    try {
      const persistedResult = await persistVisibleReviewState();
      if (!persistedResult) throw new Error("No persisted review state available.");
      assertSafeForHandoff(persistedResult);
      const saved = await platform.messaging.sendMessage<BackgroundMessage, Workflow>({
        type: "workflow:save",
        payload: {
          workflow: buildWorkflowDraft(persistedResult, editableText)
        }
      });
      savedWorkflow = saved;
      setWorkflow(saved);
      const context = artifactContext({ result: persistedResult, workflow: saved });
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
        message: savedWorkflow
          ? "Workflow saved to storage, but export failed."
          : "Could not save workflow.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, editableText, persistVisibleReviewState, result, setFeedback]);

  const saveCapsule = useCallback(async () => {
    if (!result) return;
    setPendingAction("capsule");
    setFeedback({ action: "capsule", tone: "loading", message: "Saving capsule..." });

    let savedCapsule: CarryForwardCapsule | null = null;
    try {
      const persistedResult = await persistVisibleReviewState();
      if (!persistedResult) throw new Error("No persisted review state available.");
      assertSafeForHandoff(persistedResult);
      const saved = await platform.messaging.sendMessage<BackgroundMessage, CarryForwardCapsule>({
        type: "capsule:save",
        payload: {
          capsule: buildCapsuleDraft(persistedResult, editableText)
        }
      });
      savedCapsule = saved;
      setCapsule(saved);
      const context = artifactContext({ result: persistedResult, capsule: saved });
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
        message: savedCapsule
          ? "Capsule saved to storage, but export failed."
          : "Could not save capsule.",
        detail: errorDetail(error)
      });
    } finally {
      setPendingAction(null);
    }
  }, [artifactContext, editableText, persistVisibleReviewState, result, setFeedback]);

  const copySavedWorkflow = useCallback(async () => {
    if (!workflow) return;
    setPendingAction("workflow-copy");
    setFeedback({ action: "workflow-copy", tone: "loading", message: "Copying saved workflow..." });
    try {
      const context = artifactContext({ workflow });
      if (!context) throw new Error("No workflow data available.");
      const json = JSON.stringify(buildPortableWorkflowArtifact(workflow, context), null, 2);
      const retrieval = await copyOrDownloadJson(
        json,
        artifactFilename("workflow", workflow.title)
      );
      setFeedback({
        action: "workflow-copy",
        tone: "success",
        message:
          retrieval === "clipboard" ? "Workflow copied to clipboard" : "Workflow exported as JSON",
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
        message:
          retrieval === "clipboard" ? "Capsule copied to clipboard" : "Capsule exported as JSON",
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
    setFeedback({
      action: "diagnostics-copy",
      tone: "loading",
      message: "Copying raw diagnostic data..."
    });
    try {
      const markdown = formatDiagnosticMarkdown(context);
      const copied = await copyToClipboardSafely(markdown);
      if (!copied) {
        downloadTextFile(
          markdown,
          artifactFilename("diagnostic", "raw-diagnostic-data").replace(/\.json$/, ".md"),
          "text/markdown"
        );
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

  const review = result.continuityReview;
  const governance = review.diagnostics.adversarialGovernance;
  const rawDiagnosticJson = diagnosticStateJson();
  const rawDiagnosticMarkdown = artifactContext({ exportStatus: "Raw Diagnostic Markdown" })
    ? formatDiagnosticMarkdown(artifactContext({ exportStatus: "Raw Diagnostic Markdown" })!)
    : "";
  const mutationRiskLines =
    governance?.mutation_targets.map(
      (item) =>
        `${item.target_component}: ${item.attempted_mutation} (${item.risk_level}, applied: ${item.applied ? "yes" : "no"})`
    ) ?? [];
  const providerProfileLines = review.diagnostics.providerProfile
    ? Object.entries(review.diagnostics.providerProfile).map(
        ([key, value]) => `${key}: ${Array.isArray(value) ? value.join("; ") : String(value)}`
      )
    : [];
  const providerHealthLines = review.diagnostics.providerHealth
    ? Object.entries(review.diagnostics.providerHealth).map(
        ([key, value]) => `${key}: ${Array.isArray(value) ? value.join("; ") : String(value)}`
      )
    : [];
  const visibleWarnings = [
    ...(review.diagnostics.metric_warnings ?? result.scores.warnings ?? []),
    review.diagnostics.fidelity_severity === "critical"
      ? "Critical fidelity failure: source categories appear present but were not extracted."
      : "",
    review.diagnostics.export_readiness_decision === "UNSAFE_FOR_HANDOFF"
      ? "Export readiness: UNSAFE_FOR_HANDOFF."
      : "",
    (result.scores.sourcePurityScore ?? 1) < 0.8 ? "Durable-state source purity is low." : "",
    (result.scores.bucketExclusivityScore ?? 1) < 0.9
      ? "Bucket exclusivity is degraded; check cross-references."
      : "",
    (result.scores.chromeContaminationScore ?? 0) > 0
      ? "Chrome contamination was detected or removed."
      : "",
    (result.scores.assistantContaminationScore ?? 0) > 0
      ? "Assistant-generated content attempted to enter continuity state."
      : "",
    review.diagnostics.providerHealth?.review_open_attempted &&
    !review.diagnostics.providerHealth.visible_to_user
      ? "Review-open visibility has not been confirmed."
      : "",
    review.diagnostics.providerHealth?.failure_stage
      ? `Review-open failed at ${review.diagnostics.providerHealth.failure_stage}: ${review.diagnostics.providerHealth.failure_reason ?? "unknown reason"}`
      : ""
  ].filter(Boolean);
  const readinessLines = [
    review.diagnostics.export_readiness_decision ?? "UNSAFE_FOR_HANDOFF",
    ...(review.diagnostics.readiness_blockers?.map((blocker) => `Blocker: ${blocker}`) ?? []),
    ...(review.diagnostics.missing_state_summary?.map((item) => `Missing state: ${item}`) ?? [])
  ];
  const extractionSourceLines = [
    `Source: ${review.diagnostics.providerHealth?.extraction_source ?? "unknown"}`,
    `Summary: ${review.diagnostics.providerHealth?.extraction_source_summary ?? "n/a"}`,
    `Body-first success: ${review.diagnostics.providerHealth?.body_first_extraction_success ?? governance?.body_first_extraction_success ?? false}`,
    `Segments: ${review.diagnostics.providerHealth?.extracted_segment_count ?? "n/a"}`,
    `Fragments: ${governance?.preclean_fragment_count ?? "n/a"} -> ${governance?.postclean_fragment_count ?? "n/a"}`,
    `Chrome removed: ${governance?.chrome_removed_count ?? 0}`,
    `Surface confidence: ${governance?.provider_surface_confidence ?? "n/a"}`
  ];
  const bucketIntegrityLines = [
    `Collision count: ${governance?.bucket_collision_attempt_count ?? 0}`,
    `Exclusive bucket violations: ${governance?.exclusive_bucket_violation_count ?? 0}`,
    `Durable/trusted leakage: ${governance?.durable_trusted_leakage_count ?? 0}`,
    `Cross refs: ${governance?.cross_ref_count ?? 0}`,
    `Negative-state loss: ${governance?.negative_state_loss_flag ? "yes" : "no"}`
  ];
  const scoreLines = [
    `Source purity: ${result.scores.sourcePurityScore ?? "n/a"}`,
    `Bucket exclusivity: ${result.scores.bucketExclusivityScore ?? "n/a"}`,
    `Chrome contamination: ${result.scores.chromeContaminationScore ?? "n/a"}`,
    `Assistant contamination: ${result.scores.assistantContaminationScore ?? "n/a"}`,
    `Durable precision: ${result.scores.durableStatePrecision ?? "n/a"}`,
    `Durable recall estimate: ${result.scores.durableRecallEstimate ?? result.scores.durableStateRecall ?? "n/a"}`,
    `Governance detection completeness: ${result.scores.governanceDetectionCompleteness ?? "n/a"}`,
    `Invariant detection completeness: ${result.scores.invariantDetectionCompleteness ?? "n/a"}`,
    `Safeguard detection completeness: ${result.scores.safeguardDetectionCompleteness ?? "n/a"}`,
    `Negative-state preservation: ${result.scores.negativeStatePreservation ?? "n/a"}`,
    `Rejected-direction recall: ${result.scores.rejectedDirectionRecall ?? "n/a"}`,
    `Unresolved-tension recall: ${result.scores.unresolvedTensionRecall ?? "n/a"}`,
    `Export readiness: ${result.scores.exportReadiness ?? "n/a"}`,
    `Review truthfulness: ${result.scores.reviewTruthfulness ?? "n/a"}`,
    `Mutation risk: ${result.scores.riskScore}`
  ];
  const admissionCountLines = Object.entries(review.diagnostics.admission_counts ?? {}).map(
    ([key, value]) => `${key}: ${value}`
  );

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
        <Button
          icon={<Check size={15} />}
          variant="primary"
          disabled={isActionBusy}
          onClick={() => void apply()}
        >
          {actionLabel("apply")}
        </Button>
        <Button
          icon={<Clipboard size={15} />}
          aria-label="Copy"
          title="Copy All Review"
          disabled={isActionBusy}
          onClick={() => void copy()}
        >
          Copy All Review
        </Button>
        <Button
          icon={<Clipboard size={15} />}
          disabled={isActionBusy}
          onClick={() => void copyReviewWithJson()}
        >
          Copy Review + Raw JSON
        </Button>
        <Button
          icon={<Clipboard size={15} />}
          disabled={isActionBusy}
          onClick={() => void copyEngineeringSummary()}
        >
          Copy Engineering Summary
        </Button>
        <Button
          icon={<Clipboard size={15} />}
          disabled={isActionBusy}
          onClick={() => void copyPortableCapsule()}
        >
          Copy Portable Capsule
        </Button>
        <Button
          icon={<Clipboard size={15} />}
          disabled={isActionBusy}
          onClick={() => void copyWorkflowExport()}
        >
          Copy Workflow Export
        </Button>
        <Button
          icon={<Save size={15} />}
          disabled={isActionBusy}
          onClick={() => void saveWorkflow()}
        >
          {actionLabel("workflow")}
        </Button>
        <Button
          icon={<FilePlus2 size={15} />}
          disabled={isActionBusy}
          onClick={() => void saveCapsule()}
        >
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

      <div className="review-grid continuity-grid">
        <ReviewListSection
          title="Handoff Readiness"
          items={readinessLines}
          emptyText="UNSAFE_FOR_HANDOFF"
          metadata={{
            decision: review.diagnostics.export_readiness_decision,
            blockers: review.diagnostics.readiness_blockers,
            metadata: review.diagnostics.readiness_metadata
          }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Warnings"
          items={visibleWarnings}
          emptyText="No hard warnings detected."
          metadata={{
            fidelity_severity: review.diagnostics.fidelity_severity,
            export_readiness_decision: review.diagnostics.export_readiness_decision
          }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Scores"
          items={scoreLines}
          emptyText="No scores available."
          metadata={result.scores as unknown as Record<string, unknown>}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Extraction Source"
          items={extractionSourceLines}
          emptyText="No extraction source diagnostics available."
          metadata={{
            provider_health: review.diagnostics.providerHealth,
            cleaned_fragments: review.diagnostics.cleaned_fragments
          }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Bucket Integrity"
          items={bucketIntegrityLines}
          emptyText="No bucket integrity diagnostics available."
          metadata={{
            admission_counts: review.diagnostics.admission_counts,
            bucket_collision_attempt_count: governance?.bucket_collision_attempt_count,
            exclusive_bucket_violation_count: governance?.exclusive_bucket_violation_count,
            durable_trusted_leakage_count: governance?.durable_trusted_leakage_count
          }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Admission Counts"
          items={admissionCountLines}
          emptyText="No admission counts available."
          metadata={review.diagnostics.admission_counts}
          onCopy={copyReviewBlock}
        />
      </div>

      <ReviewTextSection
        className="clean-summary"
        title="Clean Summary"
        text={review.cleanSummary}
        emptyText="No clean summary available."
        jsonPayload={stableJsonPayload("Clean Summary", review.cleanSummary)}
        onCopy={copyReviewBlock}
      />

      <ReviewTextSection
        className="active-objective"
        title="Active Objective"
        text={review.activeObjective}
        emptyText="No active objective detected."
        jsonPayload={stableJsonPayload("Active Objective", review.activeObjective, {
          bucket: "stable_core",
          source: "continuity_review",
          decision: "admit"
        })}
        onCopy={copyReviewBlock}
      />

      <div className="review-grid continuity-grid">
        <ReviewListSection
          title="Stable Core"
          items={review.stableCore}
          emptyText="No stable constraints or accepted decisions detected yet."
          metadata={{ bucket: "stable_core", decision: "admit" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="New / Provisional"
          items={review.newProvisional}
          emptyText="No new provisional changes detected."
          metadata={{ bucket: "provisional_state", decision: "admit" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Open / Unresolved"
          items={review.openUnresolved}
          emptyText="No open questions or unresolved risks detected."
          metadata={{ bucket: "open_unresolved", decision: "defer" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="What Changed"
          items={review.whatChanged}
          emptyText="No material runtime changes detected."
          metadata={{ source: "continuity_review" }}
          onCopy={copyReviewBlock}
        />
      </div>

      <ReviewListSection
        title="Recommended Next Actions"
        items={review.recommendedNextActions}
        emptyText="No next actions suggested."
        metadata={{ source: "continuity_review" }}
        onCopy={copyReviewBlock}
      />

      <div className="review-grid continuity-grid">
        <ReviewListSection
          title="Rejected Directions"
          items={governance?.rejected_directions ?? []}
          emptyText="No rejected directions detected."
          metadata={{ bucket: "rejected_directions", decision: "reject" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Governance Principles"
          items={governance?.governance_principles ?? []}
          emptyText="No governance principles detected."
          metadata={{ bucket: "governance_principles", decision: "admit" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Invariants"
          items={governance?.invariants ?? []}
          emptyText="No invariants detected."
          metadata={{ bucket: "invariants", decision: "admit" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Continuity Safeguards"
          items={governance?.continuity_safeguards ?? []}
          emptyText="No continuity safeguards detected."
          metadata={{ bucket: "continuity_safeguards", decision: "admit" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Quarantine / Deferred"
          items={[
            ...(governance?.quarantine_log ?? []),
            ...(governance?.deferred_items.map((item) => item.text) ?? [])
          ]}
          emptyText="No quarantined or deferred items detected."
          metadata={{ bucket: "quarantine_log", decision: "quarantine_or_defer" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Mutation Risk"
          items={mutationRiskLines}
          emptyText="No mutation risks detected."
          metadata={governance?.mutation_risk_report as Record<string, unknown> | undefined}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Trusted State Summary"
          items={review.diagnostics.trusted_state_summary ?? []}
          emptyText="No trusted state summary available."
          metadata={{ source: "diagnostics" }}
          onCopy={copyReviewBlock}
        />
        <ReviewListSection
          title="Untrusted Instruction Summary"
          items={review.diagnostics.untrusted_instruction_summary ?? []}
          emptyText="No untrusted instructions detected."
          metadata={{ source: "diagnostics" }}
          onCopy={copyReviewBlock}
        />
      </div>

      <section className="review-grid review-comparison" aria-label="Continuity comparison">
        <article className="review-pane review-pane--comparison">
          <ReviewSectionHeader
            title="Continuity Source"
            text={markdownBlock(
              "Continuity Source",
              sourcePreviewText || "No source text available."
            )}
            jsonPayload={stableJsonPayload("Continuity Source", sourcePreviewText)}
            onCopy={copyReviewBlock}
          />
          <pre className="review-pane__content">{sourcePreviewText}</pre>
        </article>
        <article className="review-pane review-pane--comparison">
          <ReviewSectionHeader
            title="Transformed Text"
            text={markdownBlock(
              "Transformed Text",
              editableText || "No transformed text available."
            )}
            jsonPayload={stableJsonPayload("Transformed Text", editableText)}
            onCopy={copyReviewBlock}
          />
          <textarea
            className="review-pane__content"
            aria-label="Transformed continuity draft"
            value={editableText}
            onChange={(event) => setEditableText(event.target.value)}
          />
        </article>
      </section>

      <section className="review-section">
        <ReviewSectionHeader
          title="Diff"
          text={markdownBlock(
            "Diff",
            result.diff
              .map(
                (block) =>
                  `${block.operation}: ${block.originalText || block.transformedText}${block.reason ? ` (${block.reason})` : ""}`
              )
              .join("\n") || "No diff available."
          )}
          jsonPayload={stableJsonPayload("Diff", result.diff)}
          onCopy={copyReviewBlock}
        />
        <DiffView blocks={result.diff} />
      </section>

      <section className="review-grid">
        {workflow ? (
          <div className="saved-artifact">
            <WorkflowCard workflow={workflow} />
            <div className="saved-artifact__actions">
              <Button
                icon={<Clipboard size={15} />}
                disabled={isActionBusy}
                onClick={() => void copySavedWorkflow()}
              >
                Copy saved workflow
              </Button>
              <Button
                icon={<Download size={15} />}
                disabled={isActionBusy}
                onClick={() => downloadSavedWorkflow()}
              >
                Download JSON
              </Button>
            </div>
          </div>
        ) : null}
        {capsule ? (
          <div className="saved-artifact">
            <CapsuleCard capsule={capsule} />
            <div className="saved-artifact__actions">
              <Button
                icon={<Clipboard size={15} />}
                disabled={isActionBusy}
                onClick={() => void copySavedCapsule()}
              >
                Copy saved capsule
              </Button>
              <Button
                icon={<Download size={15} />}
                disabled={isActionBusy}
                onClick={() => downloadSavedCapsule()}
              >
                Download JSON
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <details className="review-section diagnostics-panel">
        <summary>Advanced Diagnostics</summary>
        <div className="diagnostics-actions">
          <Button
            icon={<Clipboard size={15} />}
            disabled={isActionBusy}
            onClick={() => void copyDiagnosticData()}
          >
            Copy Raw Diagnostic Data
          </Button>
          <Button
            icon={<Download size={15} />}
            disabled={isActionBusy}
            onClick={() => downloadDiagnosticJson()}
          >
            Export Diagnostic State
          </Button>
        </div>
        <div className="health-grid">
          <span>
            Continuity{" "}
            {sessionState?.monitors.continuityScore ??
              result.scores.constraintPreservationScore * 100}
            %
          </span>
          <span>Drift {sessionState?.monitors.driftScore ?? 0}%</span>
          <span>
            Novelty{" "}
            {sessionState?.monitors.noveltyLoad ?? result.continuityReview.newProvisional.length}
          </span>
          <span>
            Open{" "}
            {sessionState?.monitors.opennessScore ?? result.continuityReview.openUnresolved.length}
          </span>
          <span>
            Density{" "}
            {sessionState?.monitors.compressionDensity ?? result.scores.compactnessScore * 100}%
          </span>
          <span>Status {sessionState?.monitors.sessionHealth ?? "review"}</span>
        </div>
        <div className="review-grid continuity-grid diagnostics-grid">
          <ReviewListSection
            title="Conflict Report"
            variant="block"
            items={[
              ...(governance?.conflict_report.trusted_summary.map((item) => `Trusted: ${item}`) ??
                []),
              ...(governance?.conflict_report.untrusted_summary.map(
                (item) => `Untrusted: ${item}`
              ) ?? []),
              ...(governance?.conflict_report.warnings ?? [])
            ]}
            emptyText="No conflict report entries detected."
            metadata={governance?.conflict_report as Record<string, unknown> | undefined}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Metric Warnings"
            variant="block"
            items={review.diagnostics.metric_warnings ?? result.scores.warnings ?? []}
            emptyText="No metric warnings."
            metadata={{ scores: result.scores }}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Admission Filter"
            variant="block"
            items={
              governance?.canonical_items.map((item) => `${item.primary_bucket}: ${item.text}`) ??
              []
            }
            emptyText="No canonical admission items."
            metadata={
              governance ? { canonical_item_count: governance.canonical_items.length } : undefined
            }
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Provider Profile"
            variant="block"
            items={providerProfileLines}
            emptyText="No provider profile available."
            metadata={review.diagnostics.providerProfile as Record<string, unknown> | undefined}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Provider Health"
            variant="block"
            items={providerHealthLines}
            emptyText="No provider health available."
            metadata={review.diagnostics.providerHealth as Record<string, unknown> | undefined}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Last Transformation Result"
            variant="block"
            items={[
              `Mode: ${result.modeApplied ?? "none"}`,
              `Target model: ${result.targetModelApplied ?? "none"}`,
              `Diff blocks: ${result.diff.length}`,
              `Risk score: ${result.scores.riskScore}`
            ]}
            emptyText="No transformation result available."
            metadata={{
              explanation: result.explanation,
              diff_blocks: result.diff.length,
              scores: result.scores
            }}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Canonical Items"
            variant="block"
            items={
              governance?.canonical_items.map(
                (item) =>
                  `${item.primary_bucket} | ${item.decision ?? "n/a"} | ${item.source_role ?? item.source ?? "unknown"} | ${item.text}`
              ) ?? []
            }
            emptyText="No canonical items available."
            metadata={{ canonical_items: governance?.canonical_items ?? [] }}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Active Constraints"
            variant="block"
            items={result.extractedConstraints.map(
              (constraint) =>
                `${constraint.kind} | ${constraint.hard ? "hard" : "soft"} | ${constraint.confidence}: ${constraint.text}`
            )}
            emptyText="No active constraints detected."
            metadata={{ active_constraints: result.extractedConstraints }}
            onCopy={copyReviewBlock}
          />
          <ReviewListSection
            title="Raw Diagnostic Markdown"
            variant="block"
            items={rawDiagnosticMarkdown ? [rawDiagnosticMarkdown] : []}
            emptyText="No raw diagnostic markdown available."
            metadata={{ format: "markdown" }}
            onCopy={copyReviewBlock}
          />
        </div>
        <div className="diagnostics-json-block">
          <ReviewSectionHeader
            title="Raw JSON"
            text={rawDiagnosticJson || "No raw diagnostic JSON available."}
            jsonPayload={rawDiagnosticJson ? (JSON.parse(rawDiagnosticJson) as unknown) : {}}
            onCopy={copyReviewBlock}
          />
          <pre className="diagnostics-json">{rawDiagnosticJson}</pre>
        </div>
      </details>

      <p className="status-line">{status}</p>
    </main>
  );
}
