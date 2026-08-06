/** Storytelling deck for the public /story marketing page (English). */

export const STORY_TIME_LEAKS = [
  { label: "Chasing people in email", pct: 35, color: "#64748b" },
  { label: "Finding the right drawing", pct: 28, color: "#94a3b8" },
  { label: "Following up RFIs & punch", pct: 22, color: "#f59e0b" },
  { label: "Actually deciding together", pct: 15, color: "#2563eb" },
] as const;

export const STORY_ASSET_ROWS = [
  { tag: "AHU-01", docs: "4 documents" },
  { tag: "CHWP-03", docs: "4 documents" },
  { tag: "FD-2F-17", docs: "4 documents" },
] as const;

export const STORY_SLIDES = [
  {
    id: "opening" as const,
    chromeTitle: "The opening",
    label: "Working session",
    eyebrow: "A short story",
    title: "The building is ready. The project isn’t.",
    sub: "This is about what happens between first drawing and day-one ops — and how that middle gets messy.",
    meta: [
      { label: "Act 1", body: "The mess in the middle" },
      { label: "Act 2", body: "What “done” should feel like" },
      { label: "Act 3", body: "How PlanSync helps" },
    ],
    image: "/images/cta/CTA-constraction-hero.webp",
  },
  {
    id: "agenda" as const,
    chromeTitle: "How the story goes",
    label: "~25 minutes",
    title: "How the story goes",
    items: [
      { n: "01", title: "Something breaks in the middle", time: "~4 min" },
      { n: "02", title: "Why it keeps happening", time: "~3 min" },
      { n: "03", title: "A better ending", time: "~3 min" },
      { n: "04", title: "PlanSync enters the story", time: "~8 min" },
      { n: "05", title: "Your turn — what fits your world", time: "~5 min" },
    ],
  },
  {
    id: "problem" as const,
    chromeTitle: "Act 1 · the mess",
    label: "Act 1",
    eyebrow: "Once upon a build",
    title: "The site gets smarter. The paperwork doesn’t.",
    lede: "Steel goes up. Systems get complex. And somehow the “source of truth” is still a folder, a thread, and someone’s memory.",
    problems: [
      {
        n: "01",
        title: "Too many “latest” drawings",
        body: "Trades move fast. Revisions don’t keep up.",
      },
      {
        n: "02",
        title: "Answers disappear",
        body: "RFIs and markups live in email — until the people leave.",
      },
      {
        n: "03",
        title: "Handover becomes a fire drill",
        body: "Ops walks in… and has to rebuild the story.",
      },
    ],
    image: "/images/3dviewer.webp",
    imageCaption: "The model is clear. The process often isn’t.",
  },
  {
    id: "charts" as const,
    chromeTitle: "Act 1 · the twist",
    label: "Act 1 · continued",
    eyebrow: "Here’s the twist",
    title: "Most of the time isn’t building. It’s hunting.",
  },
  {
    id: "desired" as const,
    chromeTitle: "Act 2 · imagine",
    label: "Act 2",
    eyebrow: "Imagine instead",
    title: "One story. From first sheet to ops day one.",
    flow: [
      {
        tag: "Build",
        title: "Everyone on the same page",
        body: "One set of drawings. Markups live there.",
      },
      {
        tag: "Decide",
        title: "Questions that actually close",
        body: "RFIs and punch have owners — and an ending.",
      },
      {
        tag: "Hand over",
        title: "Ops inherits a clean story",
        body: "Assets and docs arrive ready — not rebuilt.",
      },
    ],
    footer: "That’s the ending we want. Next: how PlanSync gets you there.",
  },
  {
    id: "howItWorks" as const,
    chromeTitle: "Act 3 · PlanSync",
    label: "Act 3",
    eyebrow: "Enter PlanSync",
    title: "Four beats. Same project. No plot holes.",
    steps: [
      {
        n: "1",
        title: "Start here",
        body: "Drawings and models land in one workspace.",
      },
      {
        n: "2",
        title: "Work together",
        body: "Mark up. Pin issues. Run RFIs. Close punch.",
      },
      {
        n: "3",
        title: "Finish clean",
        body: "Clash early. Own the open items. Commission with eyes open.",
      },
      {
        n: "4",
        title: "Pass it on",
        body: "Assets and manuals go with the building — not into a black hole.",
      },
    ],
  },
  {
    id: "value" as const,
    chromeTitle: "Act 3 · the tools",
    label: "Act 3 · the tools",
    eyebrow: "What you get",
    title: "Fewer lost chapters. More finished ones.",
    values: [
      {
        title: "The right drawing",
        body: "Always the current sheet — with markups on it.",
      },
      { title: "RFIs that end", body: "Asked, answered, remembered." },
      {
        title: "Clash before chaos",
        body: "Find conflicts while change is still cheap.",
      },
      {
        title: "A handoff that sticks",
        body: "Ops gets the story, not a scavenger hunt.",
      },
    ],
    image: "/images/measure.png",
    imageCaption: "On the sheet. Not in the inbox.",
  },
  {
    id: "assets" as const,
    chromeTitle: "The last chapter",
    label: "The last chapter",
    eyebrow: "Day one of ops",
    title: "AHU-01 shouldn’t be a mystery.",
    lede: "When the building goes live, every asset already has a name, a home, and its documents.",
    panels: [
      {
        title: "Docs stay put",
        body: "Manuals live on the asset — not in a zip file.",
      },
      {
        title: "Born from handover",
        body: "Closeout writes the register. Nobody retypes it.",
      },
      {
        title: "Ready to work",
        body: "Maintenance starts from real tags.",
      },
    ],
    assetCount: "248 assets",
  },
  {
    id: "outcomes" as const,
    chromeTitle: "The rewrite",
    label: "The rewrite",
    eyebrow: "Same project. Different ending.",
    title: "Before the scramble. After the clarity.",
    outcomes: [
      {
        label: "Drawings",
        before: "Before: “Which file is latest?”",
        after: "After: One set. Everyone on it.",
      },
      {
        label: "RFIs & punch",
        before: "Before: Lost in email.",
        after: "After: Asked → answered → closed.",
      },
      {
        label: "Commissioning",
        before: "Before: Surprises at the finish line.",
        after: "After: Issues caught while change is cheap.",
      },
      {
        label: "Handover",
        before: "Before: Ops rebuilds from PDFs.",
        after: "After: Assets arrive with their docs.",
      },
    ],
  },
  {
    id: "pilot" as const,
    chromeTitle: "Next chapter",
    label: "Next chapter",
    eyebrow: "Start small",
    title: "One project. One clear test.",
    steps: [
      {
        title: "Pick a live build",
        body: "Somewhere the mess is already visible.",
      },
      {
        title: "Put drawings, RFIs, and punch in one place",
        body: "Core team first. Partners next.",
      },
      {
        title: "Agree what “handed over” means",
        body: "Which assets. Which docs. What’s open.",
      },
      {
        title: "Check in after 4–6 weeks",
        body: "Less hunting. More closing.",
      },
    ],
    image: "/images/clash.webp",
    imageCaption: "Fewer late-plot twists",
  },
  {
    id: "questions" as const,
    chromeTitle: "Your turn",
    label: "Your turn",
    eyebrow: "Tell us your version",
    title: "Where does this story break for you?",
    questions: [
      {
        q: "Where is “the truth” today?",
        a: "Folders, email, someone’s head…",
      },
      {
        q: "What snaps first when it gets busy?",
        a: "Revisions? Vendors? Closeout?",
      },
      { q: "Who feels it most?", a: "Site, PMO, engineering, or ops." },
      { q: "What does a good handover look like?", a: "In your words." },
      { q: "Do late clashes still surprise you?", a: "" },
      { q: "What would a fair 60-day test be?", a: "" },
    ],
  },
  {
    id: "close" as const,
    chromeTitle: "The end · for now",
    label: "The end · for now",
    eyebrow: "Write the next page together",
    title: "Less hunting. Cleaner handovers.",
    closeLine: "Keep the building story in one place — from first drawing to AHU-01.",
    meta: [
      { label: "Next", body: "Name one project to try" },
      { label: "Or", body: "Walk the product live" },
      { label: "Win", body: "Less chaos. Clearer closeout." },
    ],
  },
] as const;

export type StorySlide = (typeof STORY_SLIDES)[number];
