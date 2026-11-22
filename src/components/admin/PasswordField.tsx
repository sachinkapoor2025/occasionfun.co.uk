"use client";

import { useId, useState } from "react";
import { fieldClass, labelClass } from "./fields";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  name,
  invalid,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  name: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const generatedId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className={labelClass} htmlFor={generatedId}>
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={generatedId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClass} mt-0 pr-20`}
          required
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:text-navy-900"
          aria-pressed={visible}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
