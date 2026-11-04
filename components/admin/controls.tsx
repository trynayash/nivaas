"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Field({ label, children, hint, inline }: { label: string; children: ReactNode; hint?: string; inline?: boolean }) {
  return (
    <div className={cx("st-field", inline && "is-inline")}>
      <span className="st-label">{label}</span>
      <div className="st-control">{children}</div>
      {hint && <p className="st-hint">{hint}</p>}
    </div>
  );
}

export function Group({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="st-group">
      <header>
        <h3>{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  small,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  small?: boolean;
}) {
  return (
    <div className={cx("st-seg", small && "is-small")} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={cx(o.value === value && "is-on")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ToggleButton({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" className={cx("st-tbtn", on && "is-on")} aria-pressed={on} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="st-switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="st-switch-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function ColorInput({ value, onChange, onReset, placeholder = "Auto" }: { value?: string | null; onChange: (v: string) => void; onReset?: () => void; placeholder?: string }) {
  return (
    <div className="st-color">
      <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} aria-label="Pick colour" />
      <input
        type="text"
        key={value ?? "auto"}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(v);
          else e.target.value = value ?? "";
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Hex colour"
      />
      {onReset && value ? (
        <button type="button" className="st-reset" onClick={onReset} title="Reset to automatic">
          Reset
        </button>
      ) : null}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = "",
  placeholder,
  onReset,
}: {
  value?: number | null;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  placeholder?: number;
  onReset?: () => void;
}) {
  const shown = value ?? placeholder ?? min;
  return (
    <div className="st-slider">
      <input type="range" min={min} max={max} step={step} value={shown} onChange={(e) => onChange(Number(e.target.value))} className={cx(value == null && "is-auto")} />
      <div className="st-num">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          placeholder={placeholder !== undefined ? String(placeholder) : "auto"}
          onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        />
        {unit && <span>{unit}</span>}
      </div>
      {onReset && value != null && (
        <button type="button" className="st-reset" onClick={onReset} title="Reset">
          ↺
        </button>
      )}
    </div>
  );
}
