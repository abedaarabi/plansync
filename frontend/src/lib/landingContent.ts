/** Single source for landing FAQ — UI + FAQPage JSON-LD stay in sync. */

export const SOLUTION_CATEGORIES = {
  construction: {
    slug: "construction" as const,
    label: "Construction",
    tagline: "Job site to office",
    description:
      "Plans, issues, RFIs, quantity takeoff, schedules, PDF revision control, and secure cloud storage for project files — everything your team needs from design to delivery.",
    accentClass: "blue",
  },
  operations: {
    slug: "operations" as const,
    label: "Operations & FM",
    tagline: "Handover to daily ops",
    description:
      "From structured O&M handover to daily facilities management — one platform for the full building lifecycle.",
    accentClass: "teal",
  },
} as const;

export type SolutionCategory = keyof typeof SOLUTION_CATEGORIES;

export const LANDING_SOLUTIONS = [
  {
    slug: "viewer",
    category: "construction" as SolutionCategory,
    tagline: "Measure & annotate any PDF",
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
    category: "construction" as SolutionCategory,
    tagline: "Track issues on the drawing",
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
    category: "construction" as SolutionCategory,
    tagline: "Formal process, not email",
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
    category: "construction" as SolutionCategory,
    tagline: "Auto-calculate quantities",
    title: "Quantity takeoff",
    description:
      "Draw measurement zones on drawings; quantities calculate automatically. Export to CSV or PDF in one click.",
    bullets: [
      "Organize takeoffs by trade or package for cleaner estimates.",
      "Revisit quantities anytime as drawings change — history stays with the project.",
    ],
  },
  {
    slug: "audit",
    category: "construction" as SolutionCategory,
    tagline: "Systematic site quality checks",
    title: "Site audit",
    description:
      "Conduct structured site audits against your drawings, capture non-conformances with photos, assign corrective actions, and produce timestamped audit reports in one workflow.",
    bullets: [
      "Non-conformances are tied to exact drawing locations and assigned owners.",
      "Every audit produces a signed-off, exportable record for clients and regulators.",
    ],
  },
  {
    slug: "proposal",
    category: "construction" as SolutionCategory,
    tagline: "Win bids with professional docs",
    title: "Proposals",
    description:
      "Build competitive proposals directly from your takeoff data. Compile drawings, specs, and pricing into polished bid documents your clients trust.",
    bullets: [
      "Quantities from takeoff flow straight into proposal line items — no re-entry.",
      "Professional PDF output keeps your brand consistent across every bid.",
    ],
  },
  {
    slug: "cloud-storage",
    category: "construction" as SolutionCategory,
    tagline: "Team files in one secure place",
    title: "Cloud storage",
    description:
      "Pro projects live in encrypted cloud storage your workspace controls. One source of truth for drawings, issues, and RFIs — with access limited to your team and transfers protected in transit.",
    bullets: [
      "Files are stored in your account’s cloud — not scattered across inboxes or local drives.",
      "Encryption in transit and at rest; only invited members of your workspace can open project data.",
    ],
  },
  {
    slug: "pdf-version-control",
    category: "construction" as SolutionCategory,
    tagline: "Always the right sheet revision",
    title: "PDF version control",
    description:
      "Upload new drawing revisions with clear version labels, compare what changed, and keep field and office on the same approved set — without digging through renamed email attachments.",
    bullets: [
      "Each upload is tracked with who uploaded it and when, so the audit trail matches how you work on site.",
      "Open the current revision by default while still being able to review older sets when claims or RFIs reference them.",
    ],
  },
  {
    slug: "schedule",
    category: "construction" as SolutionCategory,
    tagline: "Milestones the whole team can see",
    title: "Project schedule",
    description:
      "Lay out key phases, milestones, and lookahead windows next to your drawings and issues so supers, subs, and the office share one timeline — not three different spreadsheets.",
    bullets: [
      "Link schedule lines to areas or packages so delays are easy to explain with context from the plan.",
      "Status and dates stay visible in the workspace so Friday email chains are not the only source of truth.",
    ],
  },
  {
    slug: "om-handover",
    category: "operations" as SolutionCategory,
    tagline: "Structured closeout packages",
    title: "O&M + handover",
    description:
      "Close projects with confidence by handing over structured O&M records, linked assets, and recurring inspections in one workflow.",
    bullets: [
      "Handover packages stay tied to the right assets, documents, and spaces.",
      "Teams move from construction to operations without rebuilding data in a new tool.",
    ],
  },
  {
    slug: "om-assets",
    category: "operations" as SolutionCategory,
    tagline: "Searchable asset database",
    title: "Asset register",
    description:
      "Track maintainable assets with locations, metadata, manuals, and warranty context so FM teams can act faster after handover.",
    bullets: [
      "Each asset keeps documents, notes, and history in one place.",
      "Search and filter by area, category, or system to find equipment quickly.",
    ],
  },
  {
    slug: "om-maintenance",
    category: "operations" as SolutionCategory,
    tagline: "Prevent failures before they happen",
    title: "Maintenance",
    description:
      "Plan preventive work, manage recurring tasks, and keep service records current so planned maintenance does not slip.",
    bullets: [
      "Recurring schedules help teams stay ahead of reactive failures.",
      "Maintenance history remains auditable across the full asset lifecycle.",
    ],
  },
  {
    slug: "om-work-orders",
    category: "operations" as SolutionCategory,
    tagline: "Assign, track, and close",
    title: "Work orders",
    description:
      "Turn maintenance needs into trackable work orders with status, assignees, and due dates your team can actually follow.",
    bullets: [
      "Prioritize and route work with clear ownership from open to closed.",
      "Comments and updates stay attached to the task for full traceability.",
    ],
  },
  {
    slug: "om-inspections",
    category: "operations" as SolutionCategory,
    tagline: "Templates for compliance",
    title: "Inspections",
    description:
      "Run repeatable inspection templates, capture findings in the field, and keep compliance evidence organized over time.",
    bullets: [
      "Reusable templates standardize checks across sites and teams.",
      "Inspection runs produce a clear record of findings and actions.",
    ],
  },
  {
    slug: "om-tenant-portal",
    category: "operations" as SolutionCategory,
    tagline: "Structured occupant requests",
    title: "Tenant portal",
    description:
      "Give occupants a simple channel for reporting issues and viewing updates while your team manages everything in one place.",
    bullets: [
      "Requests arrive structured instead of scattered across email and calls.",
      "Status visibility reduces back-and-forth and improves response clarity.",
    ],
  },
  {
    slug: "om-fm-dashboard",
    category: "operations" as SolutionCategory,
    tagline: "Live operational overview",
    title: "FM dashboard",
    description:
      "Monitor asset health, open work, inspection activity, and operational priorities from a single facilities dashboard.",
    bullets: [
      "See operational workload and bottlenecks at a glance.",
      "Use live metrics to focus teams on the highest-impact actions.",
    ],
  },
] as const;

export function getSolutionsByCategory(category: SolutionCategory) {
  return LANDING_SOLUTIONS.filter((s) => s.category === category);
}

export type SolutionSlug = (typeof LANDING_SOLUTIONS)[number]["slug"];

export type LandingSolution = (typeof LANDING_SOLUTIONS)[number];

export const LANDING_SOLUTION_SLUGS = LANDING_SOLUTIONS.map((s) => s.slug) as SolutionSlug[];

export function getSolution(slug: string): LandingSolution | undefined {
  return LANDING_SOLUTIONS.find((s) => s.slug === slug);
}

export function isSolutionSlug(slug: string): slug is SolutionSlug {
  return LANDING_SOLUTIONS.some((s) => s.slug === slug);
}

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
  "om-handover": [
    "Package asset records, documents, and operational data for smooth turnover.",
    "Keep O&M information structured so operators can use it from day one.",
  ],
  "om-assets": [
    "Centralized asset cards with manuals, warranty files, and key metadata.",
    "Location-aware organization makes site-wide asset lookup simple.",
  ],
  "om-maintenance": [
    "Preventive plans and recurring tasks reduce unplanned downtime risk.",
    "Completed work logs build a reliable maintenance audit trail.",
  ],
  "om-work-orders": [
    "Create, assign, and close work orders with clear accountability.",
    "Track progress, notes, and outcomes without leaving the platform.",
  ],
  "om-inspections": [
    "Template-based inspections keep standards consistent across buildings.",
    "Findings and follow-ups are captured in a structured, repeatable format.",
  ],
  "om-tenant-portal": [
    "Occupants submit requests through a clear, guided portal flow.",
    "Operations teams respond with transparent status updates and history.",
  ],
  "om-fm-dashboard": [
    "Dashboard KPIs highlight workload, overdue items, and active risk areas.",
    "Operational teams align quickly with a shared live view of priorities.",
  ],
  takeoff: [
    "Color-coded zones make it obvious what was measured where.",
    "Roll up quantities by layer or category for bids and change orders.",
  ],
  audit: [
    "Reusable audit templates enforce consistent quality standards across every site.",
    "Corrective action tracking moves non-conformances from raised to closed with a clear owner.",
  ],
  proposal: [
    "Proposal templates keep bid documents consistent and professional across every project.",
    "Linked quantities update automatically when drawing revisions or scope changes come in.",
  ],
  "cloud-storage": [
    "Drawings and project data stay tied to the workspace — revoke access when someone leaves the team.",
    "Upgrade from Free’s local-only viewer without losing context: your team shares one cloud-backed set of sheets.",
  ],
  "pdf-version-control": [
    "Revision labels and history make it obvious which PDF is current for each discipline or area.",
    "Issues, RFIs, and takeoffs stay linked to the sheet version they were raised against — less rework when drawings update.",
  ],
  schedule: [
    "Roll up milestones by trade or zone so coordination meetings start from the same dates.",
    "Slip a finish date and everyone sees the impact — without exporting another PDF of the Gantt chart.",
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
