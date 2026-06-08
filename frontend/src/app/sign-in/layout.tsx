import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

/** Auth routes fill the viewport below the root body flex shell. */
export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>;
}
