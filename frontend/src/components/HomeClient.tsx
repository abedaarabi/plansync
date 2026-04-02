"use client";

import { LandingPage } from "@/components/LandingPage";
import { QueryProvider } from "@/providers/QueryProvider";

export function HomeClient() {
  return (
    <QueryProvider>
      <LandingPage />
    </QueryProvider>
  );
}
