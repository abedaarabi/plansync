"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

type Props = {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
};

export function AppIntlProvider({ locale, messages, children }: Props) {
  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
