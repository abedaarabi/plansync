/** Single source for landing FAQ — UI + FAQPage JSON-LD stay in sync. */

export const LANDING_FAQ = [
  {
    q: "Is Free really free forever?",
    a: "Yes. The local PDF viewer is free forever. No hidden limits, no expiry, no credit card.",
  },
  {
    q: "Where are my files stored on Free?",
    a: "Free files never leave your browser. Everything stays on your device locally. We never see or upload your PDFs.",
  },
  {
    q: "Where are Pro files stored?",
    a: "Pro files are stored securely on AWS S3 in your account. Only your team can access them. All transfers are encrypted.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes. Cancel anytime from your billing settings. No questions asked, no lock-in.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You keep access until the end of your billing period. Export your data anytime before cancelling.",
  },
  {
    q: "How does the 14-day trial work?",
    a: "Full Pro access for 14 days, no credit card needed. Upgrade anytime during or after the trial.",
  },
  {
    q: "Can I upgrade from Free to Pro?",
    a: "Yes. Your local markups and measurements migrate automatically to the cloud when you upgrade.",
  },
  {
    q: "Do you support DWG/CAD files?",
    a: "Currently PDF only. DXF/DWG support is on our roadmap and coming soon.",
  },
] as const;
