"use client";

import {
  FormProvider,
  type FieldValues,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import type { FormHTMLAttributes, ReactNode } from "react";
import { createContext, useContext } from "react";
import type { EnterpriseFormDensity } from "./formFieldStyles";

// Child controls read this instead of each caller repeating mobile/compact classes.
const EnterpriseFormDensityContext = createContext<EnterpriseFormDensity>("mobile");

type Props<TValues extends FieldValues> = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  children: ReactNode;
  density?: EnterpriseFormDensity;
  form: UseFormReturn<TValues>;
  /** Use when a shared shell (such as EnterpriseSlideOver) renders the form element. */
  formId?: string;
  onSubmit: SubmitHandler<TValues>;
};

export function EnterpriseForm<TValues extends FieldValues>({
  children,
  density = "mobile",
  form,
  formId,
  onSubmit,
  ...props
}: Props<TValues>) {
  // Slide-overs own their portal-mounted <form>; regular pages let this component
  // render it. Both paths still receive the same React Hook Form context.
  const content = (
    <EnterpriseFormDensityContext.Provider value={density}>
      {children}
    </EnterpriseFormDensityContext.Provider>
  );

  return (
    <FormProvider {...form}>
      {formId ? (
        content
      ) : (
        // Always disable native HTML5 bubbles so Zod/RHF own validation UX.
        <form {...props} noValidate onSubmit={form.handleSubmit(onSubmit)}>
          {content}
        </form>
      )}
    </FormProvider>
  );
}

export function useEnterpriseFormDensity() {
  return useContext(EnterpriseFormDensityContext);
}
