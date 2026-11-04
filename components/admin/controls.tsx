"use client";

import { createContext, useContext, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/format";

/**
 * Field passes its visible label (and hint) to the control inside it, so every input, select,
 * slider and colour picker gets an accessible name without wiring ids by hand.
 */
const FieldCtx = createContext<{ label?: string; hintId?: string }>({});
const useFieldLabel = () => useContext(FieldCtx);

export function Field({ label, children, hint, inline }: { label: string; children: ReactNode; hint?: string; inline?: boolean }) {
  const hintId = useId();
  return (
    <FieldCtx.Provider value={{ label, hintId: hint ? hintId : undefined }}>
      <div className={cx("st-field", inline && "is-inline")}>
        <span className="st-label" aria-hidden="true">
          {label}
        </span>
        <div className="st-control">{children}</div>
        {hint && (
          <p className="st-hint" id={hintId}>
            {hint}
          </p>
        )}
      </div>
    </FieldCtx.Provider>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { label, hintId } = useFieldLabel();
  return <input aria-label={label} aria-describedby={hintId} {...props} className={cx("st-input", props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { label, hintId } = useFieldLabel();
  return <textarea aria-label={label} aria-describedby={hintId} {...props} className={cx("st-input", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { label, hintId } = useFieldLabel();
  return <select aria-label={label} aria-describedby={hintId} {...props} className={cx("st-input", props.className)} />;
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
  const { label } = useFieldLabel();
  return (
    <div className={cx("st-seg", small && "is-small")} role="radiogroup" aria-label={ariaLabel ?? label}>
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

/** "#abc", "abc", "#AABBCC" → "#aabbcc"; anything else → null. The colour picker only understands six digits. */
export function toHex6(v: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

export function ColorInput({ value, onChange, onReset, placeholder = "Auto" }: { value?: string | null; onChange: (v: string) => void; onReset?: () => void; placeholder?: string }) {
  const { label: fieldLabel } = useFieldLabel();
  return (
    <div className="st-color">
      <input type="color" value={value || "#000000"} className={value ? undefined : "is-auto"} onChange={(e) => onChange(e.target.value)} aria-label={`${fieldLabel ?? "Colour"} — pick`} />
      <input
        type="text"
        key={value ?? "auto"}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v && onReset && value) return onReset();
          const hex = toHex6(v);
          if (hex && hex !== value?.toLowerCase()) onChange(hex);
          else e.target.value = value ?? "";
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label={`${fieldLabel ?? "Colour"} — hex code`}
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
  const { label } = useFieldLabel();
  return (
    <div className="st-slider">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={shown} onChange={(e) => onChange(Number(e.target.value))} className={cx(value == null && "is-auto")} />
      <div className="st-num">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          placeholder={placeholder !== undefined ? String(placeholder) : "auto"}
          aria-label={label ? `${label} — exact value` : undefined}
          onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        />
        {unit && <span>{unit}</span>}
      </div>
      {onReset && value != null && (
        <button type="button" className="st-reset" onClick={onReset} title="Reset" aria-label={label ? `Reset ${label}` : "Reset"}>
          ↺
        </button>
      )}
    </div>
  );
}
