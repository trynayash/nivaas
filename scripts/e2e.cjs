// End-to-end check of the whole site in a real browser.
//   E2E_BASE_URL=http://localhost:3000 E2E_PASSWORD=… npm run e2e
// Creates and deletes its own listing and enquiry. E2E_DESTRUCTIVE=1 also removes all sample
// listings at the end — only use that against a disposable database.
const { chromium, devices } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const base = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const password = process.env.E2E_PASSWORD;
if (!password) throw new Error("Set E2E_PASSWORD to the Studio password.");
const shots = process.env.E2E_SCREENSHOTS;
let failed = 0;
const check = (cond, msg) => {
  if (cond) console.log("  ok   " + msg);
  else {
    failed++;
    console.log("  FAIL " + msg);
  }
};
const shot = async (page, name) => shots && (await page.screenshot({ path: path.join(shots, name + ".png") }));

function testJpeg() {
  // Tiny valid JPEG (1×1), enough to exercise the upload path.
  const b64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
  const f = path.join(os.tmpdir(), `nivaas-e2e-${Date.now()}.jpg`);
  fs.writeFileSync(f, Buffer.from(b64, "base64"));
  return f;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push(`${p.url()} — ${e.message}`));
    p.on("console", (m) => m.type() === "error" && !/status of (401|403|404|409|422|429)/.test(m.text()) && errors.push(`${p.url()} — ${m.text()}`));
  };
  watch(page);
  page.on("dialog", (d) => d.accept());

  console.log("Public site");
  let res = await page.goto(base + "/");
  check(res.status() === 200, "landing page loads");
  check((await page.locator(".sec-hero h1, .sec-hero h2").count()) === 1, "hero headline present");
  check((await page.locator(".city-index li").count()) >= 1, "live city index rendered");
  await page.fill(".hero input[name=q]", "3BHK in Madhli Aai, Murud Janjira");
  await page.press(".hero input[name=q]", "Enter");
  await page.waitForURL(/\/search\?/);
  check((await page.locator("h1").innerText()) === "3 BHK homes in Madhli Aai, Murud Janjira", "search understands the query");
  check((await page.locator(".result-list a.pcard").count()) > 0, "search returns results");
  check((await page.locator(".close-matches .pcard").count()) > 0, "close matches shown");
  await shot(page, "e2e-search");
  const firstHref = await page.locator(".result-list a.pcard").first().getAttribute("href");
  await page.goto(base + firstHref);
  check((await page.locator(".similar .pcard").count()) > 0, "property page shows similar homes");
  check((await page.locator(".dtable > div").count()) >= 8, "property details table filled");
  check((await page.locator(".back-link, .crumbs .text-link").count()) === 1, "back to results link keeps search context");
  res = await page.goto(base + "/property/does-not-exist");
  check(res.status() === 404, "unknown property is a 404");
  res = await page.goto(base + "/robots.txt");
  check(res.status() === 200, "robots.txt served");

  console.log("Mobile layout");
  const m = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  watch(m);
  for (const u of ["/", "/search?q=2bhk+bangalore", firstHref]) {
    await m.goto(base + u);
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no sideways scroll on ${u.slice(0, 40)}`);
  }

  console.log("Studio: sign in");
  await page.goto(base + "/admin");
  await page.fill("input[name=password]", "definitely-wrong");
  await page.click("button[type=submit]");
  await page.waitForSelector(".login-error");
  check(true, "wrong password rejected");
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForSelector(".studio");
  check(true, "signed in");

  console.log("Studio: landing page editor");
  const heading = page.locator(".ed-frame .hero-heading");
  const original = await heading.innerText();
  await heading.click();
  await page.click('.st-seg button[title="Heading 2"]');
  check((await heading.evaluate((e) => e.tagName)) === "H2", "headline switched to H2 in the editor");
  await page.keyboard.press("Control+z");
  check((await heading.evaluate((e) => e.tagName)) === "H1", "undo restores H1");
  await page.click('[data-sec-row="features"] .st-row-main');
  await page.click('.st-seg button:has-text("Centre")');
  await page.waitForFunction(() => document.querySelector(".st-status")?.textContent?.includes("Draft saved"), null, { timeout: 8000 });
  check(true, "draft autosaved");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(1600);
  check((await heading.innerText()) === original, "editor left as it was");

  console.log("Studio: listings");
  await page.click('.st-nav a:has-text("Listings")');
  await page.waitForSelector(".st-table, .st-empty-box");
  await page.click("text=+ New listing");
  await page.waitForSelector("form.lf");
  await page.click('.lf-bar button:has-text("Publish")');
  check((await page.locator(".lf-error").count()) >= 8, "empty form shows every error at once");
  await page.selectOption("#f-bhk", "3");
  await page.fill("#f-projectName", "E2E Test Residency");
  await page.fill("#f-developer", "Owner (resale)");
  await page.selectOption("#f-city", "murud-janjira");
  await page.selectOption("#f-locality", "madhli-aai");
  await page.selectOption("#f-area", "beach-road");
  await page.fill("#f-pincode", "402401");
  await page.fill("#f-address", "Plot 12, Beach Road, Madhli Aai");
  await page.fill("#f-price", "9500000");
  await page.fill("#f-carpetArea", "1100");
  await page.fill("#f-superBuiltUpArea", "1500");
  await page.fill("#f-reraNumber", "P52000099999");
  await page.fill("#f-description", "Sea-facing 3 BHK flat two minutes from Murud beach, with cross ventilation.");
  const jpg = testJpeg();
  await page.setInputFiles("input[type=file]", jpg);
  try {
    await page.waitForSelector(".lf-thumb img", { timeout: 20000 });
    check(true, "photo uploaded");
  } catch {
    const msg = await page.locator(".lf-thumb-pending").innerText().catch(() => "");
    check(false, "photo uploaded — " + msg);
    await page.click(".lf-thumb-pending .text-link").catch(() => {});
  }
  await page.click('.lf-bar button:has-text("Publish")');
  await page.waitForURL(/\/admin\/listings\/L[A-Z0-9]+\?saved=1/, { timeout: 20000 });
  const id = page.url().match(/listings\/(L[A-Z0-9]+)/)[1];
  check(true, "listing created and published: " + id);

  const visitor = await (await browser.newContext()).newPage();
  watch(visitor);
  await visitor.goto(base + "/search?q=" + encodeURIComponent("3 BHK in Madhli Aai, Murud Janjira"));
  const card = visitor.locator(".result-list a.pcard", { hasText: "E2E Test Residency" });
  check((await card.count()) === 1, "new listing appears in public search");
  const slugPath = (await card.getAttribute("href")).split("?")[0];
  await visitor.goto(base + slugPath);
  check((await visitor.locator(".detail-price strong").innerText()) === "₹95 L", "public price correct");
  check((await visitor.locator(".gallery img, .gal-art").count()) >= 1, "photo or drawing shown");

  console.log("Enquiry");
  await visitor.waitForTimeout(2600); // the form ignores instant (bot-like) submissions
  await visitor.fill(".enq input[name=name]", "E2E Visitor");
  await visitor.fill(".enq input[name=phone]", "12");
  await visitor.click(".enq button[type=submit]");
  await visitor.waitForSelector(".enq em");
  check(true, "bad phone number rejected");
  await visitor.fill(".enq input[name=phone]", "98765 43210");
  check((await visitor.locator(".enq em").count()) === 0, "error clears when the field is edited");
  await visitor.click(".enq button[type=submit]");
  await visitor.waitForSelector(".enq-sent");
  check(true, "enquiry sent");
  await page.goto(base + "/admin/enquiries?status=new");
  const row = page.locator(".enq-row", { hasText: "E2E Visitor" });
  check((await row.count()) === 1, "enquiry in the Studio inbox");
  await row.locator("select").selectOption("closed");
  await page.waitForResponse((r) => r.url().includes("/api/admin/enquiries/"));
  check(true, "enquiry marked closed");

  console.log("Unpublish and delete");
  await page.goto(base + "/admin/listings/" + id);
  await page.click('.lf-bar button:has-text("Unpublish")');
  await page.waitForSelector(".lf-msg");
  res = await visitor.goto(base + slugPath);
  check(res.status() === 404, "unpublished listing hidden from visitors");
  await page.click('.lf-bar button:has-text("Delete")');
  await page.waitForURL(/deleted=1/);
  check(true, "test listing deleted");

  if (process.env.E2E_DESTRUCTIVE === "1") {
    console.log("Remove sample listings (destructive)");
    await page.goto(base + "/admin/listings");
    const btn = page.locator("button", { hasText: /Remove \d+ sample listings/ });
    if (await btn.count()) {
      await btn.click();
      await page.waitForFunction(() => !document.body.innerText.match(/Remove \d+ sample listings/), null, { timeout: 15000 });
    }
    res = await visitor.goto(base + "/");
    check(res.status() === 200, "landing still loads with no listings");
    res = await visitor.goto(base + "/search?q=3bhk");
    check(res.status() === 200 && (await visitor.locator(".empty").count()) === 1, "search shows an empty state with no listings");
  }

  console.log(errors.length ? `\nBrowser errors (${errors.length}):\n  ` + errors.join("\n  ") : "\nNo browser errors.");
  await browser.close();
  fs.rmSync(jpg, { force: true });
  if (failed || errors.length) {
    console.log(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
})().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
