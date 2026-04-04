import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";
import { UmamiAnalytics } from "@/components/UmamiAnalytics";
import appleSplashScreens from "@/lib/pwaAppleSplashScreens.json";
import { getSiteOrigin } from "@/lib/siteUrl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** PlanSync Pro shell — Linear / Vercel–style UI */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const siteTitle = "PlanSync — free construction PDF viewer in your browser";
const siteDescription =
  "Free online PDF viewer for construction plans: calibrate scale, measure and mark up drawings, export marked PDFs. No account; files stay local in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: siteTitle,
    template: "%s · PlanSync",
  },
  description: siteDescription,
  applicationName: "PlanSync",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: siteTitle,
    description: siteDescription,
    siteName: "PlanSync",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  appleWebApp: {
    capable: true,
    title: "PlanSync",
    statusBarStyle: "default",
    startupImage: appleSplashScreens.map(({ w, h, media }) => ({
      url: `/splash/apple-splash-${w}x${h}.png`,
      media,
    })),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-dvh overflow-x-hidden antialiased`}
    >
      <body
        className="flex min-h-dvh min-w-0 flex-col overflow-x-hidden bg-[var(--enterprise-bg)] font-sans text-[var(--enterprise-text)] antialiased"
        suppressHydrationWarning
      >
        <UmamiAnalytics />
        <AppToaster />
        {children}
      </body>
    </html>
  );
}
