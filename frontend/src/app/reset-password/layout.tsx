import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>;
}
