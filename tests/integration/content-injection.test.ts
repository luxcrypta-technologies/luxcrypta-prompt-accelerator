import { describe, expect, it, vi } from "vitest";
import { createToolbarElement } from "@/content/toolbar-entry";

describe("content toolbar", () => {
  it("wires primary actions", () => {
    const onCompress = vi.fn();
    const toolbar = createToolbarElement({
      onCompress,
      onFocus: vi.fn(),
      onContinue: vi.fn(),
      onSaveWorkflow: vi.fn()
    });
    toolbar.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onCompress).toHaveBeenCalledOnce();
  });
});
