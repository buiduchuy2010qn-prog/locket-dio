/**
 * Local offline shell test (Playwright).
 * Requires: npx serve dist -l 4173  AND  npm i -D playwright (or npx)
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.error("Install playwright: npm i -D playwright");
    process.exit(1);
  }
}

const BASE = process.env.BASE_URL || "http://127.0.0.1:4173";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

console.log("1) Online visit", BASE + "/locket");
await page.goto(BASE + "/locket", { waitUntil: "networkidle", timeout: 90000 });

// Give app time to register SW (immediate:true should be fast)
await page.waitForTimeout(4000);

// Ensure SW is registered — fallback direct register if app failed
await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (!regs.length) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }
  await navigator.serviceWorker.ready;
});

await page.waitForTimeout(2000);

const regInfo = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  const r = regs[0];
  return {
    count: regs.length,
    scope: r?.scope || null,
    scriptURL:
      r?.active?.scriptURL ||
      r?.waiting?.scriptURL ||
      r?.installing?.scriptURL ||
      null,
    state: r?.active?.state || r?.waiting?.state || r?.installing?.state || null,
    controller: navigator.serviceWorker.controller?.scriptURL || null,
  };
});
console.log("SW reg:", JSON.stringify(regInfo, null, 2));

console.log("2) Reload for controller");
await page.reload({ waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);

const afterReload = await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
  const regs = await navigator.serviceWorker.getRegistrations();
  const r = regs[0];
  const cacheNames = await caches.keys();
  const shellKeys = [];
  let assetCount = 0;
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    for (const k of keys) {
      if (k.url.includes("/assets/")) assetCount++;
      if (
        k.url.includes("index.html") ||
        /\/$/.test(new URL(k.url).pathname) ||
        k.url.includes("/locket")
      ) {
        shellKeys.push(`${name} :: ${k.url}`);
      }
    }
  }
  return {
    controller: navigator.serviceWorker.controller?.scriptURL || null,
    scope: r?.scope || null,
    scriptURL: r?.active?.scriptURL || null,
    cacheNames,
    shellKeys: shellKeys.slice(0, 30),
    assetCount,
  };
});
console.log("After reload:", JSON.stringify(afterReload, null, 2));

if (!afterReload.controller) {
  console.error("FAIL: no controller after reload");
  await browser.close();
  process.exit(2);
}

console.log("3) Offline navigations");
await context.setOffline(true);

const results = {};
for (const path of ["/", "/locket", "/index.html"]) {
  try {
    const resp = await page.goto(BASE + path, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    const title = await page.title();
    const hasRoot = await page.evaluate(() => !!document.getElementById("root"));
    const snippet = await page.evaluate(() =>
      document.documentElement.outerHTML.slice(0, 180),
    );
    results[path] = {
      ok: resp?.ok() ?? null,
      status: resp?.status() ?? null,
      fromSW: resp?.fromServiceWorker?.() ?? null,
      title,
      hasRoot,
      snippet,
    };
  } catch (e) {
    results[path] = { error: String(e?.message || e) };
  }
}
console.log("Offline results:", JSON.stringify(results, null, 2));

const failed = Object.entries(results).filter(
  ([, v]) => v.error || v.hasRoot === false || (v.status && v.status >= 400),
);
await browser.close();

if (failed.length) {
  console.error("FAIL offline paths:", failed.map(([k]) => k).join(", "));
  process.exit(3);
}
console.log("PASS: offline shell opens for /, /locket, /index.html");
