"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { AppLocaleSelect } from "@/components/i18n/AppLocaleSelect";
import { authClient } from "@/lib/auth-client";
import { clearAppBadgeSafe } from "@/lib/appBadge";
import { userInitials } from "@/lib/user-initials";

export function UserMenu() {
  const router = useRouter();
  const t = useTranslations("app.userMenu");
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
    clearAppBadgeSafe();
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (isPending) {
    return (
      <div
        className="h-8 w-8 shrink-0 animate-pulse rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/sign-in?next=/dashboard"
        className="rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
      >
        {t("signIn")}
      </Link>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 min-h-8 max-w-[200px] items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-white pl-1 pr-1.5 text-left transition hover:bg-[var(--enterprise-hover-surface)] sm:gap-2 sm:pr-2"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--enterprise-hover-surface)] text-[10px] font-semibold text-slate-800">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-controlled URL / data URL
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-xs font-medium text-[var(--enterprise-text)] md:block">
          {name || email.split("@")[0] || t("displayFallback")}
        </span>
        <ChevronDown
          className="hidden h-3.5 w-3.5 shrink-0 text-[var(--enterprise-text-muted)] md:block"
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="fixed right-2 top-[3.25rem] z-50 w-[min(16rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] py-1 shadow-lg sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-[calc(100%+6px)] sm:mt-0 sm:w-[17rem]"
        >
          <div className="border-b border-[var(--enterprise-border)]/80 bg-[var(--enterprise-bg)]/50 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-[var(--enterprise-text)]">
              {name || t("yourAccount")}
            </p>
            <p className="truncate text-xs text-[var(--enterprise-text-muted)]">{email}</p>
          </div>
          <div className="border-b border-[var(--enterprise-border)]/80 px-3 py-2.5">
            <AppLocaleSelect variant="enterprise" />
          </div>
          <Link
            href="/account"
            role="menuitem"
            className="flex min-h-11 items-center gap-2 px-3 py-2.5 text-sm text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
            onClick={() => setOpen(false)}
          >
            <UserRound className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
            {t("account")}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[var(--enterprise-text)] transition hover:bg-[var(--enterprise-hover-surface)]"
            onClick={() => void onSignOut()}
          >
            <LogOut className="h-4 w-4 text-[var(--enterprise-text-muted)]" strokeWidth={1.75} />
            {t("logOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
