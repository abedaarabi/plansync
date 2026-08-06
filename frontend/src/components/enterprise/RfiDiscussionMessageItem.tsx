"use client";

import { useId, useMemo } from "react";
import { BadgeCheck } from "lucide-react";
import { RfiMessageHtmlBody } from "@/components/enterprise/RfiMessageHtmlBody";
import { userInitials } from "@/lib/user-initials";

export type RfiDiscussionMessageItemProps = {
  authorName: string;
  authorEmail: string | null;
  authorImage: string | null;
  bodyHtml: string;
  createdAtIso: string;
  timeLabel: string;
  /** Align bubble to the right (current user). */
  isMine?: boolean;
  isRecordedAnswer?: boolean;
  showAnswerPicker?: boolean;
  isPickerSelected?: boolean;
  onTogglePickAsAnswer?: () => void;
};

// fallow-ignore-next-line complexity
export function RfiDiscussionMessageItem({
  authorName,
  authorEmail,
  authorImage,
  bodyHtml,
  createdAtIso,
  timeLabel,
  isMine = false,
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

  return (
    <li className={`flex list-none gap-1.5 ${isMine ? "flex-row-reverse" : ""}`}>
      {!isMine ? (
        <div
          className="mt-4 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[8px] font-semibold text-[var(--enterprise-text-muted)]"
          aria-hidden
        >
          {authorImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- user profile URL / data URL from auth
            <img src={authorImage} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
      ) : (
        <span className="w-6 shrink-0" aria-hidden />
      )}

      <div
        className={`min-w-0 max-w-[min(100%,22rem)] sm:max-w-[min(100%,26rem)] ${isMine ? "items-end" : ""}`}
      >
        <div
          className={`mb-0.5 flex items-baseline gap-1.5 px-0.5 ${isMine ? "flex-row-reverse" : ""}`}
        >
          <span
            id={headingId}
            className="truncate text-[11px] font-semibold text-[var(--enterprise-text)]"
          >
            {isMine ? "You" : displayName}
          </span>
          <time
            className="enterprise-hint-tip shrink-0 text-[10px] tabular-nums text-[var(--enterprise-text-muted)]"
            dateTime={createdAtIso}
            aria-label={absoluteTimeTitle}
            data-hint={absoluteTimeTitle}
          >
            {timeLabel}
          </time>
          {isRecordedAnswer ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--enterprise-semantic-success-text)]">
              <BadgeCheck className="h-3 w-3" aria-hidden />
              Answer
            </span>
          ) : null}
        </div>

        <article
          aria-labelledby={headingId}
          className={`rounded-2xl px-2.5 py-1.5 text-xs leading-snug shadow-[var(--enterprise-shadow-xs)] [&_.rfi-rich-body]:text-xs [&_.rfi-rich-body]:leading-snug ${
            isMine
              ? "rounded-tr-md bg-[var(--enterprise-primary)] text-white [&_.rfi-rich-body]:text-white [&_a]:text-white [&_a]:underline [&_[data-type=mention]]:bg-white/20 [&_[data-type=mention]]:text-white"
              : isRecordedAnswer
                ? "rounded-tl-md border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-text)]"
                : isPickerSelected
                  ? "rounded-tl-md border border-[var(--enterprise-primary)]/50 bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-text)] ring-1 ring-[var(--enterprise-primary)]/20"
                  : "rounded-tl-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-[var(--enterprise-text)]"
          }`}
        >
          <RfiMessageHtmlBody html={bodyHtml} className="mt-0" />
        </article>

        {showAnswerPicker && onTogglePickAsAnswer ? (
          <button
            type="button"
            onClick={onTogglePickAsAnswer}
            aria-label={
              isPickerSelected
                ? "Clear official answer selection"
                : "Use this message as the official answer"
            }
            className={`mt-0.5 px-0.5 text-[10px] font-semibold transition ${
              isMine ? "ml-auto block text-right" : ""
            } ${
              isPickerSelected
                ? "text-[var(--enterprise-primary)]"
                : "text-[var(--enterprise-text-muted)] hover:text-[var(--enterprise-primary)]"
            }`}
          >
            {isPickerSelected ? "Selected as answer" : "Use as answer"}
          </button>
        ) : null}
      </div>
    </li>
  );
}
