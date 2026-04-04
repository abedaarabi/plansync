/** Single source for landing FAQ — UI + FAQPage JSON-LD stay in sync. */

export const LANDING_SOLUTIONS = [
  {
    slug: "viewer",
    title: "PDF viewer",
    description:
      "Open any PDF in your browser. Calibrate scale, measure, annotate, and export — locally, with nothing uploaded on Free.",
    bullets: [
      "Works offline after the first load — your files stay on your device.",
      "Measure lengths and areas with a calibrated scale you control.",
    ],
  },
  {
    slug: "issues",
    title: "Issues on drawings",
    description:
      "Drop pins on the plan, assign owners, attach photos, and track status from open to resolved with your team.",
    bullets: [
      "Every pin carries context: who, what, and where on the sheet.",
      "Notifications keep field and office aligned without chasing email.",
    ],
  },
  {
    slug: "rfis",
    title: "RFI workflow",
    description:
      "Turn questions into formal RFIs, track responses, and close them out — tied to the drawing, not buried in email.",
    bullets: [
      "Numbered RFIs with clear status from draft to closed.",
      "Link RFIs to the exact location so answers reference the right detail.",
    ],
  },
  {
    slug: "takeoff",
    title: "Quantity takeoff",
    description:
      "Draw measurement zones on drawings; quantities calculate automatically. Export to CSV or PDF in one click.",
    bullets: [
      "Organize takeoffs by trade or package for cleaner estimates.",
      "Revisit quantities anytime as drawings change — history stays with the project.",
    ],
  },
] as const;

/** Section heading copy for the solutions grid on the homepage. */
export const LANDING_SOLUTIONS_SECTION = {
  eyebrow: "Solutions",
  title: "What PlanSync solves",
  description:
    "Whether you are checking a detail alone or coordinating a whole project, PlanSync connects drawings, field feedback, and formal RFIs in one place.",
} as const;

/** Section heading for the “How it works” band. */
export const LANDING_HOW_IT_WORKS_SECTION = {
  eyebrow: "How it works",
  title: "From PDF to project clarity",
  description:
    "Start alone on Free, then invite your team to Pro when drawings, issues, and RFIs need to live in one place.",
} as const;

/** Short steps for the “How it works” band on the homepage. */
export const LANDING_HOW_IT_WORKS = [
  {
    title: "Bring your plans",
    body: "Open PDFs in the free viewer instantly, or upload to Pro when your whole team needs one shared set of sheets.",
  },
  {
    title: "Mark up and measure",
    body: "Calibrate scale, take measurements, and annotate — the same precision whether you are in the trailer or at your desk.",
  },
  {
    title: "Coordinate in Pro",
    body: "Drop issues on the drawing, run RFIs with a real workflow, and keep everyone looking at the same revision.",
  },
  {
    title: "Close the loop",
    body: "Track status from field to answer, export takeoffs and marked sheets, and walk the job with confidence.",
  },
] as const;

/** Extra bullets under each long-form feature row (matches feature slugs). */
export const LANDING_FEATURE_BULLETS = {
  viewer: [
    "No account required for Free — open a PDF and start working.",
    "Snap-friendly tools for lengths, areas, and callouts on real construction sets.",
  ],
  issues: [
    "Filter and sort by assignee, priority, or trade so nothing slips through.",
    "Photo attachments and comments stay next to the pin, not in a separate thread.",
  ],
  rfis: [
    "Ball-in-court stays visible so nothing stalls waiting on the wrong person.",
    "Formal numbering and history you can hand to owners or inspectors.",
  ],
  takeoff: [
    "Color-coded zones make it obvious what was measured where.",
    "Roll up quantities by layer or category for bids and change orders.",
  ],
} as const;

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
