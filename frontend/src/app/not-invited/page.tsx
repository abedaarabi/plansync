import Link from "next/link";
import Image from "next/image";

export default function NotInvitedPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--enterprise-auth-bg)] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.32]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(37, 99, 235, 0.24), transparent 55%), radial-gradient(ellipse 95% 55% at 100% 100%, rgba(15, 23, 42, 0.35), transparent)",
        }}
        aria-hidden
      />

      <section className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200/10 bg-white/95 p-7 shadow-2xl shadow-black/35 sm:p-8">
        <div className="mb-5 flex justify-start">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-900/10 ring-1 ring-slate-200/70">
            <Image
              src="/logo.svg"
              alt="PlanSync"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          You are not invited to this project
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This link points to a project or sheet you do not have access to. Ask a project admin to
          invite you, then open the link again.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
          >
            Go to my projects
          </Link>
          <Link
            href="/sign-in"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Sign in with another account
          </Link>
        </div>
      </section>
    </main>
  );
}
