"use client";

import { ChevronDown } from "lucide-react";
import { useMessages, useTranslations } from "next-intl";
import { AnimateIn } from "./AnimateIn";

type FaqItem = { q: string; a: string };

export function LandingFaqSection() {
  const t = useTranslations("faq");
  const messages = useMessages() as { faq?: { items?: FaqItem[] } };
  const items: FaqItem[] = messages.faq?.items ?? [];

  return (
    <section
      className="landing-band-features landing-section relative scroll-mt-20 border-t border-white/8"
      id="faq"
    >
      <div className="mx-auto max-w-3xl px-6">
        <AnimateIn className="text-center">
          <p className="landing-type-label text-[var(--landing-label)]">{t("eyebrow")}</p>
          <h2 className="landing-heading mt-3 text-balance font-semibold">{t("title")}</h2>
          <p className="landing-lede mx-auto mt-3 max-w-lg text-sm sm:text-base">{t("subtitle")}</p>
        </AnimateIn>

        <div className="landing-surface mt-12 overflow-hidden sm:mt-14">
          {items.map((item, i) => (
            <AnimateIn key={item.q} delay={i * 40}>
              <details className="group border-b border-white/8 last:border-0 open:bg-white/4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left text-[15px] font-semibold text-white transition-colors hover:text-sky-200 sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 group-open:text-sky-300" />
                </summary>
                <p className="px-4 pb-4 pr-10 text-sm leading-relaxed text-slate-300 sm:px-5 sm:pb-5">
                  {item.a}
                </p>
              </details>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
