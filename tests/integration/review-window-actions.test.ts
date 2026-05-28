import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { transformPrompt } from "@luxcrypta/continuity-core/pipeline";
import type { TransformResult } from "@luxcrypta/continuity-types/prompts";
import { App } from "@/review/App";

const platformMock = vi.hoisted(() => ({
  sendMessage: vi.fn()
}));

vi.mock("@platform-runtime", () => ({
  getPlatformAPI: () => ({
    messaging: {
      sendMessage: platformMock.sendMessage,
      onMessage: vi.fn()
    }
  })
}));

function reviewResult(): TransformResult {
  return transformPrompt({
    sourceText:
      "Objective: tighten the Prompt Accelerator launch plan. Must keep toolbar actions visible. Open question: where do saved capsules appear?"
  });
}

function mockReviewMessages(result: TransformResult) {
  platformMock.sendMessage.mockImplementation(async (message: { type: string; payload?: Record<string, unknown> }) => {
    if (message.type === "review:get") {
      return {
        id: "review_test",
        result,
        surface: "review_tab",
        createdAt: "2026-05-19T00:00:00.000Z",
        sourceTabId: 7
      };
    }
    if (message.type === "review:update") {
      return {
        id: "review_test",
        result: (message.payload as { result: TransformResult }).result,
        surface: "review_tab",
        createdAt: "2026-05-19T00:00:00.000Z",
        sourceTabId: 7
      };
    }
    if (message.type === "review:rendered") {
      return {
        reviewId: "review_test",
        visibleToUser: true,
        openStatus: "open_success",
        providerHealth: result.continuityReview.diagnostics.providerHealth,
        result
      };
    }
    if (message.type === "session:get" || message.type === "session:update") return null;
    if (message.type === "content:draft:apply") {
      const payload = message.payload as { text: string; targetTabId?: number };
      return { applied: true, text: payload.text, surfaceId: "chatgpt" };
    }
    if (message.type === "workflow:save") {
      const payload = message.payload as { workflow: Record<string, unknown> };
      return {
        ...payload.workflow,
        id: "workflow_test",
        createdAt: "2026-05-19T00:00:00.000Z",
        updatedAt: "2026-05-19T00:00:00.000Z"
      };
    }
    if (message.type === "capsule:save") {
      const payload = message.payload as { capsule: Record<string, unknown> };
      return {
        capsule_version: 1,
        ...payload.capsule,
        id: "capsule_test",
        created_at: "2026-05-19T00:00:00.000Z",
        updated_at: "2026-05-19T00:00:00.000Z"
      };
    }
    throw new Error(`Unexpected message: ${message.type}`);
  });
}

describe("review window toolbar actions", () => {
  beforeEach(() => {
    platformMock.sendMessage.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("applies edited transformed text and shows visible success", async () => {
    const result = reviewResult();
    mockReviewMessages(result);
    render(React.createElement(App));

    const textarea = await screen.findByLabelText("Transformed continuity draft");
    fireEvent.change(textarea, { target: { value: "Updated transformed continuity prompt." } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(screen.getAllByText("Applied to draft").length).toBeGreaterThan(0));
    expect(platformMock.sendMessage).toHaveBeenCalledWith({
      type: "content:draft:apply",
      payload: { text: "Updated transformed continuity prompt.", targetTabId: 7 }
    });
  });

  it("copies a structured continuity export and confirms it", async () => {
    const result = reviewResult();
    mockReviewMessages(result);
    render(React.createElement(App));

    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));

    await waitFor(() => expect(screen.getAllByText("Copied continuity review").length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Continuity Review"));
    });
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copied).toContain("Active Objective");
    expect(copied).toContain("Stable Core");
    expect(copied).toContain("Open / Unresolved");
    expect(copied).not.toContain("pipelineSteps");
  });

  it("shows concrete workflow and capsule save confirmations", async () => {
    const result = reviewResult();
    mockReviewMessages(result);
    render(React.createElement(App));

    fireEvent.click(await screen.findByRole("button", { name: "Save Workflow" }));
    await waitFor(() => expect(screen.getAllByText(/Workflow saved:/).length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("\"workflow_id\""));
    });
    expect(platformMock.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "workflow:save",
        payload: expect.objectContaining({
          workflow: expect.objectContaining({
            objective: expect.stringContaining("Prompt Accelerator")
          })
        })
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Capsule" }));
    await waitFor(() => expect(screen.getAllByText(/Capsule saved:/).length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("\"capsule_id\""));
    });
    expect(platformMock.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "capsule:save",
        payload: expect.objectContaining({
          capsule: expect.objectContaining({
            open_questions: expect.arrayContaining([expect.stringContaining("saved capsules")])
          })
        })
      })
    );
  });

  it("copies raw diagnostic data from Advanced Diagnostics", async () => {
    const result = reviewResult();
    mockReviewMessages(result);
    render(React.createElement(App));

    fireEvent.click(await screen.findByText("Advanced Diagnostics"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Raw Diagnostic Data" }));

    await waitFor(() => expect(screen.getAllByText("Raw diagnostic data copied").length).toBeGreaterThan(0));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("# LuxCrypta Diagnostic State")
      );
    });
  });

  it("exposes top-level export copy actions and section-level text/json copy controls", async () => {
    const result = reviewResult();
    mockReviewMessages(result);
    render(React.createElement(App));

    expect(await screen.findByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Review + Raw JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Engineering Summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Portable Capsule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Workflow Export" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Copy Active Objective" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Stable Core" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Scores" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Warnings as JSON" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy Active Objective as JSON" }));
    await waitFor(() => expect(screen.getAllByText("Copied Active Objective JSON").length).toBeGreaterThan(0));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("\"title\": \"Active Objective\"")
    );
  });

  it("renders handoff readiness from final artifact truth instead of raw optimistic review state", async () => {
    const invalid = transformPrompt({
      sourceText: "user:",
      sourceSurface: "chatgpt"
    });
    const result: TransformResult = {
      ...invalid,
      continuityReview: {
        ...invalid.continuityReview,
        diagnostics: {
          ...invalid.continuityReview.diagnostics,
          export_readiness_decision: "SAFE_FOR_HANDOFF" as const,
          readiness_blockers: []
        }
      }
    };
    mockReviewMessages(result);
    render(React.createElement(App));

    expect(await screen.findByText("UNSAFE_FOR_HANDOFF")).toBeInTheDocument();
    expect(screen.getByText("Blocker: invalid_objective")).toBeInTheDocument();
    expect(screen.getAllByText("invalid_objective").length).toBeGreaterThan(0);
  });

  it("executes review and artifact copy actions even when handoff readiness is unsafe", async () => {
    const base = reviewResult();
    const result: TransformResult = {
      ...base,
      continuityReview: {
        ...base.continuityReview,
        diagnostics: {
          ...base.continuityReview.diagnostics,
          export_readiness_decision: "UNSAFE_FOR_HANDOFF" as const,
          readiness_blockers: ["review-open was not visibly confirmed"],
          providerHealth: {
            provider: "chatgpt",
            surface_detected: true,
            input_detected: true,
            toolbar_mounted: true,
            draft_read_success: true,
            writeback_success: false,
            review_open_attempted: true,
            review_open_status: "surface_created" as const,
            visible_to_user: false,
            duplicate_guard_active: true,
            runtime_errors: []
          }
        }
      }
    };
    mockReviewMessages(result);
    render(React.createElement(App));

    const actions = [
      { name: "Copy", success: "Copied continuity review" },
      { name: "Copy Review + Raw JSON", success: "Copied review and raw JSON" },
      { name: "Copy Engineering Summary", success: "Copied engineering summary" },
      { name: "Copy Portable Capsule", success: "Copied portable capsule" },
      { name: "Copy Workflow Export", success: "Copied workflow export" }
    ];

    for (const action of actions) {
      fireEvent.click(await screen.findByRole("button", { name: action.name }));
      await waitFor(() => expect(screen.getAllByText(action.success).length).toBeGreaterThan(0));
    }

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(actions.length);
  });
});
