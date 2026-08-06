"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EnterpriseIconButton } from "@/components/enterprise/EnterpriseIconButton";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  clearAllMeNotifications,
  clearMeNotification,
  fetchMeNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type MeNotificationRow,
} from "@/lib/api-client";
import { clearAppBadgeSafe, syncAppBadgeFromUnreadCount } from "@/lib/appBadge";
import { qk } from "@/lib/queryKeys";
import { userInitials } from "@/lib/user-initials";

function formatNotifyTime(iso: string, justNow: string): string {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return justNow;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// fallow-ignore-next-line complexity
export function EnterpriseNotificationsBell() {
  const t = useTranslations("app.topBar");
  const qc = useQueryClient();
  const { me } = useEnterpriseWorkspace();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const notifQuery = useQuery({
    queryKey: qk.meNotifications(),
    queryFn: () => fetchMeNotifications(30),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const unreadCount = notifQuery.data?.unreadCount ?? 0;
  const items = notifQuery.data?.items ?? [];

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.meNotifications() });
  }, [qc]);

  const markReadMut = useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: invalidate,
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });

  const clearOneMut = useMutation({
    mutationFn: (id: string) => clearMeNotification(id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const clearAllMut = useMutation({
    mutationFn: () => clearAllMeNotifications(),
    onSuccess: () => {
      invalidate();
      toast.success(t("notifClearedAll"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!me) {
      clearAppBadgeSafe();
      return;
    }
    syncAppBadgeFromUnreadCount(unreadCount);
  }, [me, unreadCount]);

  function onNavigate(n: MeNotificationRow) {
    if (!n.readAt) markReadMut.mutate([n.id]);
    setOpen(false);
  }

  function onClearAll() {
    if (items.length === 0) return;
    if (!window.confirm(t("notifClearAllConfirm"))) return;
    clearAllMut.mutate();
  }

  const busyClear = clearOneMut.isPending || clearAllMut.isPending;

  return (
    <div ref={wrapRef} className="relative">
      <EnterpriseIconButton
        type="button"
        className="relative text-[var(--enterprise-text-muted)]"
        onClick={() => {
          setOpen((o) => !o);
          void notifQuery.refetch();
        }}
        aria-label={
          unreadCount > 0 ? t("notificationsUnread", { count: unreadCount }) : t("notifications")
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--enterprise-primary)] px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_0_2px_var(--enterprise-surface)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </EnterpriseIconButton>

      {open ? (
        <div
          role="dialog"
          aria-label={t("notifications")}
          className="fixed left-2 right-2 top-[calc(var(--enterprise-topbar-offset)_+_0.25rem)] z-[100] flex max-h-[min(28rem,75vh)] w-auto flex-col overflow-hidden rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] shadow-[var(--enterprise-shadow-floating)] sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:mt-0 sm:w-[min(calc(100vw-1.5rem),22.5rem)] md:w-[24rem]"
        >
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--enterprise-border)] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--enterprise-text)]">
                {t("notifications")}
              </p>
              {unreadCount > 0 ? (
                <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                  {t("notifUnreadCount", { count: unreadCount })}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  disabled={markAllMut.isPending}
                  onClick={() => markAllMut.mutate()}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-50"
                  title={t("markAllRead")}
                >
                  <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  {t("markAllRead")}
                </button>
              ) : null}
              {items.length > 0 ? (
                <button
                  type="button"
                  disabled={busyClear}
                  onClick={onClearAll}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-50"
                  title={t("notifClearAll")}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  {t("notifClearAll")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto">
            {notifQuery.isPending ? (
              <p className="px-3 py-10 text-center text-sm text-[var(--enterprise-text-muted)]">
                {t("notifLoading")}
              </p>
            ) : notifQuery.isError ? (
              <p className="px-3 py-10 text-center text-sm text-[var(--enterprise-semantic-danger-text)]">
                {t("notifError")}
              </p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]">
                  <Bell
                    className="h-5 w-5 text-[var(--enterprise-text-muted)]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <p className="text-sm font-medium text-[var(--enterprise-text)]">
                  {t("notifEmptyTitle")}
                </p>
                <p className="max-w-[16rem] text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                  {t("notifEmpty")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--enterprise-border)]/80">
                {items.map((n) => {
                  const unread = !n.readAt;
                  return (
                    <li key={n.id} className="group relative">
                      <Link
                        href={n.href}
                        onClick={() => onNavigate(n)}
                        className={`flex min-h-12 gap-2.5 px-3.5 py-3 pr-10 transition hover:bg-[var(--enterprise-hover-surface)] ${
                          unread ? "bg-[var(--enterprise-primary)]/[0.05]" : ""
                        }`}
                      >
                        <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[10px] font-semibold text-[var(--enterprise-text-muted)]">
                          {n.actor ? (
                            n.actor.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- profile URL from auth
                              <img
                                src={n.actor.image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              userInitials(n.actor.name, n.actor.email ?? null)
                            )
                          ) : (
                            <Bell className="h-4 w-4 opacity-70" strokeWidth={1.75} aria-hidden />
                          )}
                          {unread ? (
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--enterprise-primary)] shadow-[0_0_0_2px_var(--enterprise-surface)]" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm leading-snug text-[var(--enterprise-text)] ${
                                unread ? "font-semibold" : "font-medium"
                              }`}
                            >
                              {n.title}
                            </p>
                            <span className="shrink-0 text-[10px] tabular-nums text-[var(--enterprise-text-muted)]">
                              {formatNotifyTime(n.createdAt, t("timeJustNow"))}
                            </span>
                          </div>
                          {n.actor ? (
                            <p className="mt-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                              {n.actor.name}
                            </p>
                          ) : null}
                          {n.body ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                              {n.body}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                      <button
                        type="button"
                        disabled={busyClear}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearOneMut.mutate(n.id);
                        }}
                        className="absolute right-2 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--enterprise-text-muted)] opacity-70 transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={t("notifClearOne")}
                        title={t("notifClearOne")}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--enterprise-border)] px-3.5 py-2.5">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-hover-surface)]"
            >
              {t("deviceAlertsLink")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
