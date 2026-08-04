"use client";

import { AlertCircle, Bot, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { nanoid } from "nanoid";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IssueRow } from "@/lib/api-client";
import { fetchProjectIssuesChat } from "@/lib/api-client";
import { ProRequiredError } from "@/lib/api-client/errors";
import { projectScopedBaseFromPathname } from "@/lib/projectScopedPath";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { IssueChatCard } from "./IssueChatCard";
import { IssuesChatMarkdown, prepareChatMarkdown } from "./IssuesChatMarkdown";

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
  issues?: IssueRow[];
  isError?: boolean;
};

const MAX_MESSAGES = 24;
const MAX_INPUT_CHARS = 2000;

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
  { label: "All issues", prompt: "Give me all issues" },
  { label: "Overdue", prompt: "Show overdue issues" },
  { label: "Assigned to me", prompt: "My open issues" },
  { label: "Clash-linked", prompt: "Show clash issues" },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  sender: "bot",
  text: "I can find issues by name, status, priority, or who’s assigned. Try a quick prompt or ask in your own words.",
};

function createMessageId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return nanoid();
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[var(--enterprise-primary)]/55 motion-safe:animate-bounce"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: "0.9s" }}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  content,
  sender,
  isError,
}: {
  content: string;
  sender: ChatMessage["sender"];
  isError?: boolean;
}) {
  if (sender === "user") {
    return (
      <div className="rounded-2xl rounded-br-md bg-[var(--enterprise-primary)] px-4 py-3 text-white shadow-sm">
        <IssuesChatMarkdown content={content} variant="user" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex gap-2.5 rounded-2xl rounded-bl-md border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-3">
        <AlertCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--enterprise-semantic-danger-text)]"
          aria-hidden
        />
        <IssuesChatMarkdown content={content} variant="error" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl rounded-bl-md border border-[var(--enterprise-border)]/80 bg-[var(--enterprise-surface)] px-4 py-3 shadow-[var(--enterprise-shadow-xs)]">
      <IssuesChatMarkdown content={content} variant="assistant" />
    </div>
  );
}

// fallow-ignore-next-line complexity
export function IssuesChatAssistant({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);

  const projectBase = useMemo(
    () => projectScopedBaseFromPathname(pathname) ?? `/projects/${projectId}`,
    [pathname, projectId],
  );

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.sender === "user").length,
    [messages],
  );
  const showWelcome = userMessageCount === 0 && !sending;

  const resizeInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    resizeInput();
  }, [isOpen, resizeInput]);

  useEffect(() => {
    if (!isOpen) return;
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [isOpen, messages, sending, prefersReducedMotion]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const resolveSendError = useCallback((e: unknown): string => {
    if (e instanceof ProRequiredError) {
      return "A Pro subscription is required to use Issues.";
    }
    const httpStatus =
      e instanceof Error ? (e as Error & { httpStatus?: number }).httpStatus : undefined;
    if (httpStatus === 429) return "Too many requests. Please try again shortly.";
    if (httpStatus === 503) return "Assistant is temporarily unavailable.";
    if (e instanceof Error && e.message.trim()) return e.message;
    return "Something went wrong. Please try again.";
  }, []);

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim().slice(0, MAX_INPUT_CHARS);
      if (!trimmed || sending) return;

      const withUser: ChatMessage[] = [
        ...messages,
        { id: createMessageId(), sender: "user" as const, text: trimmed },
      ].slice(-MAX_MESSAGES);

      setMessages(withUser);
      setInputValue("");
      setSending(true);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "44px";
        }
      });

      const apiMessages = withUser
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.sender === "user" ? ("user" as const) : ("model" as const),
          content: m.text,
        }));

      try {
        const { reply, issues } = await fetchProjectIssuesChat(projectId, {
          messages: apiMessages,
        });
        setMessages((prev) =>
          [
            ...prev,
            {
              id: createMessageId(),
              sender: "bot" as const,
              text: prepareChatMarkdown(reply),
              issues: issues.length ? issues : undefined,
            },
          ].slice(-MAX_MESSAGES),
        );
      } catch (e) {
        setMessages((prev) =>
          [
            ...prev,
            {
              id: createMessageId(),
              sender: "bot" as const,
              text: resolveSendError(e),
              isError: true,
            },
          ].slice(-MAX_MESSAGES),
        );
      } finally {
        setSending(false);
      }
    },
    [messages, projectId, resolveSendError, sending],
  );

  const closePanel = useCallback(() => setIsOpen(false), []);

  const clearChat = useCallback(() => {
    if (sending) return;
    setMessages([{ ...WELCOME_MESSAGE }]);
    setInputValue("");
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.style.height = "44px";
      inputRef.current?.focus();
    });
  }, [sending]);

  const canClearChat = userMessageCount > 0 && !sending;

  const panelMotion = prefersReducedMotion
    ? ""
    : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-200 lg:motion-safe:slide-in-from-bottom-2";

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Dismiss Issues assistant"
          className="pointer-events-auto fixed inset-0 z-[60] bg-[#0c1222]/35 backdrop-blur-[2px] lg:bg-[#0c1222]/15"
          onClick={closePanel}
        />
      ) : null}

      <div
        className={`pointer-events-none fixed z-[60] flex ${
          isOpen
            ? "inset-x-0 bottom-0 justify-stretch lg:inset-auto lg:right-4 lg:bottom-4 lg:justify-end"
            : "right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[calc(var(--enterprise-bottomnav-offset)+1rem)] justify-end lg:right-4 lg:bottom-4"
        }`}
      >
        {isOpen ? (
          <section
            id="issues-chat-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issues-chat-assistant-title"
            className={`pointer-events-auto flex h-[min(92dvh,calc(100dvh-var(--enterprise-topbar-offset)-0.5rem))] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--enterprise-border)] bg-[color-mix(in_srgb,var(--enterprise-surface)_97%,transparent)] shadow-[var(--enterprise-shadow-floating)] backdrop-blur-xl max-lg:pb-[env(safe-area-inset-bottom,0px)] lg:h-[min(720px,calc(100dvh-5rem))] lg:w-[min(28rem,calc(100vw-2rem))] lg:rounded-3xl ${panelMotion}`}
          >
            <div
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--enterprise-border)] lg:hidden"
              aria-hidden
            />

            <header className="relative shrink-0 border-b border-[var(--enterprise-border)]/80 px-4 pt-3 pb-3.5 sm:px-5">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--enterprise-primary)]/40 to-transparent"
                aria-hidden
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--enterprise-primary)] to-[var(--enterprise-primary-deep)] text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.65)]">
                    <Bot className="h-5 w-5" aria-hidden />
                    <span
                      className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[var(--enterprise-surface)] bg-emerald-500"
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0">
                    <p
                      id="issues-chat-assistant-title"
                      className="truncate text-[15px] font-semibold tracking-tight text-[var(--enterprise-text)]"
                    >
                      Issues assistant
                    </p>
                    <p className="truncate text-xs text-[var(--enterprise-text-muted)]">
                      {sending ? "Searching this project…" : "Online · grounded on project issues"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={clearChat}
                    disabled={!canClearChat}
                    className="mobile-touch-target inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30 disabled:pointer-events-none disabled:opacity-35"
                    aria-label="Clear chat"
                    title="Clear chat"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="mobile-touch-target inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-hover-surface)] hover:text-[var(--enterprise-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30"
                    aria-label="Close Issues assistant"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
            </header>

            <div
              ref={threadRef}
              className="enterprise-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
            >
              {showWelcome ? (
                <div className="flex h-full min-h-[12rem] flex-col justify-center gap-5 py-2">
                  <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-primary)]/15">
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </span>
                    <h2 className="text-base font-semibold tracking-tight text-[var(--enterprise-text)]">
                      Ask about project issues
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
                      Search by title, status, or assignee. Matching issues open as cards you can
                      jump into.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_PROMPTS.map((item) => (
                      <button
                        key={item.prompt}
                        type="button"
                        onClick={() => void handleSubmit(item.prompt)}
                        className="rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-3 text-left text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/35 hover:bg-[var(--enterprise-primary-soft)]/40 hover:text-[var(--enterprise-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/30"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`flex gap-2.5 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.sender === "bot" ? (
                        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-primary)]/12">
                          <Bot className="h-4 w-4" aria-hidden />
                        </span>
                      ) : null}
                      <div
                        className={`min-w-0 space-y-2.5 ${message.sender === "user" ? "max-w-[85%]" : "max-w-full flex-1"}`}
                      >
                        <MessageBubble
                          content={message.text}
                          sender={message.sender}
                          isError={message.isError}
                        />
                        {message.sender === "bot" && message.issues?.length ? (
                          <ul className="space-y-2">
                            {message.issues.map((issue) => (
                              <li key={issue.id}>
                                <IssueChatCard
                                  issue={issue}
                                  href={`${projectBase}/issues/${issue.id}`}
                                  onNavigate={closePanel}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {sending ? (
                    <div className="flex items-center gap-2.5" aria-live="polite">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-primary)] ring-1 ring-[var(--enterprise-primary)]/12">
                        <Bot className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="rounded-2xl rounded-bl-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-3.5 shadow-[var(--enterprise-shadow-xs)]">
                        <TypingIndicator />
                        <span className="sr-only">Thinking</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[var(--enterprise-border)]/80 bg-[color-mix(in_srgb,var(--enterprise-surface)_92%,transparent)] px-3 pt-3 pb-3 sm:px-4 sm:pb-4">
              <form
                className="flex items-end gap-2 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2 shadow-[var(--enterprise-shadow-xs)] transition focus-within:border-[var(--enterprise-primary)]/45 focus-within:ring-2 focus-within:ring-[var(--enterprise-primary)]/15"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit(inputValue);
                }}
              >
                <label htmlFor="issues-chat-assistant-input" className="sr-only">
                  Ask about issues
                </label>
                <textarea
                  ref={inputRef}
                  id="issues-chat-assistant-input"
                  rows={1}
                  value={inputValue}
                  onChange={(event) => {
                    setInputValue(event.target.value.slice(0, MAX_INPUT_CHARS));
                    requestAnimationFrame(resizeInput);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit(inputValue);
                    }
                  }}
                  placeholder="Ask about an issue…"
                  disabled={sending}
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-base leading-snug text-[var(--enterprise-text)] outline-none placeholder:text-[var(--enterprise-text-muted)] disabled:opacity-60 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !inputValue.trim()}
                  className="enterprise-btn-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" aria-hidden />
                </button>
              </form>
              <p className="mt-2 px-1 text-center text-[11px] text-[var(--enterprise-text-muted)]">
                Enter to send · Esc to close
              </p>
            </div>
          </section>
        ) : null}

        {!isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--enterprise-primary)] text-white shadow-[0_10px_28px_-6px_rgba(37,99,235,0.55),0_4px_12px_-2px_rgba(15,23,42,0.18)] transition hover:bg-[var(--enterprise-primary-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--enterprise-primary)]/40 active:scale-[0.98]"
            aria-expanded={false}
            aria-controls="issues-chat-assistant-panel"
            aria-label="Open Issues assistant"
          >
            <Bot className="h-5 w-5 shrink-0" aria-hidden />
            <span
              className="absolute right-2.5 bottom-2.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--enterprise-primary)] bg-emerald-400"
              aria-hidden
            />
          </button>
        ) : null}
      </div>
    </>
  );
}
