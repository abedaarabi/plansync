"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues } from "react-hook-form";
import type { z } from "zod";

/**
 * Standardizes validation timing: show errors after blur, then clear or update
 * them while the user fixes the field. Forms keep their schemas local.
 */
export function useEnterpriseForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  defaultValues: DefaultValues<z.infer<TSchema>>,
) {
  return useForm<z.infer<TSchema>>({
    // Keep every failing field's message so empty submit paints all inputs red.
    criteriaMode: "all",
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(schema),
  });
}
