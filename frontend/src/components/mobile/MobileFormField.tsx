import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  MOBILE_FIELD_INPUT,
  MOBILE_FIELD_LABEL,
  MOBILE_FIELD_SELECT,
  MOBILE_FIELD_TEXTAREA,
} from "@/lib/mobileFormStyles";

type BaseProps = {
  label: string;
  id: string;
  hint?: ReactNode;
  className?: string;
};

export function MobileFormField({
  label,
  id,
  hint,
  className = "",
  ...inputProps
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className={MOBILE_FIELD_LABEL}>
        {label}
      </label>
      <input id={id} className={MOBILE_FIELD_INPUT} {...inputProps} />
      {hint ? <p className="mt-1.5 text-sm text-[var(--enterprise-text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function MobileFormTextarea({
  label,
  id,
  hint,
  className = "",
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className={MOBILE_FIELD_LABEL}>
        {label}
      </label>
      <textarea id={id} className={MOBILE_FIELD_TEXTAREA} {...props} />
      {hint ? <p className="mt-1.5 text-sm text-[var(--enterprise-text-muted)]">{hint}</p> : null}
    </div>
  );
}

export function MobileFormSelect({
  label,
  id,
  hint,
  className = "",
  children,
  ...props
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className={MOBILE_FIELD_LABEL}>
        {label}
      </label>
      <select id={id} className={MOBILE_FIELD_SELECT} {...props}>
        {children}
      </select>
      {hint ? <p className="mt-1.5 text-sm text-[var(--enterprise-text-muted)]">{hint}</p> : null}
    </div>
  );
}
