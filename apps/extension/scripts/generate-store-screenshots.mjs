import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const workDir = resolve(repoRoot, "output/playwright/store-screenshots");
const commonOutputDir = resolve(repoRoot, "store-assets/screenshots");
const chromeOutputDir = resolve(repoRoot, "store-assets/chrome/screenshots");
const firefoxOutputDir = resolve(repoRoot, "store-assets/firefox/screenshots");

const width = 1280;
const height = 800;

const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

const chromeBin = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chromeBin) {
  throw new Error(
    "Could not find Chrome or Chromium. Set CHROME_BIN to a headless-capable browser path."
  );
}

for (const directory of [workDir, commonOutputDir, chromeOutputDir, firefoxOutputDir]) {
  mkdirSync(directory, { recursive: true });
}

function html(body, title) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      color-scheme: light;
      --ink: #102123;
      --muted: #4f6066;
      --page: #f5f2eb;
      --panel: #fffefd;
      --line: #ccd5d6;
      --line-strong: #aebbbc;
      --brand: #101f21;
      --gold: #d7a63f;
      --gold-soft: #f0d58d;
      --teal: #4ba59c;
      --green: #317a5b;
      --blue: #6174d8;
      --soft-blue: #eef2ff;
      --soft-green: #edf8f3;
      --soft-gold: #fff7df;
    }
    body {
      width: ${width}px;
      height: ${height}px;
      margin: 0;
      overflow: hidden;
      background: var(--page);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    .canvas {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0)),
        var(--page);
    }
    .topbar {
      height: 86px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 48px;
      background: var(--brand);
      color: white;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      font-weight: 800;
      font-size: 24px;
    }
    .brand-mark {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 2px solid var(--gold);
      border-radius: 10px;
      color: var(--gold-soft);
      font-weight: 900;
      font-size: 19px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    }
    .topbar-note {
      color: #d6dedf;
      font-size: 14px;
      font-weight: 650;
    }
    .stage {
      height: 714px;
      padding: 36px 48px 40px;
    }
    .hero-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 34px;
      align-items: start;
    }
    .eyebrow {
      margin: 0 0 6px;
      color: #25736c;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.1;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 15px;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.45;
    }
    .lede {
      max-width: 660px;
      margin-top: 10px;
      color: #405158;
      font-size: 20px;
      line-height: 1.38;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 1px 0 rgba(16, 33, 35, 0.04);
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 18px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 0 18px;
      border-radius: 999px;
      background: var(--teal);
      color: white;
      font-size: 14px;
      font-weight: 750;
      white-space: nowrap;
    }
    .pill.gold { background: #d4aa4b; }
    .pill.green { background: var(--green); }
    .pill.blue { background: var(--blue); }
    .pill.dark { background: var(--brand); }
    .muted-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #f8faf9;
      color: #3d5056;
      font-size: 13px;
      font-weight: 700;
    }
    .button {
      display: inline-flex;
      min-height: 38px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid #1d4ed8;
      border-radius: 7px;
      padding: 0 16px;
      background: #1d4ed8;
      color: white;
      font-size: 14px;
      font-weight: 800;
      white-space: nowrap;
    }
    .button.secondary {
      border-color: #cbd5e1;
      background: white;
      color: var(--ink);
    }
    .button.dark {
      border-color: var(--brand);
      background: var(--brand);
    }
    .mini-label {
      color: #607178;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .browser-shell {
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: white;
      overflow: hidden;
    }
    .browser-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 42px;
      padding: 0 14px;
      border-bottom: 1px solid #e4eaea;
      background: #f9fbfb;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #d2d9da;
    }
    .address {
      flex: 1;
      height: 24px;
      display: flex;
      align-items: center;
      border-radius: 999px;
      background: #edf2f2;
      padding: 0 14px;
      color: #64737a;
      font-size: 12px;
      font-weight: 650;
    }
    .chat-page {
      height: 430px;
      padding: 24px 34px;
      background: linear-gradient(180deg, #ffffff, #f8faf9);
    }
    .chat-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 26px;
    }
    .message {
      max-width: 620px;
      border: 1px solid #dae3e4;
      border-radius: 8px;
      padding: 16px 18px;
      background: #f6f8f8;
      color: #17282b;
      font-size: 16px;
      line-height: 1.45;
    }
    .message.assistant {
      margin-left: auto;
      background: #ffffff;
    }
    .composer {
      margin: 26px auto 0;
      max-width: 760px;
    }
    .composer-box {
      min-height: 88px;
      border: 1px solid #c9d3d4;
      border-radius: 8px;
      background: #fbfcfc;
      padding: 18px 20px;
      color: #162629;
      font-size: 17px;
      line-height: 1.45;
    }
    .toolbar {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      border: 1px solid rgba(16, 33, 35, 0.14);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.98);
      padding: 7px;
      box-shadow: 0 8px 24px rgba(16, 33, 35, 0.12);
    }
    .toolbar span {
      padding: 0 6px;
      color: #4d5d63;
      font-size: 12px;
      font-weight: 800;
    }
    .toolbar button {
      min-height: 30px;
      border: 1px solid #1d4ed8;
      border-radius: 6px;
      background: #1d4ed8;
      color: white;
      padding: 0 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 800;
    }
    .popup-demo {
      width: 386px;
      padding: 18px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: #f8fafc;
    }
    .popup-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }
    .popup-header h2 {
      margin: 2px 0 0;
      font-size: 22px;
    }
    .draft-box,
    .runtime-row,
    .status-box {
      margin-top: 14px;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: white;
      padding: 12px;
    }
    .draft-box p {
      color: #2f3f46;
      font-size: 13px;
      line-height: 1.45;
    }
    .runtime-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .runtime-row strong {
      color: #475569;
      font-size: 12px;
    }
    .status-box {
      color: #475569;
      font-size: 12px;
    }
    .review-window {
      margin-top: 24px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f8fafc;
    }
    .review-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
    }
    .score-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-width: 330px;
      justify-content: flex-end;
    }
    .score-badges span {
      border-radius: 999px;
      background: #eef2ff;
      color: #3730a3;
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 800;
    }
    .action-bar {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }
    .continuity-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    .continuity-grid .card {
      min-height: 152px;
      padding: 15px;
    }
    ul.clean {
      margin: 0;
      padding-left: 18px;
      color: #42535a;
      font-size: 13px;
      line-height: 1.45;
    }
    .split-pane {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .codebox {
      min-height: 130px;
      border: 1px solid #e0e7e8;
      border-radius: 7px;
      background: #f8fafc;
      padding: 12px;
      color: #253840;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      white-space: pre-wrap;
    }
    .governance-board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      margin-top: 34px;
    }
    .governance-board .card {
      min-height: 330px;
      padding: 28px 26px;
    }
    .metric-strip {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      margin: 34px auto 0;
      max-width: 1050px;
      border-radius: 8px;
      background: var(--brand);
      padding: 13px;
      color: white;
    }
    .metric {
      border-right: 1px solid rgba(255, 255, 255, 0.18);
      padding: 2px 12px;
    }
    .metric:last-child { border-right: 0; }
    .metric strong {
      display: block;
      color: white;
      font-size: 20px;
      line-height: 1.1;
    }
    .metric span {
      color: #d2dcde;
      font-size: 12px;
      font-weight: 700;
    }
    .options-layout {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 24px;
      margin-top: 24px;
    }
    .settings-list {
      display: grid;
      gap: 12px;
    }
    .setting-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 12px;
      background: #fbfcfc;
    }
    .checkbox {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 2px solid #1d4ed8;
      background: #1d4ed8;
      color: white;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 900;
    }
    .toggle {
      width: 54px;
      height: 28px;
      padding: 4px;
      border-radius: 999px;
      background: var(--teal);
    }
    .toggle.off { background: #bdc5c7; }
    .knob {
      width: 20px;
      height: 20px;
      margin-left: auto;
      border-radius: 50%;
      background: white;
    }
    .toggle.off .knob { margin-left: 0; }
    .surface-list {
      display: grid;
      gap: 10px;
    }
    .surface-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #eef2f2;
      padding-bottom: 10px;
    }
    .surface-row:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .surface-row strong {
      color: var(--ink);
      font-size: 14px;
    }
    .surface-row span {
      color: #5e6f75;
      font-size: 12px;
    }
    .toolbar-showcase {
      display: grid;
      grid-template-columns: 0.9fr 1.2fr;
      gap: 28px;
      margin-top: 30px;
      align-items: start;
    }
    .support-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 18px;
    }
    .support-grid .card {
      min-height: 92px;
      padding: 16px;
    }
    .gold-line {
      width: 92px;
      height: 3px;
      margin-top: 16px;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--gold), rgba(215, 166, 63, 0));
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="topbar">
      <div class="brand"><div class="brand-mark">PA</div><span>LuxCrypta Prompt Accelerator</span></div>
      <div class="topbar-note">Chrome and Firefox store screenshots</div>
    </div>
    <main class="stage">${body}</main>
  </div>
</body>
</html>`;
}

const scenes = [
  {
    name: "popup-1280x800",
    title: "Popup Actions",
    body: `
      <div class="hero-row">
        <section>
          <p class="eyebrow">Supported chat draft</p>
          <h1>One quiet control for better prompts</h1>
          <p class="lede">Prompt Accelerator stays local, detects the active chat draft, and opens a continuity review before anything changes.</p>
          <div class="gold-line"></div>
          <div class="browser-shell" style="margin-top: 28px; width: 722px;">
            <div class="browser-bar">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              <div class="address">chat.openai.com</div>
            </div>
            <div class="chat-page" style="height: 342px;">
              <div class="message assistant">What are we improving today?</div>
              <div class="composer">
                <div class="composer-box">Objective: turn this rough launch plan into a clear store submission checklist. Must keep privacy and portability claims precise.</div>
                <div style="display: flex; justify-content: flex-end;">
                  <div class="toolbar"><span>Powered by LuxCrypta</span><button>Advanced</button></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <aside class="popup-demo">
          <div class="popup-header">
            <div>
              <p class="eyebrow">ChatGPT</p>
              <h2>Prompt Accelerator</h2>
            </div>
            <span class="button secondary" style="min-height: 30px; padding: 0 10px; font-size: 13px;">Refresh</span>
          </div>
          <div class="draft-box">
            <div class="mini-label" style="margin-bottom: 7px;">Current draft</div>
            <p>Objective: turn this rough launch plan into a clear store submission checklist. Must keep privacy and portability claims precise.</p>
          </div>
          <div class="runtime-row">
            <strong>Powered by LuxCrypta</strong>
            <span class="button">Advanced</span>
          </div>
          <div class="status-box">Ready to open continuity review.</div>
        </aside>
      </div>`
  },
  {
    name: "review-1280x800",
    title: "Continuity Review",
    body: `
      <section>
        <p class="eyebrow">Review before apply</p>
        <h1>Continuity Review</h1>
        <p class="lede">Inspect the clean summary, active objective, preserved constraints, and transformed draft before applying it back to the chat surface.</p>
      </section>
      <section class="review-window">
        <div class="review-head">
          <div>
            <p class="eyebrow">Powered by LuxCrypta</p>
            <h2 style="font-size: 23px;">Continuity Review</h2>
          </div>
          <div class="score-badges"><span>Preservation 100</span><span>Clarity 92</span><span>Compactness 86</span></div>
        </div>
        <div class="action-bar">
          <span class="button">Apply</span>
          <span class="button secondary">Copy</span>
          <span class="button secondary">Save Workflow</span>
          <span class="button secondary">Save Capsule</span>
        </div>
        <div class="summary-grid">
          <article class="card">
            <h3>Clean Summary</h3>
            <p>Prepare a store submission plan that preserves privacy claims, supported surfaces, and manual portability language.</p>
          </article>
          <article class="card">
            <h3>Active Objective</h3>
            <p>Turn a rough launch plan into a concise checklist for Chrome and Firefox publication.</p>
          </article>
        </div>
        <div class="continuity-grid">
          <article class="card">
            <span class="pill green">Stable Core</span>
            <ul class="clean" style="margin-top: 15px;"><li>Keep local-first wording</li><li>Preserve privacy constraints</li><li>Review before apply</li></ul>
          </article>
          <article class="card">
            <span class="pill gold">New / Provisional</span>
            <ul class="clean" style="margin-top: 15px;"><li>Add Firefox asset pass</li><li>Refresh store screenshots</li><li>Confirm supported surfaces</li></ul>
          </article>
          <article class="card">
            <span class="pill blue">Open / Unresolved</span>
            <ul class="clean" style="margin-top: 15px;"><li>Release timing</li><li>AMO review notes</li><li>Store copy final pass</li></ul>
          </article>
          <article class="card">
            <span class="pill dark">What Changed</span>
            <ul class="clean" style="margin-top: 15px;"><li>Focused checklist</li><li>Removed repetition</li><li>Kept constraints visible</li></ul>
          </article>
        </div>
        <article class="card" style="margin-top: 12px;">
          <h3>Recommended Next Actions</h3>
          <p>Verify store assets, copy the continuity export, then apply the transformed checklist back to the active chat draft.</p>
        </article>
      </section>`
  },
  {
    name: "session-governance-1280x800",
    title: "Session Governance",
    body: `
      <section>
        <p class="eyebrow">Long-session memory</p>
        <h1>Session governance keeps context honest</h1>
        <p class="lede">Stable core, new items, open questions, and drift monitors stay visible as a session grows.</p>
      </section>
      <div class="governance-board">
        <article class="card">
          <span class="pill green">Stable Core</span>
          <ul class="clean" style="margin-top: 28px; font-size: 15px;">
            <li>Objective: prepare launch assets</li>
            <li>Decision: keep local-first claims exact</li>
            <li>Constraint: review before apply</li>
            <li>Supported surfaces stay explicit</li>
          </ul>
        </article>
        <article class="card">
          <span class="pill gold">New / Provisional</span>
          <ul class="clean" style="margin-top: 28px; font-size: 15px;">
            <li>Chrome screenshots refreshed</li>
            <li>Firefox listing uses 1.6:1 assets</li>
            <li>Grok surface added to support list</li>
            <li>Manual portability copy updated</li>
          </ul>
        </article>
        <article class="card">
          <span class="pill blue">Open / Unresolved</span>
          <ul class="clean" style="margin-top: 28px; font-size: 15px;">
            <li>Final release date</li>
            <li>AMO reviewer notes</li>
            <li>Store descriptions per locale</li>
            <li>Post-submit QA owner</li>
          </ul>
        </article>
      </div>
      <div class="metric-strip">
        <div class="metric"><strong>96</strong><span>Continuity</span></div>
        <div class="metric"><strong>Low</strong><span>Drift</span></div>
        <div class="metric"><strong>4</strong><span>Novel items</span></div>
        <div class="metric"><strong>3</strong><span>Open items</span></div>
        <div class="metric"><strong>Strong</strong><span>Density</span></div>
        <div class="metric"><strong>Healthy</strong><span>Status</span></div>
      </div>`
  },
  {
    name: "options-1280x800",
    title: "Local-First Options",
    body: `
      <section>
        <p class="eyebrow">Local settings</p>
        <h1>Local-first controls stay under user control</h1>
        <p class="lede">Preferences, session governance, supported surfaces, and manual export/import live in the extension options page.</p>
      </section>
      <div class="options-layout">
        <article class="card">
          <h2>Preferences</h2>
          <div class="settings-list">
            <div class="setting-row"><span class="checkbox">✓</span><strong>Show diff review</strong><span class="toggle"><span class="knob"></span></span></div>
            <div class="setting-row"><span class="checkbox">✓</span><strong>Show toolbar on supported chat pages</strong><span class="toggle"><span class="knob"></span></span></div>
            <div class="setting-row"><span class="checkbox">✓</span><strong>Save local action history</strong><span class="toggle"><span class="knob"></span></span></div>
            <div class="setting-row"><span class="checkbox">✓</span><strong>Enable session governance</strong><span class="toggle"><span class="knob"></span></span></div>
            <div class="setting-row"><span class="checkbox">✓</span><strong>Preserve open questions</strong><span class="toggle"><span class="knob"></span></span></div>
            <div class="setting-row"><span class="checkbox">✓</span><strong>Show advanced diagnostics</strong><span class="toggle off"><span class="knob"></span></span></div>
          </div>
        </article>
        <div style="display: grid; gap: 18px;">
          <article class="card">
            <h2>Supported surfaces</h2>
            <div class="surface-list">
              <div class="surface-row"><strong>ChatGPT</strong><span>chat.openai.com</span></div>
              <div class="surface-row"><strong>Claude</strong><span>claude.ai</span></div>
              <div class="surface-row"><strong>Gemini</strong><span>gemini.google.com</span></div>
              <div class="surface-row"><strong>Grok</strong><span>grok.com</span></div>
              <div class="surface-row"><strong>DeepSeek</strong><span>chat.deepseek.com</span></div>
              <div class="surface-row"><strong>Perplexity</strong><span>perplexity.ai</span></div>
            </div>
          </article>
          <article class="card">
            <h2>Manual portability</h2>
            <p>Export and import workflows, capsules, preferences, and session state as a local JSON bundle.</p>
            <div class="action-bar">
              <span class="button secondary">Export Bundle</span>
              <span class="button secondary">Import Bundle</span>
            </div>
          </article>
        </div>
      </div>`
  },
  {
    name: "supported-toolbar-1280x800",
    title: "Supported Chat Toolbar",
    body: `
      <section>
        <p class="eyebrow">Contextual toolbar</p>
        <h1>Prompt actions appear only on supported chat surfaces</h1>
        <p class="lede">The toolbar stays close to the active draft and opens the same continuity review from ChatGPT, Claude, Gemini, Grok, DeepSeek, and Perplexity.</p>
      </section>
      <div class="toolbar-showcase">
        <aside>
          <h2>Supported today</h2>
          <div class="support-grid">
            <article class="card"><span class="pill green">ChatGPT</span><p style="margin-top: 10px;">Draft detection and apply-back support.</p></article>
            <article class="card"><span class="pill">Claude</span><p style="margin-top: 10px;">Prompt review near the composer.</p></article>
            <article class="card"><span class="pill gold">Gemini</span><p style="margin-top: 10px;">Local continuity workflow reuse.</p></article>
            <article class="card"><span class="pill blue">Grok</span><p style="margin-top: 10px;">Surface-aware prompt formatting.</p></article>
            <article class="card"><span class="pill green">DeepSeek</span><p style="margin-top: 10px;">Structured reasoning continuity checks.</p></article>
            <article class="card"><span class="pill gold">Perplexity</span><p style="margin-top: 10px;">Retrieval-governed continuity checks.</p></article>
          </div>
        </aside>
        <section class="browser-shell">
          <div class="browser-bar">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <div class="address">grok.com</div>
          </div>
          <div class="chat-page">
            <div class="chat-title">
              <h2>Supported AI chat page</h2>
              <span class="muted-pill">Active draft detected</span>
            </div>
            <div class="message">Can you turn this release checklist into a reviewer-friendly submission note?</div>
            <div class="message assistant">Paste the rough checklist and I will tighten it.</div>
            <div class="composer">
              <div class="composer-box">Objective: prepare Chrome and Firefox release notes. Must preserve local-first privacy language and list supported surfaces.</div>
              <div style="display: flex; justify-content: flex-end;">
                <div class="toolbar"><span>Powered by LuxCrypta</span><button>Advanced</button></div>
              </div>
            </div>
          </div>
        </section>
      </div>`
  }
];

function pngSize(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a PNG file.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

for (const scene of scenes) {
  const htmlPath = resolve(workDir, `${scene.name}.html`);
  const outputPath = resolve(commonOutputDir, `${scene.name}.png`);
  writeFileSync(htmlPath, html(scene.body, scene.title));

  const result = spawnSync(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(htmlPath).href
    ],
    { encoding: "utf8", timeout: 30_000 }
  );

  if (result.status !== 0) {
    throw new Error(
      `Chrome failed while rendering ${scene.name}.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`
    );
  }

  const size = pngSize(outputPath);
  if (size.width !== width || size.height !== height) {
    throw new Error(
      `${scene.name} rendered at ${size.width}x${size.height}; expected ${width}x${height}.`
    );
  }

  copyFileSync(outputPath, resolve(chromeOutputDir, `${scene.name}.png`));
  copyFileSync(outputPath, resolve(firefoxOutputDir, `${scene.name}.png`));
}

console.log("Generated store screenshots:");
for (const scene of scenes) {
  console.log(`- store-assets/screenshots/${scene.name}.png`);
  console.log(`  store-assets/chrome/screenshots/${scene.name}.png`);
  console.log(`  store-assets/firefox/screenshots/${scene.name}.png`);
}
