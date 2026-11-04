"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FLAT_LOCATIONS, FlatLocation, norm } from "@/lib/locations";
import { parseQuery, priceLabel, queryToParams } from "@/lib/search";
import { cx } from "@/lib/format";
import { Icon } from "./Icon";

function suggest(input: string): { items: FlatLocation[]; replaceWords: number } {
  const words = input.trim().split(/\s+/).filter(Boolean);
  for (let k = Math.min(3, words.length); k >= 1; k--) {
    const frag = norm(words.slice(-k).join(" "));
    if (frag.length < 2) continue;
    const items = FLAT_LOCATIONS.filter((l) => l.terms.some((t) => t.startsWith(frag) || t.includes(` ${frag}`)))
      .sort((a, b) => (a.level === b.level ? 0 : a.level === "city" ? -1 : b.level === "city" ? 1 : a.level === "locality" ? -1 : 1))
      .slice(0, 7);
    // Skip if the fragment is already a complete location name.
    if (items.length && !items.some((i) => i.terms.includes(frag) && k === words.length)) return { items, replaceWords: k };
  }
  return { items: [], replaceWords: 0 };
}

export function SearchBar({
  initial = "",
  placeholder = "Try “3 BHK in Bangalore under 1 Cr”",
  size = "lg",
  inert,
  showInterpretation = true,
}: {
  initial?: string;
  placeholder?: string;
  size?: "lg" | "md";
  inert?: boolean;
  showInterpretation?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId(); // several search bars can share a page (hero + header), so ids must be unique
  const listId = `${uid}-suggestions`;

  const { items, replaceWords } = useMemo(() => suggest(q), [q]);
  const listOpen = open && items.length > 0 && !inert;
  const parsed = useMemo(() => (q.trim() ? parseQuery(q) : null), [q]);

  const chips: string[] = [];
  if (parsed) {
    if (parsed.bhk.length) chips.push(`${parsed.bhk.join(", ")} BHK`);
    parsed.types.forEach((t) => chips.push(t));
    const loc = parsed.matchedLocations
      .slice()
      .sort((a, b) => (a.level === "area" ? -1 : b.level === "area" ? 1 : a.level === "locality" ? -1 : 1))[0];
    if (loc) chips.push(loc.label);
    const pl = priceLabel(parsed.minPrice, parsed.maxPrice);
    if (pl) chips.push(pl);
    if (parsed.status) chips.push(parsed.status);
    parsed.furnishing.forEach((f) => chips.push(f));
  }

  function go(text: string) {
    if (inert) return;
    const params = queryToParams(text);
    router.push(`/search?${params.toString()}`);
  }

  function pick(loc: FlatLocation) {
    const words = q.trim().split(/\s+/);
    const base = words.slice(0, words.length - replaceWords).join(" ");
    const next = `${base}${base ? " " : ""}${loc.label} `;
    setQ(next);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  }

  return (
    <form
      className={cx("searchbar", `searchbar-${size}`)}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (listOpen && active >= 0 && items[active]) return pick(items[active]);
        go(q);
      }}
      action="/search"
    >
      <div className="sb-field">
        <Icon name="search" size={size === "lg" ? 20 : 18} className="sb-icon" />
        <input
          ref={inputRef}
          name="q"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Search properties by city, locality, configuration or budget"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listOpen ? listId : undefined}
          aria-expanded={listOpen}
          aria-activedescendant={listOpen && active >= 0 ? `${uid}-opt-${active}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!listOpen) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          tabIndex={inert ? -1 : undefined}
        />
        <button type="submit" className="btn btn-primary sb-submit" tabIndex={inert ? -1 : undefined}>
          Search
        </button>
        {listOpen && (
          <ul className="sb-suggest" role="listbox" id={listId} aria-label="Matching locations">
            {items.map((l, i) => (
              <li
                key={l.label}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={cx(i === active && "is-active")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(l);
                }}
              >
                <span>{l.label}</span>
                <em>{l.level === "city" ? "City" : l.level === "locality" ? "Locality" : "Area"}</em>
              </li>
            ))}
          </ul>
        )}
      </div>
      {showInterpretation && chips.length > 0 && (
        <p className="sb-understood" aria-live="polite">
          Searching for <b>{chips.join(" · ")}</b>
          {parsed?.unmatched && <span className="sb-unmatched"> — ignoring “{parsed.unmatched}”</span>}
        </p>
      )}
    </form>
  );
}
