import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("/tmp/luxcrypta-playwright-node/package.json");
const { chromium } = require("playwright");

const repoRoot = "/Users/lct/Desktop/luxcrypta-prompt-accelerator";
const runDir = path.join(repoRoot, "validation-evidence/2026-05-23-phase-3-surgical-hardening");
const extensionDir = path.join(repoRoot, "dist/chromium");
const promptDir = path.join(repoRoot, "validation-evidence/2026-05-22-live-brutal/chatgpt");
const defaultUserDataDir = "/tmp/luxcrypta-phase-1-live-chrome-profile";
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const userDataDir = process.env.LCPA_LIVE_USER_DATA_DIR || defaultUserDataDir;
const cdpEndpoint = process.env.LCPA_LIVE_CDP_ENDPOINT || "";
const executablePath =
  process.env.LCPA_LIVE_BROWSER === "brave" || !existsSync(chromePath) ? bravePath : chromePath;
const availabilityOnly = process.env.LCPA_LIVE_AVAILABILITY_ONLY === "1";
const providerFilter = new Set(
  (process.env.LCPA_LIVE_PROVIDERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
);
const maxPrompts = Number(process.env.LCPA_LIVE_MAX_PROMPTS ?? "4");
const responseTimeoutMs = Number(process.env.LCPA_LIVE_RESPONSE_TIMEOUT_MS ?? "180000");

const prompts = [1, 2, 3, 4]
  .slice(0, maxPrompts)
  .map((index) => ({
    index,
    text: readFileSync(path.join(promptDir, `prompt-${index}/prompt.txt`), "utf8")
  }));

const providers = [
  {
    id: "chatgpt",
    url: "https://chatgpt.com/",
    titleStrip: / - ChatGPT$/i,
    composerSelectors: [
      "#prompt-textarea",
      "[data-testid='prompt-textarea']",
      "textarea",
      "[contenteditable='true'][data-testid*='prompt' i]",
      "[contenteditable='true'][role='textbox']",
      "[contenteditable='true']"
    ],
    assistantSelectors: ["[data-message-author-role='assistant']", "article"]
  },
  {
    id: "claude",
    url: "https://claude.ai/new",
    titleStrip: /Claude/i,
    composerSelectors: [
      "div.ProseMirror[contenteditable='true']",
      "[contenteditable='true'][aria-label*='message' i]",
      "[contenteditable='true'][role='textbox']",
      "textarea",
      "[contenteditable='true']"
    ],
    assistantSelectors: ["[data-testid*='message' i]", "article", "[class*='message' i]"]
  },
  {
    id: "gemini",
    url: "https://gemini.google.com/app",
    titleStrip: /Google Gemini/i,
    composerSelectors: [
      "rich-textarea div[contenteditable='true']",
      "[contenteditable='true'][aria-label*='Enter a prompt' i]",
      "[contenteditable='true'][role='textbox']",
      "textarea",
      "[contenteditable='true']"
    ],
    assistantSelectors: ["model-response", ".response-content", "[data-test-id*='response' i]"]
  },
  {
    id: "grok",
    url: "https://grok.com/",
    titleStrip: /Grok/i,
    composerSelectors: [
      "div.ProseMirror[contenteditable='true']",
      "[contenteditable='true'][aria-label*='Grok' i]",
      "[contenteditable='true'][aria-label*='Ask' i]",
      "[contenteditable='true'][role='textbox']",
      "textarea[aria-label*='Grok' i]",
      "textarea[placeholder*='Ask' i]",
      "textarea",
      "[contenteditable='true']"
    ],
    assistantSelectors: ["[data-testid*='message' i]", "article", "[class*='message' i]"]
  },
  {
    id: "perplexity",
    url: "https://www.perplexity.ai/",
    titleStrip: /Perplexity/i,
    composerSelectors: [
      "[data-testid*='composer' i] textarea",
      "[data-testid*='ask' i] textarea",
      "textarea[placeholder*='ask' i]",
      "textarea[aria-label*='ask' i]",
      "[contenteditable='true'][role='textbox'][aria-label*='ask' i]",
      "[data-testid*='composer' i] [contenteditable='true']",
      "textarea",
      "[contenteditable='true']"
    ],
    assistantSelectors: ["[data-testid*='answer' i]", "[data-testid*='message' i]", "article"]
  },
  {
    id: "deepseek",
    url: "https://chat.deepseek.com/",
    titleStrip: /DeepSeek.*/i,
    composerSelectors: [
      "textarea[data-testid*='chat' i]",
      "textarea[data-testid*='input' i]",
      "textarea[placeholder*='message' i]",
      "textarea[placeholder*='ask' i]",
      "textarea[aria-label*='message' i]",
      "textarea[aria-label*='deepseek' i]",
      "[contenteditable='true'][role='textbox']",
      "div.ProseMirror[contenteditable='true']",
      "textarea",
      "[contenteditable='true']"
    ],
    assistantSelectors: ["[data-testid*='message' i]", "[class*='message' i]", "article"]
  }
].filter((provider) => !providerFilter.size || providerFilter.has(provider.id));

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function bodyText(page) {
  return await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

async function findComposer(page, provider) {
  return firstVisible(page, provider.composerSelectors);
}

async function fillComposer(page, provider, text) {
  const composer = await findComposer(page, provider);
  if (!composer) throw new Error(`No ${provider.id} composer found.`);
  await composer.click({ timeout: 20_000 });
  const tagName = await composer.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === "textarea" || tagName === "input") {
    await composer.fill(text);
    return;
  }
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(text);
}

async function clickSend(page) {
  const selectors = [
    "button[data-testid='send-button']",
    "button[aria-label*='Send' i]",
    "button[aria-label*='Submit' i]",
    "button[aria-label*='Arrow' i]",
    "button[type='submit']",
    "button:has(svg)"
  ];
  const button = await firstVisible(page, selectors);
  if (button && (await button.isEnabled().catch(() => false))) {
    await button.click();
    return "button";
  }
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
  return "keyboard";
}

async function assistantResponseText(page, provider) {
  return await page.evaluate((selectors) => {
    const texts = selectors
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .map((node) => node.innerText?.trim() ?? node.textContent?.trim() ?? "")
      .filter(Boolean)
      .filter((text) => !/^ChatGPT can make mistakes/i.test(text));
    return texts.at(-1) ?? "";
  }, provider.assistantSelectors);
}

async function waitForResponseDone(page, provider) {
  const start = Date.now();
  let last = "";
  let stableTicks = 0;
  let best = "";
  while (Date.now() - start < responseTimeoutMs) {
    const text = await assistantResponseText(page, provider).catch(() => "");
    if (text.length > best.length) best = text;
    const stopVisible =
      (await page
        .locator(
          "button[data-testid='stop-button'], button[aria-label*='Stop' i], button[aria-label*='Cancel' i]"
        )
        .count()
        .catch(() => 0)) > 0;
    if (text.length > 80 && text === last && !stopVisible) {
      stableTicks += 1;
    } else {
      stableTicks = 0;
    }
    if (stableTicks >= 4) {
      return { done: true, responseText: text, elapsedMs: Date.now() - start };
    }
    last = text;
    await wait(1500);
  }
  return { done: false, responseText: best, elapsedMs: Date.now() - start };
}

async function extensionWorker(context) {
  let worker = context
    .serviceWorkers()
    .find((candidate) => candidate.url().startsWith("chrome-extension://"));
  if (worker) return worker;
  worker = await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => null);
  if (worker?.url().startsWith("chrome-extension://")) return worker;
  return (
    context
      .serviceWorkers()
      .find((candidate) => candidate.url().startsWith("chrome-extension://")) ?? null
  );
}

async function extensionId(context) {
  const worker = await extensionWorker(context);
  if (!worker) return null;
  return new URL(worker.url()).host;
}

async function allReviewStates(context) {
  const worker = await extensionWorker(context);
  if (!worker) return {};
  return await worker.evaluate(async () => {
    const values = await chrome.storage.local.get(null);
    return Object.fromEntries(
      Object.entries(values).filter(([key]) => key.startsWith("review:"))
    );
  });
}

async function latestReviewState(context, beforeKeys = new Set()) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const states = await allReviewStates(context);
    const entries = Object.entries(states).filter(([key]) => !beforeKeys.has(key));
    const sorted = entries.sort(([, left], [, right]) =>
      String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""))
    );
    if (sorted[0]) return { key: sorted[0][0], state: sorted[0][1] };
    await wait(1000);
  }
  return null;
}

async function openReviewCapturePage(context, reviewId) {
  const idHost = await extensionId(context);
  if (!idHost) return null;
  const url = `chrome-extension://${idHost}/review.html?reviewId=${encodeURIComponent(reviewId)}`;
  let reviewPage = context
    .pages()
    .find((page) => page.url().includes(`/review.html?reviewId=${reviewId}`));
  if (!reviewPage) {
    reviewPage = await context.newPage();
    await reviewPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }
  await reviewPage.locator("text=Continuity Review").first().waitFor({ timeout: 30_000 }).catch(() => {});
  await reviewPage.waitForTimeout(1500);
  return reviewPage;
}

async function clickAdvanced(page) {
  const beforeText = await bodyText(page);
  const button = page.locator("#luxcrypta-toolbar .lcpa-toolbar__button").first();
  await button.waitFor({ state: "visible", timeout: 20_000 });
  await button.click();
  await page.waitForTimeout(1000);
  const afterText = await bodyText(page);
  return {
    clickDetected: true,
    toolbarBefore: beforeText.match(/Powered by LuxCrypta[\s\S]{0,120}/)?.[0] ?? "",
    toolbarAfter: afterText.match(/Powered by LuxCrypta[\s\S]{0,180}/)?.[0] ?? ""
  };
}

async function copyCheck(reviewPage, outDir) {
  await reviewPage.evaluate(() => {
    window.__lcpaCopied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__lcpaCopied.push(String(value));
        }
      }
    });
  });
  const labels = [
    "Copy All Review",
    "Copy Review + Raw JSON",
    "Copy Engineering Summary",
    "Copy Portable Capsule",
    "Copy Workflow Export"
  ];
  const results = [];
  for (const label of labels) {
    const button = reviewPage.locator("button").filter({ hasText: label }).first();
    const present = (await button.count().catch(() => 0)) > 0;
    let copiedLength = 0;
    let copiedPreview = "";
    if (present) {
      await button.click().catch(() => {});
      await reviewPage.waitForTimeout(250);
      const copied = await reviewPage.evaluate(() => window.__lcpaCopied?.at(-1) ?? "");
      copiedLength = copied.length;
      copiedPreview = copied.slice(0, 300);
      if (label === "Copy All Review") {
        writeFileSync(path.join(outDir, "copied-review-text.txt"), copied);
      }
      if (label === "Copy Review + Raw JSON") {
        writeFileSync(path.join(outDir, "copied-review-plus-raw-json.txt"), copied);
      }
    }
    results.push({ label, present, copiedLength, copiedPreview });
  }
  const sectionButtons = await reviewPage.locator(".section-copy-button").count().catch(() => 0);
  const sectionJsonButtons = await reviewPage
    .locator(".section-copy-button", { hasText: "JSON" })
    .count()
    .catch(() => 0);
  return { topLevel: results, sectionButtons, sectionJsonButtons };
}

async function checkReload(reviewPage) {
  const before = await bodyText(reviewPage);
  await reviewPage.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await reviewPage.locator("text=Continuity Review").first().waitFor({ timeout: 30_000 }).catch(() => {});
  await reviewPage.waitForTimeout(1000);
  const after = await bodyText(reviewPage);
  return {
    beforeChars: before.length,
    afterChars: after.length,
    changed: Math.abs(before.length - after.length) > Math.max(80, before.length * 0.08)
  };
}

function classifyAuth(providerId, text, url) {
  if (providerId === "chatgpt" && /Good to see you|Recents|Projects|Library|New chat/i.test(text)) {
    return /Log in|Sign up/i.test(text) && !/Good to see you|Recents|Projects/i.test(text)
      ? "logged_out_or_auth_required"
      : "authenticated";
  }
  if (providerId === "gemini" && /What's next|Gemini Apps activity/i.test(text) && !/Sign in/i.test(text)) {
    return "authenticated_or_session_available";
  }
  if (providerId === "deepseek" && /thom.{0,12}yahoo\.com|Today|Yesterday|Start chatting/i.test(text) && !/Human Verification/i.test(text)) {
    return "authenticated_or_session_available";
  }
  if (/log in|sign in|sign up|continue with google|continue with email/i.test(text)) {
    return "logged_out_or_auth_required";
  }
  if (/login|signin|auth/i.test(url)) return "logged_out_or_auth_required";
  return "unknown_or_anonymous";
}

function hasUiDebris(value) {
  return /\b(Show more|Show less|Copy JSON|Copy Raw|Prompt Review|Advanced|Try Pro)\b/i.test(
    value ?? ""
  );
}

function summarizeRun(providerId, promptIndex, reviewState, reviewText, reloadCheck, copy, files) {
  const result = reviewState?.result;
  const review = result?.continuityReview;
  const diagnostics = review?.diagnostics;
  const governance = diagnostics?.adversarialGovernance;
  const stableCore = review?.stableCore ?? [];
  const durable = [
    review?.activeObjective ?? "",
    ...stableCore,
    ...(review?.newProvisional ?? []),
    ...(review?.openUnresolved ?? []),
    ...(governance?.governance_principles ?? []),
    ...(governance?.invariants ?? []),
    ...(governance?.rejected_directions ?? [])
  ].join("\n");
  const stableAssistant = (governance?.canonical_items ?? []).filter(
    (item) => item.primary_bucket === "stable_core" && /assistant|model/i.test(item.source_role ?? "")
  );
  const durableUnknown = (governance?.canonical_items ?? []).filter(
    (item) =>
      item.source_role === "unknown" &&
      [
        "stable_core",
        "governance_principles",
        "invariants",
        "rejected_directions"
      ].includes(item.primary_bucket)
  );
  const checks = {
    bodyFirstExtraction: {
      pass: !hasUiDebris(durable),
      notes: hasUiDebris(durable) ? "Durable review text contains UI debris." : "No known UI debris in durable review buckets."
    },
    failClosedProvenance: {
      pass: durableUnknown.length === 0 && stableAssistant.length === 0,
      notes:
        durableUnknown.length || stableAssistant.length
          ? `Unknown durable: ${durableUnknown.length}; assistant stable: ${stableAssistant.length}.`
          : "No unknown durable or assistant Stable Core items detected."
    },
    durableBucketIntegrity: {
      pass:
        (governance?.governance_principles?.length ?? 0) > 0 &&
        (governance?.invariants?.length ?? 0) > 0 &&
        (governance?.rejected_directions?.length ?? 0) > 0 &&
        (review?.openUnresolved?.length ?? 0) > 0 &&
        (result?.scores?.bucketExclusivityScore ?? 0) >= 0.66,
      notes: `governance=${governance?.governance_principles?.length ?? 0}; invariants=${governance?.invariants?.length ?? 0}; rejected=${governance?.rejected_directions?.length ?? 0}; open=${review?.openUnresolved?.length ?? 0}; bucket=${result?.scores?.bucketExclusivityScore ?? "n/a"}`
    },
    scoringHonesty: {
      pass:
        Boolean(diagnostics?.metric_warnings?.length) &&
        (result?.scores?.exportReadiness ?? 1) < 0.95,
      notes: `warnings=${diagnostics?.metric_warnings?.length ?? 0}; exportReadiness=${result?.scores?.exportReadiness ?? "n/a"}`
    },
    promptReviewTruthfulness: {
      pass:
        diagnostics?.providerHealth?.visible_to_user === true &&
        /success/.test(String(diagnostics?.providerHealth?.review_open_status ?? "")) &&
        reloadCheck?.changed === false,
      notes: `status=${diagnostics?.providerHealth?.review_open_status ?? "n/a"}; visible=${diagnostics?.providerHealth?.visible_to_user ?? false}; reloadChanged=${reloadCheck?.changed ?? "n/a"}`
    },
    copyExportTruthfulness: {
      pass:
        (copy?.topLevel ?? []).filter((item) => item.present && item.copiedLength > 0).length >= 4 &&
        (copy?.sectionButtons ?? 0) > 0 &&
        !(existsSync(files.copiedReviewText) &&
          hasUiDebris(readFileSync(files.copiedReviewText, "utf8"))),
      notes: `topLevelCopied=${(copy?.topLevel ?? []).filter((item) => item.present && item.copiedLength > 0).length}; sectionButtons=${copy?.sectionButtons ?? 0}; sectionJsonButtons=${copy?.sectionJsonButtons ?? 0}`
    }
  };
  const pass = Object.values(checks).every((check) => check.pass);
  return {
    provider: providerId,
    prompt: promptIndex,
    pass,
    checks,
    scores: result?.scores ?? null,
    admissionCounts: diagnostics?.admission_counts ?? null,
    warnings: diagnostics?.metric_warnings ?? [],
    exportReadinessDecision: diagnostics?.export_readiness_decision ?? null,
    files
  };
}

async function prepareProviderPage(context, provider) {
  const page = await context.newPage();
  await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(8000);
  const text = await bodyText(page);
  const composer = await findComposer(page, provider);
  const availability = {
    provider: provider.id,
    url: page.url(),
    title: await page.title().catch(() => ""),
    authState: classifyAuth(provider.id, text, page.url()),
    toolbar: (await page.locator("#luxcrypta-toolbar").count().catch(() => 0)) > 0,
    input: Boolean(composer),
    text: text.slice(0, 3000)
  };
  return { page, availability };
}

async function runProvider(context, provider) {
  const providerDir = path.join(runDir, provider.id);
  ensureDir(providerDir);
  const { page, availability } = await prepareProviderPage(context, provider);
  writeFileSync(path.join(providerDir, "availability.json"), JSON.stringify(availability, null, 2));
  await page.screenshot({ path: path.join(providerDir, "availability.png"), fullPage: true });
  const summaries = [];
  if (availabilityOnly) {
    await page.close().catch(() => {});
    return { provider: provider.id, availability, skipped: true, reason: "availability_only", runs: summaries };
  }
  if (!availability.toolbar || !availability.input) {
    await page.close().catch(() => {});
    return { provider: provider.id, availability, skipped: true, reason: "toolbar_or_input_unavailable", runs: summaries };
  }
  if (/logged_out_or_auth_required/.test(availability.authState)) {
    await page.close().catch(() => {});
    return { provider: provider.id, availability, skipped: true, reason: "authentication_required", runs: summaries };
  }

  for (const prompt of prompts) {
    const outDir = path.join(providerDir, `prompt-${prompt.index}`);
    ensureDir(outDir);
    writeFileSync(path.join(outDir, "prompt.txt"), prompt.text);
    await page.goto(provider.url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const beforeStates = await allReviewStates(context);
    const beforeKeys = new Set(Object.keys(beforeStates));
    let sendMethod = null;
    let response = { done: false, responseText: "", elapsedMs: 0 };
    let openClick = null;
    let latest = null;
    let reviewState = null;
    let reviewText = "";
    let reloadCheck = null;
    let copy = null;
    try {
      await fillComposer(page, provider, prompt.text);
      await page.screenshot({ path: path.join(outDir, "prompt-input.png"), fullPage: true });
      sendMethod = await clickSend(page);
      response = await waitForResponseDone(page, provider);
      writeFileSync(path.join(outDir, "model-response.txt"), response.responseText);
      await page.screenshot({ path: path.join(outDir, "provider-response.png"), fullPage: true });
      openClick = await clickAdvanced(page).catch((error) => ({
        clickDetected: false,
        error: error instanceof Error ? error.message : String(error)
      }));
      latest = await latestReviewState(context, beforeKeys);
      reviewState = latest?.state ?? null;
      if (reviewState?.id) {
        const reviewPage = await openReviewCapturePage(context, reviewState.id);
        if (reviewPage) {
          reviewText = await bodyText(reviewPage);
          writeFileSync(path.join(outDir, "review-visible-output.txt"), reviewText);
          await reviewPage.screenshot({ path: path.join(outDir, "review-surface.png"), fullPage: true });
          reloadCheck = await checkReload(reviewPage);
          writeFileSync(path.join(outDir, "reload-check.json"), JSON.stringify(reloadCheck, null, 2));
          copy = await copyCheck(reviewPage, outDir);
          writeFileSync(path.join(outDir, "copy-button-check.json"), JSON.stringify(copy, null, 2));
        }
        writeFileSync(
          path.join(outDir, "raw-diagnostic-review-state.json"),
          JSON.stringify({ ok: true, data: reviewState }, null, 2)
        );
        writeFileSync(
          path.join(outDir, "review-open-events.json"),
          JSON.stringify(
            {
              events:
                reviewState.result?.continuityReview?.diagnostics?.providerHealth
                  ?.review_open_events ?? [],
              providerHealth:
                reviewState.result?.continuityReview?.diagnostics?.providerHealth ?? null
            },
            null,
            2
          )
        );
      }
      const files = {
        promptInput: path.join(outDir, "prompt-input.png"),
        providerResponse: path.join(outDir, "provider-response.png"),
        reviewSurface: path.join(outDir, "review-surface.png"),
        rawDiagnosticJson: path.join(outDir, "raw-diagnostic-review-state.json"),
        copiedReviewText: path.join(outDir, "copied-review-text.txt"),
        copyButtonCheck: path.join(outDir, "copy-button-check.json"),
        reloadCheck: path.join(outDir, "reload-check.json")
      };
      summaries.push({
        ...summarizeRun(provider.id, prompt.index, reviewState, reviewText, reloadCheck, copy, files),
        sendMethod,
        responseDone: response.done,
        responseElapsedMs: response.elapsedMs,
        reviewId: reviewState?.id ?? null,
        reviewTextChars: reviewText.length,
        openClick
      });
    } catch (error) {
      summaries.push({
        provider: provider.id,
        prompt: prompt.index,
        pass: false,
        error: error instanceof Error ? error.stack ?? error.message : String(error),
        sendMethod,
        responseDone: response.done,
        responseElapsedMs: response.elapsedMs,
        openClick
      });
      writeFileSync(
        path.join(outDir, "run-error.json"),
        JSON.stringify(summaries.at(-1), null, 2)
      );
    }
  }
  await page.close().catch(() => {});
  return { provider: provider.id, availability, skipped: false, runs: summaries };
}

function issueClass(summary) {
  if (summary.reason === "availability_only") return "validation access";
  if (summary.reason === "authentication_required") return "validation access";
  if (summary.reason === "toolbar_or_input_unavailable") return "validation access";
  if (summary.error || summary.reason) return "extraction";
  const failed = Object.entries(summary.checks ?? {})
    .filter(([, check]) => !check.pass)
    .map(([key]) => key);
  return failed.map((key) => {
    if (key === "bodyFirstExtraction") return "extraction";
    if (key === "failClosedProvenance") return "provenance/admission";
    if (key === "durableBucketIntegrity") return "bucket classification";
    if (key === "scoringHonesty") return "scoring honesty";
    if (key === "promptReviewTruthfulness") return "review-open truth";
    if (key === "copyExportTruthfulness") return "copy/export truth";
    return key;
  });
}

function writeReport(results) {
  const allRuns = results.flatMap((provider) => provider.runs ?? []);
  const providerRows = results
    .map((provider) => {
      const passed = provider.skipped
        ? "BLOCKED"
        : provider.runs.every((run) => run.pass)
          ? "PASS"
          : "FAIL";
      return `| ${provider.provider} | ${provider.availability.authState} | ${passed} | ${provider.runs.length} | ${provider.reason ?? ""} |`;
    })
    .join("\n");
  const issueRows = [
    ...results
      .filter((provider) => provider.skipped)
      .map(
        (provider) =>
          `| ${provider.provider} | availability | ${provider.reason} | ${issueClass(provider).toString()} | ${provider.provider}/availability.json |`
      ),
    ...allRuns
      .filter((run) => !run.pass)
      .map((run) => {
        const failedChecks = run.checks
          ? Object.entries(run.checks)
              .filter(([, check]) => !check.pass)
              .map(([key]) => key)
              .join(", ")
          : run.error ?? "run failed";
        return `| ${run.provider} | prompt-${run.prompt} | ${failedChecks} | ${issueClass(run).toString()} | ${run.files?.rawDiagnosticJson ?? `${run.provider}/prompt-${run.prompt}/run-error.json`} |`;
      })
  ].join("\n");
  const finalRecommendation =
    results.every((provider) => !provider.skipped) && allRuns.length > 0 && allRuns.every((run) => run.pass)
      ? "CLOSE PHASE 3"
      : "PHASE 3 LIVE VALIDATION BLOCKED";
  const report = [
    "# Phase 3 Live Validation Report",
    "",
    `Date: 2026-05-23`,
    "",
    "Status: live validation attempt for Phase 3 surgical hardening.",
    "",
    "This is a validation-access blocker, not evidence of a passing Phase 3 and not yet evidence of a trust-runtime regression.",
    "",
    "## Provider Results",
    "",
    "| Provider | Auth State | Verdict | Runs | Blocker |",
    "|---|---|---:|---:|---|",
    providerRows,
    "",
    "## Remaining Issues",
    "",
    issueRows
      ? ["| Provider | Run | Failure | Class | Evidence |", "|---|---|---|---|---|", issueRows].join("\n")
      : "No failures detected.",
    "",
    "## Evidence",
    "",
    "- `live-validation-summary.json`",
    "- Per-provider `availability.json` and `availability.png`",
    "- Per-run `prompt-input.png`, `provider-response.png`, `review-surface.png`, `raw-diagnostic-review-state.json`, `copied-review-text.txt`, `copy-button-check.json`, and `reload-check.json` when the provider run reached Prompt Review.",
    "",
    "## Access Attempts",
    "",
    "- Disposable Chrome profile clone: provider sessions did not carry into the instrumented profile and the unpacked extension toolbar was unavailable.",
    "- Clean Brave profile with unpacked extension: extension mounted on several provider pages, but providers were logged out or blocked by security checks.",
    "- Disposable Brave profile clone: extension mounted on ChatGPT, Gemini, Grok, and Perplexity, but authenticated provider state still did not carry; Claude and DeepSeek were stopped by security verification.",
    "- Existing normal Brave session: ChatGPT was visibly authenticated and the LuxCrypta toolbar was present, but the browser was not launched with remote debugging, so the required raw diagnostic JSON, persisted review inspection, reload, and copy/export automation could not be collected without disrupting the live user session.",
    "",
    "## Recommendation",
    "",
    finalRecommendation,
    "",
    "## Notes",
    "",
    "- This report is generated from live provider DOM through the unpacked Chromium extension build.",
    "- Providers marked blocked did not produce authenticated live Prompt Review evidence and cannot be counted toward Phase 3 closure.",
    "- Required next step: run the same script against a dedicated authenticated debug profile, or relaunch an authenticated browser with remote debugging and the unpacked extension available.",
    "- Authenticated CDP rerun path: relaunch the authenticated browser with `--remote-debugging-port=9262`, then run `LCPA_LIVE_CDP_ENDPOINT=http://127.0.0.1:9262 node validation-evidence/2026-05-23-phase-3-surgical-hardening/run-live-validation.mjs`."
  ].join("\n");
  writeFileSync(path.join(runDir, "PHASE_3_LIVE_VALIDATION_REPORT.md"), report);
  return finalRecommendation;
}

async function run() {
  ensureDir(runDir);
  const browser = cdpEndpoint ? await chromium.connectOverCDP(cdpEndpoint) : null;
  const context =
    browser?.contexts()[0] ??
    (await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath,
      viewport: { width: 1440, height: 1000 },
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-timer-throttling"
      ]
    }));
  const results = [];
  for (const provider of providers) {
    const result = await runProvider(context, provider).catch((error) => ({
      provider: provider.id,
      availability: { provider: provider.id, authState: "runner_error" },
      skipped: true,
      reason: error instanceof Error ? error.stack ?? error.message : String(error),
      runs: []
    }));
    results.push(result);
    writeFileSync(path.join(runDir, "live-validation-summary.json"), JSON.stringify(results, null, 2));
  }
  writeFileSync(path.join(runDir, "live-validation-summary.json"), JSON.stringify(results, null, 2));
  const recommendation = writeReport(results);
  if (!cdpEndpoint) {
    await context.close();
  }
  console.log(JSON.stringify({ recommendation, providers: results.length }, null, 2));
}

run().catch((error) => {
  ensureDir(runDir);
  writeFileSync(
    path.join(runDir, "run-error.json"),
    JSON.stringify({ error: error instanceof Error ? error.stack ?? error.message : String(error) }, null, 2)
  );
  console.error(error);
  process.exit(1);
});
