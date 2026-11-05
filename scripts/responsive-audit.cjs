// Responsive audit: opens every page at 14 screen sizes (320px phones to 2560px monitors) and reports
// sideways scrolling, elements outside the screen, tap targets under 24px and text under 11.5px.
// Screenshots and report.json go to the output folder (default ./responsive-report).
//
//   E2E_PASSWORD=… npm run audit:responsive            (against E2E_BASE_URL, default http://localhost:3000)
//
// Logs in once through the API (the login endpoint is rate limited) and reuses the session.
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = process.argv[2] || "responsive-report";
require("fs").mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  ["phone-320", 320, 568, true], ["phone-360", 360, 740, true], ["phone-375", 375, 667, true], ["phone-390", 390, 844, true], ["phone-430", 430, 932, true],
  ["phone-land-667", 667, 375, true], ["phone-land-844", 844, 390, true],
  ["tablet-768", 768, 1024, true], ["tablet-820", 820, 1180, true], ["tablet-land-1024", 1024, 768, true],
  ["laptop-1280", 1280, 800, false], ["desktop-1440", 1440, 900, false], ["desktop-1920", 1920, 1080, false], ["wide-2560", 2560, 1440, false],
];
const PAGES = process.env.PAGES ? process.env.PAGES.split(",") : ["home", "search", "property", "notfound", "login", "editor", "listings", "listing-form", "new-listing", "enquiries"];
const probe = () => {
  const vw = document.documentElement.clientWidth;
  const out = { scrollW: document.documentElement.scrollWidth, vw, overflow: [], small: [], tiny: [] };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth) return true; } return false; };
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + (el.textContent && el.children.length === 0 ? ` “${el.textContent.trim().slice(0, 24)}”` : "");
  for (const el of document.body.querySelectorAll("*")) {
    if (!vis(el)) continue;
    if (el.closest("details:not([open])") && !el.closest("summary")) continue; // collapsed menu content
    if (el.closest("svg") && el.tagName.toLowerCase() === "text") continue; // drawing labels scale with the drawing
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && !el.closest(".sr-only,.skip-link,.enq-hp,[hidden]") && getComputedStyle(el).position !== "fixed") out.overflow.push(desc(el) + ` [${Math.round(r.left)}..${Math.round(r.right)}]`);
    if (el.matches("a[href],button,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[role=button]") && !el.closest(".sr-only,.skip-link,.enq-hp") && (r.height < 24 || r.width < 24)) out.small.push(desc(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 11.5) out.tiny.push(desc(el) + ` ${getComputedStyle(el).fontSize}`);
  }
  for (const k of ["overflow", "small", "tiny"]) out[k] = [...new Set(out[k])].slice(0, 8);
  return out;
};
(async () => {
  const b = await chromium.launch();
  const report = {};
  // One login for the whole run (the login endpoint is rate limited).
  const lc = await b.newContext();
  const lr = await lc.request.post(BASE + "/api/admin/login", { data: { password: process.env.E2E_PASSWORD }, headers: { origin: BASE } });
  if (!lr.ok()) throw new Error("login failed " + lr.status());
  const state = await lc.storageState();
  await lc.close();
  for (const [name, w, h, touch] of VIEWPORTS) {
    const ctx = await b.newContext({ storageState: state, viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(String(e)));
    const go = async (path) => { await p.goto(BASE + path, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready); };
    const record = async (page, shot) => {
      const r = await p.evaluate(probe);
      (report[name] ||= {})[page] = r;
      if (shot) await p.screenshot({ path: `${OUT}/${name}-${page}.png`, fullPage: shot === "full" });
    };
    const want = (x) => PAGES.includes(x);
    if (want("home")) { await go("/"); await record("home", "full"); }
    if (want("search")) { await go("/search?q=2bhk+in+bangalore"); await record("search", "full"); }
    let slug = "/property/3-bhk-villa-khokari-road-rajpuri-nv1102";
    if (want("property")) { await go(slug); await record("property", "full"); }
    if (want("notfound")) { await go("/nope"); await record("notfound"); }
    if (want("login")) {
      const c2 = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900 });
      const lp = await c2.newPage();
      await lp.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
      (report[name] ||= {}).login = await lp.evaluate(probe);
      await lp.screenshot({ path: `${OUT}/${name}-login.png` });
      await c2.close();
    }
    if (want("editor")) { await go("/admin"); await record("editor", "view"); }
    if (want("listings")) { await go("/admin/listings"); await record("listings", "full"); }
    if (want("listing-form")) { await go("/admin/listings"); const href = await p.locator("a.st-table-title").first().getAttribute("href"); await go(href); await record("listing-form", "full"); }
    if (want("new-listing")) { await go("/admin/listings/new"); await record("new-listing", "full"); }
    if (want("enquiries")) { await go("/admin/enquiries"); await record("enquiries", "full"); }
    if (errors.length) report[name].errors = errors;
    await ctx.close();
  }
  await b.close();
  require("fs").writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  let bad = 0;
  for (const [vp, pages] of Object.entries(report)) for (const [pg, r] of Object.entries(pages)) {
    if (pg === "errors") { console.log(vp, "PAGE ERRORS", r); continue; }
    const sideways = r.scrollW > r.vw + 1;
    if (sideways || r.overflow.length || r.small.length || r.tiny.length) {
      bad++;
      console.log(`\n${vp} / ${pg}${sideways ? `  ⚠ sideways scroll ${r.scrollW}>${r.vw}` : ""}`);
      if (r.overflow.length) console.log("  overflow:", r.overflow.join(" | "));
      if (r.small.length) console.log("  small targets:", r.small.join(" | "));
      if (r.tiny.length) console.log("  tiny text:", r.tiny.join(" | "));
    }
  }
  console.log(`\n${bad} page/viewport combinations with findings`);
  process.exitCode = bad ? 1 : 0;
})();
