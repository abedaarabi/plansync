import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Clear PlanSync local data and preferences in this browser.",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
