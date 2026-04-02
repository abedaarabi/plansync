"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { userInitials } from "@/lib/user-initials";

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const user = session?.user;
  const name = user?.name ?? "";
  const email = user?.email ?? "";
  const image = user?.image ?? null;
  const initials = userInitials(name || null, email || null);

  async function onSignOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (isPending) {
    return (
      <div
        className="h-9 w-9 shrink-0 animate-pulse rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/sign-in?next=/dashboard"
        className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/40 hover:bg-[var(--enterprise-hover-surface)]"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 max-w-[200px] items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-white pl-1 pr-2 text-left shadow-sm transition hover:border-[var(--enterprise-primary)]/40"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--enterprise-border)] bg-gradient-to-br from-blue-100 to-slate-100 text-[10px] font-semibold text-slate-800">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-controlled URL / data URL
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-xs font-medium text-[var(--enterprise-text)] sm:block">
          {name || email.split("@")[0] || "Account"}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)]"
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-xl border border-[var(--enterprise-border)]/90 bg-[var(--enterprise-surface)] py-1 shadow-[var(--enterprise-shadow-floating)]"
        >
          <div className="border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-bg)]/50 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
              {name || "Your account"}
            </p>
            <p className="truncate text-xs text-[var(--enterprise-text-muted)]">{email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
            onClick={() => void onSignOut()}
          >
            <LogOut className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
