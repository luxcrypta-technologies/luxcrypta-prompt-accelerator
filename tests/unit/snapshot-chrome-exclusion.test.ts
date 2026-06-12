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

describe("snapshot excludes provider history sidebar (F1 objective-contamination fix)", () => {
  it("isNavChromeNode flags the history sidebar list", async () => {
    const { isNavChromeNode } = await import("@/surfaces/snapshot");
    document.body.innerHTML = `
      <aside class="sidebar">
        <div>Today</div>
        <a>Solar Microgrid Design for Cedar Hollow</a>
        <a>Five Day Hot Yoga Plan</a>
        <a>Japan Trip Planning Assistance</a>
      </aside>
      <main>
        <div class="ds-markdown-paragraph">design a community solar microgrid for Cedar Hollow</div>
      </main>
    `;
    expect(isNavChromeNode(document.querySelector("aside a"))).toBe(true);
    expect(isNavChromeNode(document.querySelector("main .ds-markdown-paragraph"))).toBe(false);
  });

  it("looksLikeSidebarList catches the concatenated day-grouped history string", async () => {
    const { looksLikeSidebarList } = await import("@/surfaces/snapshot");
    // The exact contamination shape observed in the 250-prompt eval capsule.
    expect(
      looksLikeSidebarList(
        "TodaySolar Microgrid Design for Cedar HollowFive Day Hot Yoga Plan5 Day Pilates Routine"
      )
    ).toBe(true);
    expect(looksLikeSidebarList("design a community solar microgrid for Cedar Hollow")).toBe(false);
  });

  it("buildSnapshotFromNodes drops the sidebar and keeps the real conversation turn", () => {
    document.body.innerHTML = `
      <aside class="sidebar">
        <a>Solar Microgrid Design for Cedar Hollow</a>
        <a>Five Day Hot Yoga Plan</a>
        <a>Japan Trip Planning Assistance</a>
      </aside>
      <main>
        <div class="ds-markdown-paragraph">Lock a hard constraint: budget ceiling is $4.2M in 2026 USD.</div>
      </main>
    `;
    const nodes = Array.from(document.querySelectorAll("aside a, main .ds-markdown-paragraph"));
    const snap = buildSnapshotFromNodes(nodes);
    const joined = snap?.turns.map((t) => t.text).join(" ") ?? "";
    expect(joined).toContain("$4.2M");
    expect(joined).not.toContain("Hot Yoga");
    expect(joined).not.toContain("Japan Trip");
  });

  it("deepseek adapter snapshot does not capture the sidebar as a turn", async () => {
    const { deepseekSurface } = await import("@/surfaces/deepseek.provider");
    document.body.innerHTML = `
      <aside class="sidebar">
        <div>Today</div>
        <a>Solar Microgrid Design for Cedar Hollow</a>
        <a>Five Day Hot Yoga Plan</a>
        <a>Japan Trip Planning Assistance</a>
      </aside>
      <main>
        <div class="ds-markdown-paragraph">design a community solar microgrid; budget $4.2M; 72-hour islanding</div>
        <textarea data-testid="chat-input"></textarea>
      </main>
    `;
    const snap = deepseekSurface.getConversationSnapshot?.();
    const joined = snap?.turns.map((t) => t.text).join(" ") ?? "";
    expect(joined).toContain("solar microgrid");
    expect(joined).not.toContain("Hot Yoga");
    expect(joined).not.toContain("Japan Trip");
  });
});
