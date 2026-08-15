"use client";

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { fieldClassName } from "./formFieldStyles";
import { useEnterpriseFormDensity } from "./EnterpriseForm";

type FieldProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

function isAriaInvalid(value: boolean | "true" | "false" | undefined) {
  return value === true || value === "true";
}

function controlClassName(
  density: ReturnType<typeof useEnterpriseFormDensity>,
  kind: "input" | "textarea" | "select",
  invalid: boolean,
  className?: string,
  extras: string[] = [],
) {
  return [
    fieldClassName(density, kind),
    // Zod/RHF invalid state — not native browser validation chrome.
    invalid ? "enterprise-field-input--error" : "",
    ...extras,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export const EnterpriseInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function EnterpriseInput({ className, ...props }, ref) {
  const density = useEnterpriseFormDensity();
  const invalid = isAriaInvalid(props["aria-invalid"]);
  return (
    <input
      ref={ref}
      className={controlClassName(density, "input", invalid, className)}
      {...props}
      aria-invalid={invalid || undefined}
    />
  );
});

export const EnterpriseTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function EnterpriseTextarea({ className, ...props }, ref) {
  const density = useEnterpriseFormDensity();
  const invalid = isAriaInvalid(props["aria-invalid"]);
  return (
    <textarea
      ref={ref}
      className={controlClassName(density, "textarea", invalid, className)}
      {...props}
      aria-invalid={invalid || undefined}
    />
  );
});

export const EnterpriseSelect = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function EnterpriseSelect({ className, ...props }, ref) {
  const density = useEnterpriseFormDensity();
  const invalid = isAriaInvalid(props["aria-invalid"]);
  return (
    // Keep the native select for mobile pickers and keyboard behavior, but use a
    // consistent chevron so it reads as a dropdown across browsers.
    <div className="relative">
      <select
        ref={ref}
        className={controlClassName(density, "select", invalid, className, [
          "appearance-none",
          "pr-10",
        ])}
        {...props}
        aria-invalid={invalid || undefined}
      />
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--enterprise-text-muted)]"
        aria-hidden
        data-testid="enterprise-select-chevron"
        strokeWidth={1.75}
      />
    </div>
  );
});

export const EnterprisePasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function EnterprisePasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const density = useEnterpriseFormDensity();
  const type = visible ? "text" : "password";
  const invalid = isAriaInvalid(props["aria-invalid"]);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={type}
        className={controlClassName(density, "input", invalid, className, ["pr-11"])}
        {...props}
        aria-invalid={invalid || undefined}
      />
      {/* This is a real button so keyboard and screen-reader users can reveal the value. */}
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-text)]"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
});
