import type { Metadata } from "next";
import { AccountClient } from "@/components/enterprise/AccountClient";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="mobile-app-page enterprise-animate-in w-full max-w-full p-4 sm:p-5 lg:p-8">
      <div className="mx-auto w-full max-w-full lg:max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-3xl">
            Account
          </h1>
          <p className="enterprise-type-body mt-1 text-[var(--enterprise-text-muted)]">
            Profile, optional device alerts, and sign out — same as you would expect in a cloud
            workspace.
          </p>
        </header>
        <AccountClient />
      </div>
    </div>
  );
}
