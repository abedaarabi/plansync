"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLandingMarketingChat } from "@/lib/api-client";
import { useMarketingGoToFreeViewer } from "./MarketingShell";

type Cta = "openViewer" | "startTrial";

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
  ctas?: Cta[];
};

const MAX_MESSAGES = 24;

function createMessageId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return nanoid();
}

function stripBotCtas(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => (m.sender === "bot" ? { ...m, ctas: undefined } : m));
}

export function LandingChatAssistant() {
  const t = useTranslations("chatbot");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const goToFreeViewer = useMarketingGoToFreeViewer();

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", sender: "bot", text: t("welcome"), ctas: ["openViewer", "startTrial"] },
  ]);

  const quickPrompts = useMemo(
    () => [
      t("quickPromptPricing"),
      t("quickPromptViewer"),
      t("quickPromptTrial"),
      t("quickPromptOperations"),
    ],
    [t],
  );

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.sender === "user").length,
    [messages],
  );

  /** Hide quick chips while typing or after any sent message. */
  const showQuickPrompts = userMessageCount === 0 && inputValue.length === 0 && !sending;

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [isOpen, messages, sending]);

  const resolveSendError = useCallback(
    (e: unknown): string => {
      const httpStatus =
        e instanceof Error ? (e as Error & { httpStatus?: number }).httpStatus : undefined;
      if (httpStatus === 429) return t("errorRateLimit");
      if (httpStatus === 503) return t("errorUnavailable");
      if (e instanceof Error && e.message.trim()) return e.message;
      return t("errorGeneric");
    },
    [t],
  );

  const handleSubmit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const withUser: ChatMessage[] = [
        ...stripBotCtas(messages),
        { id: createMessageId(), sender: "user" as const, text: trimmed },
      ].slice(-MAX_MESSAGES);

      setMessages(withUser);
      setInputValue("");
      setSending(true);

      const apiMessages = withUser.map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("model" as const),
        content: m.text,
      }));

      try {
        const { reply } = await fetchLandingMarketingChat({
          locale,
          messages: apiMessages,
        });
        setMessages((prev) =>
          [...prev, { id: createMessageId(), sender: "bot" as const, text: reply }].slice(
            -MAX_MESSAGES,
          ),
        );
      } catch (e) {
        setMessages((prev) =>
          [
            ...prev,
            { id: createMessageId(), sender: "bot" as const, text: resolveSendError(e) },
          ].slice(-MAX_MESSAGES),
        );
      } finally {
        setSending(false);
      }
    },
    [locale, messages, resolveSendError, sending],
  );

  const onCtaClick = useCallback(
    (cta: Cta) => {
      if (cta === "openViewer") {
        goToFreeViewer();
        return;
      }
      router.push("/sign-in");
    },
    [goToFreeViewer, router],
  );

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
        ...(isRtl ? { left: "1rem" } : { right: "1rem" }),
      }}
    >
      {isOpen ? (
        <section
          id="landing-chat-assistant-panel"
          className="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-slate-200/80 bg-white/95 shadow-(--enterprise-shadow-floating) backdrop-blur-xl"
        >
          <header className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--landing-cta)_14%,white)] text-(--landing-cta) ring-1 ring-[color-mix(in_srgb,var(--landing-cta)_20%,transparent)]">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t("title")}</p>
                <p className="text-xs text-slate-500">{t("subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta)/30"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div
            ref={threadRef}
            className="max-h-[min(50vh,26rem)] space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[88%] space-y-2">
                  <p
                    className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.sender === "user"
                        ? "bg-(--landing-cta) text-white"
                        : "border border-slate-200/75 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {message.text}
                  </p>
                  {message.sender === "bot" && message.ctas?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {message.ctas.map((cta) => (
                        <button
                          key={`${message.id}-${cta}`}
                          type="button"
                          onClick={() => onCtaClick(cta)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-(--landing-cta)/35 hover:text-(--landing-cta) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta)/30"
                        >
                          {cta === "openViewer" ? t("ctaOpenViewer") : t("ctaStartTrial")}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {sending ? (
              <p className="text-xs text-slate-500" aria-live="polite">
                {t("thinking")}
              </p>
            ) : null}
          </div>

          <div className="border-t border-slate-200/80 px-4 pt-3 pb-4">
            {showQuickPrompts ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void handleSubmit(prompt)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-(--landing-cta)/30 hover:text-(--landing-cta) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta)/30"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(inputValue);
              }}
            >
              <label htmlFor="landing-chat-assistant-input" className="sr-only">
                {t("inputLabel")}
              </label>
              <input
                ref={inputRef}
                id="landing-chat-assistant-input"
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={t("placeholder")}
                disabled={sending}
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-(--landing-cta)/55 focus:ring-2 focus:ring-(--landing-cta)/20 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !inputValue.trim()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-(--landing-cta) text-white shadow-sm transition hover:bg-(--landing-cta-bright) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta)/40 disabled:opacity-50"
                aria-label={t("send")}
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="pointer-events-auto inline-flex h-14 items-center gap-2.5 rounded-full border border-[color-mix(in_srgb,var(--landing-cta)_35%,#bfdbfe)] bg-(--landing-cta) px-5 text-sm font-semibold text-white shadow-lg shadow-[color-mix(in_srgb,var(--landing-cta)_40%,transparent)] transition hover:bg-(--landing-cta-bright) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--landing-cta)/40"
        aria-expanded={isOpen}
        aria-controls="landing-chat-assistant-panel"
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>{t("open")}</span>
      </button>
    </div>
  );
}
