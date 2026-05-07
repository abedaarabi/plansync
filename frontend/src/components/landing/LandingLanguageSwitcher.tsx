"use client";

import { memo } from "react";
import { AppLocaleSelect } from "@/components/i18n/AppLocaleSelect";

type Props = {
  /** Additional classes for the native select */
  className?: string;
  /** Visual variant for nav placement */
  variant?: "nav" | "mobile";
};

export const LandingLanguageSwitcher = memo(function LandingLanguageSwitcher({
  className = "",
  variant = "nav",
}: Props) {
  return <AppLocaleSelect className={className} variant={variant === "nav" ? "nav" : "mobile"} />;
});
