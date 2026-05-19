import { describe, expect, it, vi } from "vitest";
import { createToolbarElement } from "@/content/toolbar-entry";

describe("content toolbar", () => {
  it("exposes only the always-on runtime label and Advanced action", () => {
    const onAdvanced = vi.fn();
    const toolbar = createToolbarElement({
      onAdvanced
    });
    toolbar.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAdvanced).toHaveBeenCalledOnce();
    expect(toolbar.textContent).toContain("Powered by LuxCrypta");
    expect(toolbar.textContent).toContain("Advanced");
    expect(toolbar.textContent).not.toContain("Compress");
    expect(toolbar.textContent).not.toContain("Focus");
  });
});
