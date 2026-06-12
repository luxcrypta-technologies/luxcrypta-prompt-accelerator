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
  it("isNavChromeNode flags an explicit navigation/history region (narrow selector)", async () => {
    const { isNavChromeNode } = await import("@/surfaces/snapshot");
    document.body.innerHTML = `
      <nav aria-label="Chat history">
        <a>Solar Microgrid Design for Cedar Hollow</a>
        <a>Five Day Hot Yoga Plan</a>
      </nav>
      <main>
        <div class="ds-markdown-paragraph">design a community solar microgrid for Cedar Hollow</div>
      </main>
    `;
    // Matches an explicit history landmark, but NOT real conversation content.
    expect(isNavChromeNode(document.querySelector("nav a"))).toBe(true);
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

  it("buildSnapshotFromNodes drops the concatenated sidebar string and keeps the real turn", () => {
    // The real F1 contamination is one concatenated day-grouped string; the
    // content guard (looksLikeSidebarList) is what removes it precisely.
    document.body.innerHTML = `
      <div role="navigation">
        <a>TodaySolar Microgrid Design for Cedar HollowFive Day Hot Yoga PlanJapan Trip</a>
      </div>
      <main>
        <div class="ds-markdown-paragraph">Lock a hard constraint: budget ceiling is $4.2M in 2026 USD.</div>
      </main>
    `;
    const nodes = Array.from(document.querySelectorAll("[role='navigation'] a, main .ds-markdown-paragraph"));
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

describe("nav-chrome filter must never empty a real snapshot (2.5.5/2.5.6 open regression)", () => {
  it("returns a snapshot even when conversation nodes sit inside an aside/history wrapper", () => {
    // Some providers wrap the live conversation in containers that the OLD broad
    // selector (aside, [class*='history']) wrongly matched, nulling the snapshot
    // and breaking the open path. The real conversation must still be captured.
    document.body.innerHTML = `
      <div class="chat-history-pane">
        <div class="message user">design a microgrid for Cedar Hollow</div>
        <div class="message assistant">Here is a first pass at the architecture.</div>
      </div>
    `;
    const nodes = Array.from(document.querySelectorAll(".message"));
    const snap = buildSnapshotFromNodes(nodes);
    expect(snap).not.toBeNull();
    const joined = snap?.turns.map((t) => t.text).join(" ") ?? "";
    expect(joined).toContain("microgrid");
  });

  it("still returns a snapshot when every node is inside a role=navigation region", () => {
    document.body.innerHTML = `
      <div role="navigation">
        <div class="message">continue building the spec sheet</div>
      </div>
    `;
    const nodes = Array.from(document.querySelectorAll(".message"));
    const snap = buildSnapshotFromNodes(nodes);
    // Safety valve: rather than null (which breaks open), fall back to raw nodes.
    expect(snap).not.toBeNull();
    expect(snap?.turns.map((t) => t.text).join(" ")).toContain("spec sheet");
  });
});
