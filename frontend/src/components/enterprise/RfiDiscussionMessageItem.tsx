"use client";

import { useId, useMemo } from "react";
import { RfiMessageHtmlBody } from "@/components/enterprise/RfiMessageHtmlBody";
import { userInitials } from "@/lib/user-initials";

export type RfiDiscussionMessageItemProps = {
  authorName: string;
  authorEmail: string | null;
  authorImage: string | null;
  bodyHtml: string;
  /** ISO timestamp for the <time> element. */
  createdAtIso: string;
  /** Human-readable relative or absolute time. */
  timeLabel: string;
  /** Shown when this message is the recorded formal answer. */
  isRecordedAnswer?: boolean;
  /** Responder can pick which thread message becomes the official answer. */
  showAnswerPicker?: boolean;
  isPickerSelected?: boolean;
  onTogglePickAsAnswer?: () => void;
};

export function RfiDiscussionMessageItem({
  authorName,
  authorEmail,
  authorImage,
  bodyHtml,
  createdAtIso,
  timeLabel,
  isRecordedAnswer,
  showAnswerPicker,
  isPickerSelected,
  onTogglePickAsAnswer,
}: RfiDiscussionMessageItemProps) {
  const headingId = useId();
  const initials = userInitials(authorName || null, authorEmail);

  const absoluteTimeTitle = useMemo(
    () =>
      new Date(createdAtIso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [createdAtIso],
  );

  const displayName = authorName?.trim() || "Unknown";
  const displayEmail = authorEmail?.trim() || null;

  return (
    <li className="list-none">
      <article
        aria-labelledby={headingId}
        className={`overflow-hidden rounded-lg border bg-[var(--enterprise-bg)]/50 dark:bg-[var(--enterprise-hover-surface)]/25 ${
          isRecordedAnswer
            ? "border-[var(--enterprise-semantic-success-border)] shadow-sm"
            : isPickerSelected
              ? "border-[var(--enterprise-primary)]/45 ring-2 ring-[var(--enterprise-primary)]/20"
              : "border-[var(--enterprise-border)]"
        }`}
      >
        {isRecordedAnswer ? (
          <div className="border-b border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] px-3 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-semantic-success-text)]">
              Official answer
            </span>
          </div>
        ) : null}
        <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
          <div
            className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-xs font-semibold text-[var(--enterprise-text-muted)] shadow-[var(--enterprise-shadow-xs)]"
            aria-hidden
          >
            {authorImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- user profile URL / data URL from auth
              <img src={authorImage} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p
                  id={headingId}
                  className="text-base font-semibold leading-tight text-[var(--enterprise-text)]"
                >
                  {displayName}
                </p>
                {displayEmail ? (
                  <p
                    className="enterprise-hint-tip mt-1 truncate text-xs text-[var(--enterprise-text-muted)]"
                    data-hint={displayEmail}
                  >
                    {displayEmail}
                  </p>
                ) : null}
              </div>
              <time
                className="enterprise-hint-tip shrink-0 text-right text-[11px] font-medium tabular-nums text-[var(--enterprise-text-muted)]"
                dateTime={createdAtIso}
                aria-label={absoluteTimeTitle}
                data-hint={absoluteTimeTitle}
              >
                {timeLabel}
              </time>
            </header>

            <div
              className={`mt-3 border-t border-[var(--enterprise-border)]/80 pt-3 text-sm leading-relaxed text-[var(--enterprise-text)] [&_.rfi-rich-body]:text-sm [&_.rfi-rich-body]:leading-relaxed ${
                isPickerSelected && !isRecordedAnswer
                  ? "rounded-md bg-[var(--enterprise-primary)]/[0.05] -mx-1 px-2 py-2 sm:-mx-0 sm:px-3"
                  : ""
              }`}
            >
              <RfiMessageHtmlBody html={bodyHtml} className="mt-0" />
            </div>

            {showAnswerPicker && onTogglePickAsAnswer ? (
              <button
                type="button"
                onClick={onTogglePickAsAnswer}
                aria-label={
                  isPickerSelected
                    ? "Clear official answer selection"
                    : "Use this message as the official answer"
                }
                data-hint={
                  isPickerSelected
                    ? "Click to clear this selection"
                    : "Mark this reply as the formal answer, then use Mark as answered above"
                }
                className={`enterprise-hint-tip mt-3 rounded-md text-left text-xs font-semibold transition ${
                  isPickerSelected
                    ? "bg-[var(--enterprise-primary)]/10 px-2 py-1 text-[var(--enterprise-primary)]"
                    : "text-[var(--enterprise-primary)] hover:bg-[var(--enterprise-primary-soft)] hover:underline"
                }`}
              >
                {isPickerSelected ? "Selected as official answer" : "Use as official answer"}
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
