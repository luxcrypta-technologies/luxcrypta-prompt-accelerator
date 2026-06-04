import { describe, expect, it } from "vitest";
import { buildSnapshotFromNodes, isExtensionOwnNode } from "@/surfaces/snapshot";

describe("snapshot excludes the extension's own UI (chrome-token contamination fix)", () => {
  it("isExtensionOwnNode flags toolbar/review nodes", () => {
    document.body.innerHTML = `
      <div id="luxcrypta-toolbar"><button>Copy JSON</button></div>
      <div id="lcpa-toolbar-root"><span>Prompt Review</span></div>
      <div class="lcpa-toolbar-root"><span>Advanced</span></div>
      <article data-message-author-role="user">real user turn</article>
    `;
    expect(isExtensionOwnNode(document.getElementById("luxcrypta-toolbar"))).toBe(true);
    expect(isExtensionOwnNode(document.getElementById("lcpa-toolbar-root"))).toBe(true);
    expect(isExtensionOwnNode(document.querySelector("article"))).toBe(false);
  });

  it("buildSnapshotFromNodes drops extension UI nodes and keeps real turns", () => {
    document.body.innerHTML = `
      <div id="luxcrypta-toolbar"><button>Copy JSON</button><button>Prompt Review</button></div>
      <article data-message-author-role="user">help me build a trading agent</article>
      <article data-message-author-role="assistant">here is a plan</article>
    `;
    const nodes = Array.from(
      document.querySelectorAll("#luxcrypta-toolbar, article")
    );
    const snap = buildSnapshotFromNodes(nodes);
    const joined = snap?.turns.map((t) => t.text).join(" ") ?? "";
    expect(joined).toContain("trading agent");
    expect(joined).not.toContain("Copy JSON");
    expect(joined).not.toContain("Prompt Review");
  });
});
