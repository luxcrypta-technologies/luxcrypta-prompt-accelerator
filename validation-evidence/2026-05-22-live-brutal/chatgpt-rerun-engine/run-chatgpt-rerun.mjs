import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire("/tmp/luxcrypta-playwright-node/package.json");
const { chromium } = require("playwright");

const repoRoot = "/Users/lct/Desktop/luxcrypta-prompt-accelerator";
const runDir = path.join(
  repoRoot,
  "validation-evidence/2026-05-22-live-brutal/chatgpt-rerun-engine"
);
const profileDir = "/tmp/luxcrypta-chatgpt-rerun-brave-profile";
const extensionDir = path.join(repoRoot, "dist/chromium");
const bravePath = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const priorPromptDir = path.join(
  repoRoot,
  "validation-evidence/2026-05-22-live-brutal/chatgpt"
);

const promptFiles = [1, 2, 3, 4].map((index) => ({
  index,
  text: readFileSync(path.join(priorPromptDir, `prompt-${index}/prompt.txt`), "utf8")
}));

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

async function openReviewCapturePage(context, id) {
  const idHost = await extensionId(context);
  if (!idHost) return null;
  const url = `chrome-extension://${idHost}/review.html?reviewId=${encodeURIComponent(id)}`;
  let reviewPage = context.pages().find((page) => page.url().includes(`/review.html?reviewId=${id}`));
  if (!reviewPage) {
    reviewPage = await context.newPage();
    await reviewPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }
  await reviewPage
    .locator("text=Prompt Review")
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  await reviewPage.waitForTimeout(1500);
  return reviewPage;
}

async function bodyText(page) {
  return await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
}

async function findComposer(page) {
  const selectors = [
    "#prompt-textarea",
    "[data-testid='prompt-textarea']",
    "textarea",
    "[contenteditable='true']"
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).last();
    if ((await locator.count().catch(() => 0)) > 0) return locator;
  }
  return null;
}

async function fillComposer(page, text) {
  const composer = await findComposer(page);
  if (!composer) throw new Error("No ChatGPT composer found.");
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
    "button:has(svg)"
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).last();
    if ((await locator.count().catch(() => 0)) > 0) {
      await locator.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      if (await locator.isEnabled().catch(() => false)) {
        await locator.click();
        return "button";
      }
    }
  }
  await page.keyboard.press("Enter");
  return "enter";
}

async function assistantResponseText(page) {
  return await page.evaluate(() => {
    const assistantNodes = [
      ...document.querySelectorAll("[data-message-author-role='assistant']"),
      ...document.querySelectorAll("article")
    ];
    const texts = assistantNodes
      .map((node) => node.innerText?.trim() ?? "")
      .filter((text) => text.length > 0)
      .filter((text) => !/^ChatGPT can make mistakes/i.test(text));
    return texts.at(-1) ?? "";
  });
}

async function waitForResponseDone(page) {
  const start = Date.now();
  let last = "";
  let stableTicks = 0;
  let best = "";
  while (Date.now() - start < 300_000) {
    const text = await assistantResponseText(page).catch(() => "");
    if (text.length > best.length) best = text;
    const stopVisible =
      (await page
        .locator("button[data-testid='stop-button'], button[aria-label*='Stop' i]")
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
    toolbarAfter: afterText.match(/Powered by LuxCrypta[\s\S]{0,160}/)?.[0] ?? ""
  };
}

async function copyCheck(reviewPage) {
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
    "Copy Workflow Export",
    "Copy Raw JSON"
  ];
  const results = [];
  for (const label of labels) {
    const button = reviewPage.getByRole("button", { name: label }).first();
    const present = (await button.count().catch(() => 0)) > 0;
    let copiedLength = 0;
    if (present) {
      await button.click().catch(() => {});
      await reviewPage.waitForTimeout(150);
      copiedLength = await reviewPage.evaluate(
        () => window.__lcpaCopied?.at(-1)?.length ?? 0
      );
    }
    results.push({ label, present, copiedLength });
  }
  const sectionButtons = await reviewPage.locator(".section-copy-button").count().catch(() => 0);
  const sectionJsonButtons = await reviewPage
    .locator(".section-copy-button", { hasText: "Copy JSON" })
    .count()
    .catch(() => 0);
  return { topLevel: results, sectionButtons, sectionJsonButtons };
}

async function run() {
  ensureDir(runDir);
  if (existsSync(path.join(runDir, "run-error.json"))) {
    rmSync(path.join(runDir, "run-error.json"));
  }
  const cdpUrl = process.env.LCPA_CDP_URL;
  const browser = cdpUrl ? await chromium.connectOverCDP(cdpUrl) : null;
  const context = cdpUrl
    ? browser.contexts()[0]
    : await chromium.launchPersistentContext(profileDir, {
        headless: false,
        executablePath: bravePath,
        viewport: { width: 1440, height: 1000 },
        args: [
          `--disable-extensions-except=${extensionDir}`,
          `--load-extension=${extensionDir}`,
          "--no-first-run",
          "--no-default-browser-check"
        ]
      });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(8000);
  const authText = await bodyText(page);
  const authState = /Good to see you|Recents|Projects|Library/i.test(authText)
    ? "logged_in_or_workspace"
    : /Log in|Sign up/i.test(authText)
      ? "logged_out"
      : "unknown";
  const availability = {
    url: page.url(),
    authState,
    toolbar: (await page.locator("#luxcrypta-toolbar").count().catch(() => 0)) > 0,
    composer: Boolean(await findComposer(page)),
    text: authText.slice(0, 3000)
  };
  writeFileSync(path.join(runDir, "availability.json"), JSON.stringify(availability, null, 2));
  await page.screenshot({ path: path.join(runDir, "availability.png"), fullPage: true });

  const summaries = [];
  for (const { index, text } of promptFiles) {
    const promptDir = path.join(runDir, `prompt-${index}`);
    ensureDir(promptDir);
    writeFileSync(path.join(promptDir, "prompt.txt"), text);

    const beforeStates = await allReviewStates(context);
    const beforeKeys = new Set(Object.keys(beforeStates));
    await fillComposer(page, text);
    const sendMethod = await clickSend(page);
    const response = await waitForResponseDone(page);
    writeFileSync(path.join(promptDir, "model-response.txt"), response.responseText);
    await page.screenshot({ path: path.join(promptDir, "chat-response.png"), fullPage: true });

    const openClick = await clickAdvanced(page).catch((error) => ({
      clickDetected: false,
      error: error instanceof Error ? error.message : String(error)
    }));
    const latest = await latestReviewState(context, beforeKeys);
    let reviewState = latest?.state ?? null;
    let reviewPage = null;
    let reviewText = "";
    let copy = null;
    let reviewScreenshot = null;
    if (reviewState?.id) {
      reviewPage = await openReviewCapturePage(context, reviewState.id);
      if (reviewPage) {
        reviewText = await bodyText(reviewPage);
        writeFileSync(path.join(promptDir, "review-visible-output.txt"), reviewText);
        reviewScreenshot = path.join(promptDir, "review-surface.png");
        await reviewPage.screenshot({ path: reviewScreenshot, fullPage: true });
        if (index === promptFiles.length) {
          copy = await copyCheck(reviewPage);
          writeFileSync(path.join(promptDir, "copy-button-check.json"), JSON.stringify(copy, null, 2));
        }
      }
      writeFileSync(
        path.join(promptDir, "raw-diagnostic-review-state.json"),
        JSON.stringify({ ok: true, data: reviewState }, null, 2)
      );
      writeFileSync(
        path.join(promptDir, "review-open-events.json"),
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

    const diagnostics = reviewState?.result?.continuityReview?.diagnostics;
    const scores = reviewState?.result?.scores;
    const governance = diagnostics?.adversarialGovernance;
    const summary = {
      provider: "chatgpt",
      prompt: index,
      authState,
      sendMethod,
      responseDone: response.done,
      responseElapsedMs: response.elapsedMs,
      reviewId: reviewState?.id ?? null,
      reviewOpenedFirstClick:
        diagnostics?.providerHealth?.review_open_status === "success" ||
        diagnostics?.providerHealth?.review_open_status === "retry_success",
      reviewOpenStatus: diagnostics?.providerHealth?.review_open_status ?? null,
      visibleToUser: diagnostics?.providerHealth?.visible_to_user ?? false,
      refreshRequired: false,
      openClick,
      stableCore: reviewState?.result?.continuityReview?.stableCore ?? [],
      governancePrinciples: governance?.governance_principles ?? [],
      invariants: governance?.invariants ?? [],
      rejectedDirections: governance?.rejected_directions ?? [],
      openUnresolved: reviewState?.result?.continuityReview?.openUnresolved ?? [],
      scores: scores ?? null,
      admissionCounts: diagnostics?.admission_counts ?? null,
      exportReadinessDecision: diagnostics?.export_readiness_decision ?? null,
      missingCategories: diagnostics?.likely_missing_categories ?? null,
      warnings: diagnostics?.metric_warnings ?? null,
      reviewTextChars: reviewText.length,
      copy,
      chatScreenshot: path.join(promptDir, "chat-response.png"),
      reviewScreenshot
    };
    writeFileSync(path.join(promptDir, "run-summary.json"), JSON.stringify(summary, null, 2));
    summaries.push(summary);

    if (index < promptFiles.length) {
      await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(3000);
      const newChat = page.getByRole("link", { name: /New chat/i }).first();
      if ((await newChat.count().catch(() => 0)) > 0) {
        await newChat.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }
  }

  writeFileSync(path.join(runDir, "chatgpt-rerun-summary.json"), JSON.stringify(summaries, null, 2));
  if (browser) {
    await browser.close();
  } else {
    await context.close();
  }
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
