import { STORY_TIME_LEAKS } from "@/lib/storyPresentationContent";

export function StoryTimeLeakChart() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--story-line)] bg-[var(--story-panel)] p-5 shadow-sm sm:p-6">
      <h3 className="text-base font-bold tracking-tight text-[var(--story-ink)]">
        Where the hours go
      </h3>
      <p className="mt-1 text-sm text-[var(--story-muted)]">
        A pattern we see on complex projects (illustrative)
      </p>
      <div className="mt-4 flex h-9 overflow-hidden rounded-xl border border-[var(--story-line)]">
        {STORY_TIME_LEAKS.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-center text-[10px] font-semibold text-white sm:text-xs"
            style={{ width: `${item.pct}%`, backgroundColor: item.color }}
            title={`${item.label}: ${item.pct}%`}
          >
            {item.pct}%
          </div>
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {STORY_TIME_LEAKS.map((item) => (
          <li
            key={item.label}
            className="grid grid-cols-[0.7rem_1fr_auto] items-center gap-2.5 text-sm text-[var(--story-muted)]"
          >
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>{item.label}</span>
            <span className="font-semibold tabular-nums text-[var(--story-ink)]">{item.pct}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[var(--story-muted)]">Which slice feels familiar?</p>
    </div>
  );
}

export function StoryHandoverGapChart() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--story-line)] bg-[var(--story-panel)] p-5 shadow-sm sm:p-6">
      <h3 className="text-base font-bold tracking-tight text-[var(--story-ink)]">
        And then handover waits… until it can’t
      </h3>
      <p className="mt-1 text-sm text-[var(--story-muted)]">
        The building finishes. The asset story catches up last.
      </p>
      <div className="mt-3 min-h-[12rem] flex-1">
        <svg viewBox="0 0 420 220" className="h-full w-full" role="img" aria-hidden>
          <defs>
            <linearGradient id="storyGapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1="48"
            y1="20"
            x2="48"
            y2="170"
            stroke="currentColor"
            className="text-[var(--story-line)]"
          />
          <line
            x1="48"
            y1="170"
            x2="400"
            y2="170"
            stroke="currentColor"
            className="text-[var(--story-line)]"
          />
          <line
            x1="48"
            y1="120"
            x2="400"
            y2="120"
            stroke="currentColor"
            opacity="0.45"
            className="text-[var(--story-line)]"
          />
          <line
            x1="48"
            y1="70"
            x2="400"
            y2="70"
            stroke="currentColor"
            opacity="0.45"
            className="text-[var(--story-line)]"
          />
          <text
            x="8"
            y="24"
            fill="currentColor"
            fontSize="11"
            className="text-[var(--story-faint)]"
          >
            100%
          </text>
          <text
            x="14"
            y="174"
            fill="currentColor"
            fontSize="11"
            className="text-[var(--story-faint)]"
          >
            0%
          </text>
          <text
            x="48"
            y="192"
            fill="currentColor"
            fontSize="11"
            className="text-[var(--story-faint)]"
          >
            Start
          </text>
          <text
            x="175"
            y="192"
            fill="currentColor"
            fontSize="11"
            className="text-[var(--story-faint)]"
          >
            Mid build
          </text>
          <text
            x="318"
            y="192"
            fill="currentColor"
            fontSize="11"
            className="text-[var(--story-faint)]"
          >
            Handover
          </text>
          <path
            d="M48,155 C120,150 180,140 240,125 C300,108 350,95 400,40
               L400,145 C350,148 300,150 240,152 C180,154 120,155 48,155 Z"
            fill="url(#storyGapFill)"
          />
          <path
            d="M48,155 C120,145 180,120 240,85 C300,55 350,35 400,22"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M48,155 C120,154 180,152 240,150 C300,148 350,146 380,145 L400,40"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 5"
          />
          <circle cx="392" cy="48" r="4" fill="#f59e0b" />
          <text x="300" y="48" fill="#fbbf24" fontSize="11" fontWeight="600">
            Late scramble
          </text>
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--story-muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-sky-500" aria-hidden />
          Construction progress
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-0.5 w-4 rounded-full"
            style={{
              background: "repeating-linear-gradient(90deg, #38bdf8 0 4px, transparent 4px 8px)",
            }}
            aria-hidden
          />
          Ops / asset readiness
        </span>
      </div>
      <p className="mt-3 text-xs text-[var(--story-muted)]">
        The blue gap? That’s the scramble. That’s the opportunity.
      </p>
    </div>
  );
}
