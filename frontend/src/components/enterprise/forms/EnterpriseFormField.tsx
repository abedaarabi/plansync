"use client";

import { useId, type ReactNode } from "react";
import { useController, useFormContext, type FieldPath, type FieldValues } from "react-hook-form";
import { labelClassName } from "./formFieldStyles";
import { useEnterpriseFormDensity } from "./EnterpriseForm";

type Props<TValues extends FieldValues> = {
  children: (props: {
    describedBy?: string;
    field: ReturnType<typeof useController<TValues>>["field"];
    id: string;
    invalid: boolean;
  }) => ReactNode;
  hint?: string;
  label: string;
  name: FieldPath<TValues>;
  required?: boolean;
};

export function EnterpriseFormField<TValues extends FieldValues>({
  children,
  hint,
  label,
  name,
  required = false,
}: Props<TValues>) {
  const density = useEnterpriseFormDensity();
  const { control } = useFormContext<TValues>();
  const { field, fieldState } = useController({ control, name });
  const generatedId = useId();
  // The same generated id links label, hint, and inline error for assistive tech.
  const id = `enterprise-field-${generatedId.replace(/:/g, "")}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [fieldState.error ? errorId : undefined, hint ? hintId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className={labelClassName(density)}>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </label>
      {children({
        field,
        id,
        invalid: Boolean(fieldState.error),
        ...(describedBy ? { describedBy } : {}),
      })}
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-[var(--enterprise-text-muted)]">
          {hint}
        </p>
      ) : null}
      {fieldState.error?.message ? (
        <p
          id={errorId}
          className="mt-1.5 text-xs font-medium text-[var(--enterprise-semantic-danger-text)]"
          role="alert"
        >
          {fieldState.error.message}
        </p>
      ) : null}
    </div>
  );
}
