"use client";

import { LandingPage } from "@/components/landing";
import { QueryProvider } from "@/providers/QueryProvider";

export function HomeClient() {
  return (
    <QueryProvider>
      <LandingPage />
    </QueryProvider>
  );
}
