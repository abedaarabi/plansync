"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { ArrowRight, Loader2, Upload } from "lucide-react";
import { PdfFileIcon } from "@/components/icons/PdfFileIcon";
import { workspaceGateUrl } from "@/lib/workspacePreference";

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = (step / total) * 100;
  return (
    <div className="mb-8 w-full">
      <div className="mb-2 flex items-center justify-between text-[13px] font-medium text-slate-400">
        <span className="tabular-nums">
          Step {step} of {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-[#2563EB] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextDefault = sp.get("next") ?? "/dashboard";
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState("");
  const [projectName, setProjectName] = useState("");
  const [uploading, setUploading] = useState(false);

  const finish = useCallback(() => {
    try {
      localStorage.setItem("plansync-onboarding-complete", "1");
    } catch {
      /* ignore */
    }
    const path = nextDefault.startsWith("/") ? nextDefault : "/dashboard";
    router.push(workspaceGateUrl(path));
  }, [nextDefault, router]);

  const onDropZone = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setUploading(true);
      window.setTimeout(() => {
        setUploading(false);
        finish();
      }, 800);
    },
    [finish],
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--enterprise-auth-bg)] font-[family-name:var(--font-inter)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 85% 55% at 50% -25%, rgba(59, 130, 246, 0.2), transparent 55%), radial-gradient(ellipse 100% 60% at 100% 100%, rgba(15, 23, 42, 0.3), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-[440px]">
          <ProgressBar step={step} total={3} />

          {step === 1 && (
            <div
              className="border border-slate-200/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8"
              style={{ borderRadius: "16px" }}
            >
              <h1 className="text-2xl font-bold text-[#0F172A]">Welcome to PlanSync 👋</h1>
              <p className="mt-2 text-[14px] text-[#64748B]">Let&apos;s set up your workspace</p>
              <label className="mt-8 block text-[13px] font-medium text-[#64748B]">
                Company name
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Construction"
              />
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d4ed8]"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div
              className="border border-slate-200/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8"
              style={{ borderRadius: "16px" }}
            >
              <h1 className="text-2xl font-bold text-[#0F172A]">Create your first project</h1>
              <p className="mt-2 text-[14px] text-[#64748B]">
                Projects hold your drawings and team
              </p>
              <label className="mt-8 block text-[13px] font-medium text-[#64748B]">
                Project name
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Tower Block A"
              />
              <button
                type="button"
                onClick={() => setStep(3)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d4ed8]"
              >
                Create Project
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="mt-4 w-full text-center text-sm text-[#64748B] transition hover:text-[#0F172A]"
              >
                Skip for now →
              </button>
            </div>
          )}

          {step === 3 && (
            <div
              className="border border-slate-200/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8"
              style={{ borderRadius: "16px" }}
            >
              <h1 className="text-2xl font-bold text-[#0F172A]">Upload your first drawing</h1>
              <p className="mt-2 text-[14px] text-[#64748B]">Drop a PDF plan to get started</p>
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={onDropZone}
                onClick={() => {
                  setUploading(true);
                  window.setTimeout(() => {
                    setUploading(false);
                    finish();
                  }, 800);
                }}
                className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-14 text-center transition hover:border-[#2563EB]/50 hover:bg-[#F1F5F9]"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#2563EB]/10">
                  <PdfFileIcon className="h-9 w-9" />
                </div>
                <p className="text-sm font-medium text-[#0F172A]">Drop PDF here</p>
                <p className="mt-1 text-sm text-[#64748B]">or click to browse</p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => {
                  setUploading(true);
                  window.setTimeout(() => {
                    setUploading(false);
                    finish();
                  }, 800);
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1d4ed8] disabled:opacity-70"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload PDF
              </button>
              <button
                type="button"
                onClick={finish}
                className="mt-4 w-full text-center text-sm text-[#64748B] transition hover:text-[#0F172A]"
              >
                Skip for now →
              </button>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link href={workspaceGateUrl("/dashboard")} className="hover:text-slate-300">
              Skip onboarding
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--enterprise-auth-bg)] font-[family-name:var(--font-inter)] text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
