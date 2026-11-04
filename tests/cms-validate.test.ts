import { describe, expect, it } from "vitest";
import { createSection, defaultPage, SECTION_DEFS, type SectionType } from "@/lib/cms/schema";
import { normalizePage, validatePage } from "@/lib/cms/validate";

describe("CMS page validation", () => {
  it("accepts the default page", () => {
    const r = validatePage(defaultPage());
    expect(r.ok ? "ok" : r.error).toBe("ok");
  });

  it("accepts a page with one of every section type added", () => {
    const page = defaultPage();
    const types = (Object.keys(SECTION_DEFS) as SectionType[]).filter((t) => !SECTION_DEFS[t].singleton);
    page.sections.splice(1, 0, ...types.map((t) => createSection(t)));
    const r = validatePage(page);
    expect(r.ok ? "ok" : r.error).toBe("ok");
  });

  it("rejects script links, unknown tags and non-hex colours", () => {
    const bad = (mut: (p: ReturnType<typeof defaultPage>) => void) => {
      const p = defaultPage();
      mut(p);
      return validatePage(p).ok;
    };
    expect(bad((p) => (p.sections.find((s) => s.type === "header")!.settings.ctaHref = "javascript:alert(1)"))).toBe(false);
    expect(bad((p) => (Object.values(p.sections[1].text)[0].style.tag = "script" as never))).toBe(false);
    expect(bad((p) => (p.theme.accent = "red; background:url(x)"))).toBe(false);
    expect(bad((p) => (p.sections[1].style.bgImage = "http://insecure.example/x.jpg"))).toBe(false);
  });

  it("rejects duplicate section ids and oversized pages", () => {
    const p = defaultPage();
    p.sections[2].id = p.sections[1].id;
    expect(validatePage(p).ok).toBe(false);
    const big = defaultPage();
    Object.values(big.sections[1].text)[0].text = "x".repeat(600_000);
    expect(validatePage(big).ok).toBe(false);
  });

  it("normalizePage repairs damaged stored content instead of failing", () => {
    const p = defaultPage() as unknown as Record<string, unknown>;
    const damaged = { ...p, theme: { ...(p.theme as object), accent: "nope" }, sections: [...(p.sections as unknown[]), { id: "x-1", type: "no-such-type" }] };
    const fixed = normalizePage(damaged);
    expect(validatePage(fixed).ok).toBe(true);
    expect(fixed.sections.some((s) => (s.type as string) === "no-such-type")).toBe(false);
    expect(validatePage(normalizePage(null)).ok).toBe(true);
    expect(validatePage(normalizePage("garbage")).ok).toBe(true);
  });
});
