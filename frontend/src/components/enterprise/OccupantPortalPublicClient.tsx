"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Camera, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  completeOccupantIssueReferencePhoto,
  fetchOccupantMeta,
  postOccupantSubmit,
  presignOccupantIssueReferencePhoto,
} from "@/lib/api-client";

const ALLOWED_OCCUPANT_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "",
]);

type Props = { token: string; initialAssetSecret?: string };

type Phase = "form" | "done";

export function OccupantPortalPublicClient({ token, initialAssetSecret }: Props) {
  const assetSecret = initialAssetSecret?.trim() || undefined;

  const [description, setDescription] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");

  const {
    data: meta,
    isPending,
    error,
  } = useQuery({
    queryKey: ["occupantMeta", token, assetSecret ?? ""],
    queryFn: () => fetchOccupantMeta(token, { assetSecret }),
    retry: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !reporterName.trim() || !reporterEmail.trim()) {
      toast.error("Please fill in description, your name, and email.");
      return;
    }
    setSubmitting(true);
    setUploadStep(null);
    try {
      const res = await postOccupantSubmit(token, {
        description: description.trim(),
        floor: floor.trim() || undefined,
        room: room.trim() || undefined,
        reporterName: reporterName.trim(),
        reporterEmail: reporterEmail.trim(),
        assetSecret,
      });

      const list = photoFiles;
      if (list.length === 0) {
        setPhase("done");
        toast.success("Your request was submitted.");
        return;
      }

      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        setUploadStep(`Uploading photo ${i + 1} of ${list.length}…`);
        const ct = (file.type || "application/octet-stream").toLowerCase();
        if (!ALLOWED_OCCUPANT_PHOTO_TYPES.has(ct)) {
          toast.error(`${file.name}: use a JPEG, PNG, WebP, GIF, or HEIC image.`);
          setUploadStep(null);
          setSubmitting(false);
          return;
        }
        const presign = await presignOccupantIssueReferencePhoto(token, res.issueId, {
          occupantPhotoToken: res.occupantPhotoToken,
          fileName: file.name,
          contentType: ct || "application/octet-stream",
          sizeBytes: file.size,
        });
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": ct || "application/octet-stream" },
        });
        if (!put.ok) {
          throw new Error(`Upload failed for ${file.name}.`);
        }
        await completeOccupantIssueReferencePhoto(token, res.issueId, {
          occupantPhotoToken: res.occupantPhotoToken,
          key: presign.key,
          fileName: file.name,
          contentType: ct || "image/jpeg",
          sizeBytes: file.size,
        });
      }
      setUploadStep(null);
      setPhase("done");
      toast.success("Your request and photos were submitted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
      setUploadStep(null);
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-sm text-[var(--enterprise-text-muted)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--enterprise-primary)]" aria-hidden />
        Loading…
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-[var(--enterprise-error)]">
          {error instanceof Error ? error.message : "This link is not valid."}
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12 text-center sm:py-16">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)] text-[var(--enterprise-success)]">
          <Send className="h-7 w-7" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-semibold text-[var(--enterprise-text)]">Thank you</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
          Your request for{" "}
          <strong className="font-medium text-[var(--enterprise-text)]">{meta.projectName}</strong>{" "}
          was submitted. Check your email for a confirmation. The facilities team may follow up if
          more detail is needed.
        </p>
      </div>
    );
  }

  const title = meta.occupantHeadline?.trim() || meta.projectName || "Report an issue";

  return (
    <div className="mx-auto w-full max-w-lg min-w-0 px-4 py-8 sm:py-14">
      <div className="mb-8 flex min-w-0 items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] text-[var(--enterprise-primary)] shadow-[var(--enterprise-shadow-xs)]">
          <Building2 className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Building — {meta.projectName}
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-[var(--enterprise-text)]">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--enterprise-text-muted)]">
            Report a maintenance issue for this site. No account required. Please describe what you
            noticed and add a photo if it helps.
          </p>
        </div>
      </div>

      {meta.asset ? (
        <div className="enterprise-card mb-6 px-4 py-3 text-sm shadow-[var(--enterprise-shadow-xs)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
            Equipment
          </p>
          <p className="mt-1 font-medium text-[var(--enterprise-text)]">
            <span className="font-mono">{meta.asset.tag}</span>
            <span className="font-normal text-[var(--enterprise-text-muted)]"> — </span>
            {meta.asset.name}
          </p>
          {meta.asset.locationLabel?.trim() ? (
            <p className="mt-1 text-[var(--enterprise-text-muted)]">
              {meta.asset.locationLabel.trim()}
            </p>
          ) : null}
          {meta.asset.category?.trim() ? (
            <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
              {meta.asset.category.trim()}
            </p>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--enterprise-text)]">
            What is the issue?
          </span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="min-h-[7.5rem] w-full max-w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-base text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] placeholder:text-[var(--enterprise-text-muted)] sm:min-h-[120px] sm:text-sm"
            placeholder="Describe the problem…"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex items-center gap-2 font-medium text-[var(--enterprise-text)]">
            <Camera className="h-4 w-4 text-[var(--enterprise-text-muted)]" aria-hidden />
            Photos (optional)
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
            multiple
            onChange={(e) => setPhotoFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-[var(--enterprise-text)] file:mr-3 file:rounded-lg file:border file:border-[var(--enterprise-border)] file:bg-[var(--enterprise-surface)] file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--enterprise-text)]">
              Floor (optional)
            </span>
            <input
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-[var(--enterprise-text)]">
              Room (optional)
            </span>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--enterprise-text)]">Your name</span>
          <input
            required
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--enterprise-text)]">Email</span>
          <input
            required
            type="email"
            value={reporterEmail}
            onChange={(e) => setReporterEmail(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm"
          />
        </label>
        {uploadStep ? (
          <p className="flex items-center gap-2 text-xs text-[var(--enterprise-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {uploadStep}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-xl bg-[var(--enterprise-primary)] px-4 text-base font-semibold text-white shadow-sm disabled:opacity-50 sm:text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {uploadStep ? "Uploading…" : "Sending…"}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit request
            </>
          )}
        </button>
      </form>
    </div>
  );
}
