"use client";

import { forwardRef, type ReactNode } from "react";

export type Errors = Record<string, string | undefined>;

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <svg viewBox="0 0 16 16" className="mt-[0.2rem] h-4 w-4 flex-none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M8 4.5v4.2M8 10.8v.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </p>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "url";
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
};

export const TextField = forwardRef<HTMLInputElement & HTMLTextAreaElement, TextFieldProps>(function TextField(
  { name, label, hint, optional, error, value, onChange, type = "text", autoComplete, inputMode, multiline, rows = 3, maxLength, className = "" },
  ref,
) {
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": optional ? undefined : true,
    autoComplete,
    maxLength,
    className: "field-input",
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {multiline ? (
        <textarea ref={ref} rows={rows} {...common} />
      ) : (
        <input ref={ref} type={type} inputMode={inputMode} {...common} />
      )}
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
});

export function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = `f-${name}`;
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="field-label">{legend}</legend>
      <div className="mt-1 space-y-1">
        {options.map((o) => (
          <label key={o.value} className="check-row cursor-pointer rounded-lg">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              {o.label}
              {o.hint && <span className="block text-[0.9375rem] text-muted">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      <ErrorText id={`${id}-error`} message={error} />
    </fieldset>
  );
}

export function Checkbox({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label className="check-row cursor-pointer" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      <ErrorText id={`${id}-error`} message={error} />
    </div>
  );
}

export function ErrorSummary({
  errors,
  labels,
  formError,
  summaryRef,
}: {
  errors: Errors;
  labels: Record<string, string>;
  formError?: string;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const keys = Object.keys(errors).filter((k) => errors[k]);
  if (!keys.length && !formError) return null;
  return (
    <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-xl border-2 border-open bg-open-bg/60 p-5">
      {formError ? (
        <p className="font-semibold text-open">{formError}</p>
      ) : (
        <>
          <p className="font-semibold text-open">
            Please fix {keys.length === 1 ? "one thing" : `${keys.length} things`} before sending:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {keys.map((k) => (
              <li key={k}>
                <a className="text-link !text-open" href={`#f-${k}`}>
                  {labels[k] ?? k}: {errors[k]}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Hidden from people and assistive tech; bots tend to fill it in. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export async function postJson(url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  return { status: res.status, data };
}
