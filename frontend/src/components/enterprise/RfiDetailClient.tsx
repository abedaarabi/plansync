"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  BadgeCheck,
  Ban,
  Calendar,
  Camera,
  ChevronLeft,
  CircleCheck,
  CircleDot,
  Clock,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Loader2,
  MapPin,
  MessageSquare,
  Music,
  Paperclip,
  PencilLine,
  PlusCircle,
  Presentation,
  RotateCcw,
  Send,
  Trash2,
  Unlink2,
  User,
  X,
} from "lucide-react";
import { EnterpriseMemberMultiPicker } from "@/components/enterprise/EnterpriseMemberMultiPicker";
import { DeleteRfiConfirmDialog } from "@/components/enterprise/DeleteRfiConfirmDialog";
import { DeleteRfiAttachmentConfirmDialog } from "@/components/enterprise/DeleteRfiAttachmentConfirmDialog";
import { DeleteRecordedAnswerConfirmDialog } from "@/components/enterprise/DeleteRecordedAnswerConfirmDialog";
import { RfiTimelineDialog } from "@/components/enterprise/RfiTimelineDialog";
import { RfiAttachmentLightbox } from "@/components/enterprise/RfiAttachmentLightbox";
import { RfiDiscussionRichEditor } from "@/components/enterprise/RfiDiscussionRichEditor";
import { RfiDiscussionMessageItem } from "@/components/enterprise/RfiDiscussionMessageItem";
import { RfiMessageHtmlBody } from "@/components/enterprise/RfiMessageHtmlBody";
import { EnterpriseLoadingState } from "@/components/enterprise/EnterpriseLoadingState";
import { useEnterpriseWorkspace } from "@/components/enterprise/EnterpriseWorkspaceContext";
import {
  completeRfiAttachmentUpload,
  deleteProjectRfi,
  deleteRfiAttachment,
  fetchIssuesForProject,
  fetchMe,
  fetchProjectRfi,
  fetchProjectTeam,
  fetchRfiActivity,
  fetchRfiMessages,
  HttpError,
  patchProjectRfi,
  postRfiMessage,
  presignReadRfiAttachment,
  presignRfiAttachmentUpload,
  ProRequiredError,
  viewerHrefForRfi,
  type RfiActivityRow,
  type RfiAttachmentRow,
  type RfiIssueRef,
  type RfiMessageRow,
  type RfiRow,
} from "@/lib/api-client";
import {
  priorityBadgeClassLight,
  RFI_STATUS_LABEL,
  rfiStatusBadgeClass,
} from "@/lib/issueStatusStyle";
import { qk } from "@/lib/queryKeys";
import { userInitials } from "@/lib/user-initials";
import { isWorkspaceProClient } from "@/lib/workspaceSubscription";
import { useTickNowMs } from "@/lib/useTickNowMs";

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "_");
}

const OVERDUE_CHIP =
  "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]";

function formatFullDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function riskChipClass(risk: string | null): string {
  if (risk === "high")
    return "border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]";
  if (risk === "med")
    return "border-[var(--enterprise-semantic-warning-border)] bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]";
  if (risk === "low")
    return "border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]";
  return "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]";
}

function viewerHrefForLinkedIssue(
  projectId: string,
  issue: RfiIssueRef,
  fallbackName: string,
): string {
  const q = new URLSearchParams();
  q.set("fileId", issue.fileId);
  q.set("fileVersionId", issue.fileVersionId);
  q.set("projectId", projectId);
  q.set("name", issue.sheetName ?? fallbackName);
  if (issue.sheetVersion != null) q.set("version", String(issue.sheetVersion));
  q.set("issueId", issue.id);
  return `/viewer?${q.toString()}`;
}

function isOverdue(rfi: RfiRow, nowMs: number): boolean {
  if (!rfi.dueDate) return false;
  const st = norm(rfi.status);
  if (st === "ANSWERED" || st === "CLOSED") return false;
  return new Date(rfi.dueDate).getTime() < nowMs;
}

function activityMetaRecord(metadata: unknown): Record<string, unknown> {
  if (metadata != null && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function rfiRefFromMeta(m: Record<string, unknown>): string | null {
  const title = typeof m.title === "string" && m.title.trim() ? m.title.trim() : null;
  const numRaw = m.rfiNumber;
  const num =
    typeof numRaw === "number" ? numRaw : typeof numRaw === "string" ? Number(numRaw) : null;
  const numOk = num != null && Number.isFinite(num);
  if (title && numOk) return `RFI #${String(num).padStart(3, "0")} · ${title}`;
  if (title) return title;
  if (numOk) return `RFI #${String(num).padStart(3, "0")}`;
  return null;
}

/** Timeline icon wells — enterprise semantic palette only (no rainbow Tailwind). */
const ACTIVITY_ICON_WRAP = {
  accent: "bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]",
  info: "bg-[var(--enterprise-semantic-info-bg)] text-[var(--enterprise-semantic-info-text)]",
  success:
    "bg-[var(--enterprise-semantic-success-bg)] text-[var(--enterprise-semantic-success-text)]",
  warning:
    "bg-[var(--enterprise-semantic-warning-bg)] text-[var(--enterprise-semantic-warning-text)]",
  danger: "bg-[var(--enterprise-semantic-danger-bg)] text-[var(--enterprise-semantic-danger-text)]",
  neutral: "bg-[var(--enterprise-hover-surface)] text-[var(--enterprise-text-muted)]",
} as const;

function formatActivityRelative(iso: string, nowMs: number): string {
  const d = new Date(iso);
  const diff = Math.max(0, nowMs - d.getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `Yesterday · ${d.toLocaleTimeString(undefined, { timeStyle: "short" })}`;
  if (days < 7) return `${days} days ago`;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Plain-language headline, optional detail line, and icon styling per event type. */
function describeRfiActivity(row: RfiActivityRow): {
  Icon: LucideIcon;
  iconWrapClass: string;
  headline: string;
  subline: string | null;
} {
  const m = activityMetaRecord(row.metadata);
  const ref = rfiRefFromMeta(m);
  const fileName = typeof m.fileName === "string" && m.fileName.trim() ? m.fileName.trim() : null;

  switch (row.type) {
    case "RFI_CREATED":
      return {
        Icon: PlusCircle,
        iconWrapClass: ACTIVITY_ICON_WRAP.success,
        headline: "RFI created",
        subline: ref
          ? `This request was opened: ${ref}.`
          : "A new request for information was added to the project.",
      };
    case "RFI_SENT_FOR_REVIEW":
      return {
        Icon: Send,
        iconWrapClass: ACTIVITY_ICON_WRAP.info,
        headline: "Sent for review",
        subline: ref
          ? `${ref} was sent to the assignee so they can post the official response.`
          : "The assignee was asked to provide the formal written answer.",
      };
    case "RFI_RESPONSE_SUBMITTED":
      return {
        Icon: BadgeCheck,
        iconWrapClass: ACTIVITY_ICON_WRAP.success,
        headline: "Official response submitted",
        subline: ref
          ? `The written answer was recorded on ${ref}.`
          : "The assignee (or an admin) saved the official response.",
      };
    case "RFI_CLOSED": {
      const voided = m.void === true;
      const reason = typeof m.reason === "string" && m.reason.trim() ? m.reason.trim() : null;
      if (voided) {
        return {
          Icon: Ban,
          iconWrapClass: ACTIVITY_ICON_WRAP.warning,
          headline: "Closed without formal answer",
          subline: reason
            ? `Reason noted: “${reason}”.`
            : "The RFI was ended before an official response was posted (void / withdrawn).",
        };
      }
      return {
        Icon: CircleCheck,
        iconWrapClass: ACTIVITY_ICON_WRAP.neutral,
        headline: "RFI closed",
        subline: ref
          ? `${ref} was marked complete after the official response.`
          : "This RFI was closed after the official answer was recorded.",
      };
    }
    case "RFI_ATTACHMENT_ADDED":
      return {
        Icon: Paperclip,
        iconWrapClass: ACTIVITY_ICON_WRAP.accent,
        headline: "File attached",
        subline: fileName
          ? `“${fileName}” was added to this RFI.`
          : "A new attachment was uploaded.",
      };
    case "RFI_ATTACHMENT_REMOVED":
      return {
        Icon: Unlink2,
        iconWrapClass: ACTIVITY_ICON_WRAP.danger,
        headline: "Attachment removed",
        subline: fileName
          ? `“${fileName}” was removed from this RFI.`
          : "An attachment was deleted from this RFI.",
      };
    case "RFI_MESSAGE_POSTED": {
      const excerpt = typeof m.excerpt === "string" && m.excerpt.trim() ? m.excerpt.trim() : null;
      const who = row.actor?.name?.trim() || "Someone";
      return {
        Icon: MessageSquare,
        iconWrapClass: ACTIVITY_ICON_WRAP.info,
        headline: "Discussion message",
        subline: excerpt ? `${who}: “${excerpt}”` : `${who} posted a message on this RFI.`,
      };
    }
    case "RFI_UPDATED":
      return {
        Icon: PencilLine,
        iconWrapClass: ACTIVITY_ICON_WRAP.neutral,
        headline: "Details updated",
        subline: ref
          ? `Someone edited ${ref} — for example the question, assignee, due date, or linked issues.`
          : "The RFI record was updated.",
      };
    case "RFI_DELETED":
      return {
        Icon: Trash2,
        iconWrapClass: ACTIVITY_ICON_WRAP.danger,
        headline: "RFI deleted",
        subline: ref
          ? `${ref} was permanently removed from the project.`
          : "This RFI was deleted from the project.",
      };
    default:
      return {
        Icon: CircleDot,
        iconWrapClass: ACTIVITY_ICON_WRAP.neutral,
        headline: row.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        subline: null,
      };
  }
}

const cardClass = "enterprise-card p-4 sm:p-5 md:p-6";
const sectionTitle =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--enterprise-text-muted)]";
const bodyProse = "text-[15px] leading-relaxed text-[var(--enterprise-text)] sm:text-base";
const inputClass =
  "w-full rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2.5 text-sm text-[var(--enterprise-text)] focus:border-[var(--enterprise-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--enterprise-primary)]/20";

const MAX_RFI_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Browsers often leave `file.type` empty; S3 presign must match the PUT Content-Type. */
function guessContentType(file: File): string {
  if (file.type && file.type.trim() !== "") return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".heic")) return "image/heic";
  return "application/octet-stream";
}

function fileExtension(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i + 1).toLowerCase();
}

/** True when we can show a real image thumbnail (presigned GET as <img>). */
function isImageAttachment(mimeType: string, fileName: string): boolean {
  if (mimeType.trim().toLowerCase().startsWith("image/")) return true;
  const ext = fileExtension(fileName);
  return ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "svg", "avif"].includes(ext);
}

type AttachmentVisualKind =
  | "image"
  | "pdf"
  | "word"
  | "sheet"
  | "presentation"
  | "archive"
  | "video"
  | "audio"
  | "generic";

function classifyAttachment(
  mimeType: string,
  fileName: string,
): { kind: AttachmentVisualKind; label: string } {
  const ext = fileExtension(fileName);
  const m = mimeType.toLowerCase();
  const extUpper = ext ? ext.toUpperCase() : "";

  if (m.startsWith("image/")) return { kind: "image", label: extUpper || "IMG" };
  if (m === "application/pdf" || ext === "pdf") return { kind: "pdf", label: "PDF" };
  if (
    m.includes("wordprocessingml") ||
    m.includes("msword") ||
    ["doc", "docx", "odt"].includes(ext)
  ) {
    return { kind: "word", label: extUpper || "DOC" };
  }
  if (
    m.includes("spreadsheet") ||
    m.includes("excel") ||
    ["xls", "xlsx", "csv", "ods"].includes(ext)
  ) {
    return { kind: "sheet", label: extUpper || "SHEET" };
  }
  if (m.includes("presentation") || ["ppt", "pptx", "odp"].includes(ext)) {
    return { kind: "presentation", label: extUpper || "PPT" };
  }
  if (m.startsWith("video/") || ["mov", "mp4", "webm", "mkv", "m4v"].includes(ext)) {
    return { kind: "video", label: extUpper || "VIDEO" };
  }
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "flac"].includes(ext)) {
    return { kind: "audio", label: extUpper || "AUDIO" };
  }
  if (
    m.includes("zip") ||
    m.includes("compressed") ||
    ["zip", "rar", "7z", "tar", "gz"].includes(ext)
  ) {
    return { kind: "archive", label: extUpper || "ZIP" };
  }
  if (ext) return { kind: "generic", label: extUpper };
  const parts = m.split("/");
  const sub = parts[1]?.replace(/[^a-z0-9]+/gi, "").slice(0, 6);
  return { kind: "generic", label: sub ? sub.toUpperCase() : "FILE" };
}

function formatAttachmentSize(sizeBytesStr: string): string {
  const n = Number(sizeBytesStr);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10_485_760 ? 1 : 0)} MB`;
}

function RfiAttachmentFormatTile({ kind, label }: { kind: AttachmentVisualKind; label: string }) {
  const common = "h-7 w-7 shrink-0 text-[var(--enterprise-primary)]";
  const icon =
    kind === "pdf" ? (
      <FileText className={common} aria-hidden />
    ) : kind === "word" ? (
      <FileText className={`${common} opacity-90`} aria-hidden />
    ) : kind === "sheet" ? (
      <FileSpreadsheet className={`${common} opacity-90`} aria-hidden />
    ) : kind === "presentation" ? (
      <Presentation className={`${common} opacity-90`} aria-hidden />
    ) : kind === "video" ? (
      <Film className={`${common} opacity-90`} aria-hidden />
    ) : kind === "audio" ? (
      <Music className={`${common} opacity-90`} aria-hidden />
    ) : kind === "archive" ? (
      <Archive className={`${common} opacity-90`} aria-hidden />
    ) : kind === "image" ? (
      <FileImage className={`${common} opacity-90`} aria-hidden />
    ) : (
      <FileIcon
        className={`${common} text-[var(--enterprise-text-muted)] opacity-100`}
        aria-hidden
      />
    );

  return (
    <div
      className="enterprise-hint-tip flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-[var(--enterprise-surface)] to-[var(--enterprise-bg)] px-1 py-1.5"
      data-hint={label}
    >
      {icon}
      <span className="max-w-full truncate px-0.5 text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-[var(--enterprise-text-muted)]">
        {label}
      </span>
    </div>
  );
}

/** Phones / tablets: `<input capture>` opens the real camera. Desktop browsers usually ignore it and show Files — use getUserMedia instead. */
function shouldUseNativeCameraFilePicker(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) return true;
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(hover: none)").matches) return true;
  } catch {
    return true;
  }
  return false;
}

function RfiTakePhotoButton({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamStarting, setWebcamStarting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!webcamOpen) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      return;
    }
    let cancelled = false;
    setWebcamStarting(true);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof DOMException && e.name === "NotAllowedError"
              ? "Camera access was denied. Allow the camera for this site or use Add file."
              : e instanceof DOMException && e.name === "NotFoundError"
                ? "No camera found. Use Add file to pick an image."
                : "Could not open the camera. Use Add file instead.";
          toast.error(msg);
          setWebcamOpen(false);
        }
      } finally {
        if (!cancelled) setWebcamStarting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [webcamOpen]);

  useEffect(() => {
    if (!webcamOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWebcamOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [webcamOpen]);

  const captureFromWebcam = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) {
      toast.error("Wait for the camera preview, then try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture the image.");
          return;
        }
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        setWebcamOpen(false);
        onFile(file);
      },
      "image/jpeg",
      0.88,
    );
  }, [onFile]);

  const onTakePhotoClick = () => {
    if (disabled) return;
    if (shouldUseNativeCameraFilePicker()) {
      cameraInputRef.current?.click();
      return;
    }
    setWebcamOpen(true);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onTakePhotoClick}
        className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--enterprise-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Camera className="h-4 w-4 shrink-0" aria-hidden />
        <span>Take photo</span>
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      {mounted && webcamOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
              role="dialog"
              aria-modal
              aria-labelledby="rfi-webcam-title"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setWebcamOpen(false);
              }}
            >
              <div
                className="w-full max-w-lg rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="rfi-webcam-title"
                    className="text-sm font-semibold text-[var(--enterprise-text)]"
                  >
                    Take photo
                  </h3>
                  <button
                    type="button"
                    onClick={() => setWebcamOpen(false)}
                    className="rounded-md p-1 text-[var(--enterprise-text-muted)] hover:bg-[var(--enterprise-hover-surface)]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
                  {webcamStarting ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden />
                    </div>
                  ) : null}
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    playsInline
                    muted
                    autoPlay
                  />
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWebcamOpen(false)}
                    className="rounded-lg border border-[var(--enterprise-border)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={webcamStarting}
                    onClick={captureFromWebcam}
                    className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Capture
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function RfiAttachmentListItem({
  projectId,
  rfiId,
  att,
  formatDate,
  canDelete,
  onOpenPreview,
}: {
  projectId: string;
  rfiId: string;
  att: RfiAttachmentRow;
  formatDate: (iso: string) => string;
  canDelete: boolean;
  onOpenPreview: () => void;
}) {
  const qc = useQueryClient();
  const isImage = isImageAttachment(att.mimeType, att.fileName);
  const { kind: formatKind, label: formatLabel } = useMemo(
    () => classifyAttachment(att.mimeType, att.fileName),
    [att.mimeType, att.fileName],
  );
  const [imgBroken, setImgBroken] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => deleteRfiAttachment(projectId, rfiId, att.id),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      void qc.invalidateQueries({ queryKey: qk.projectRfi(projectId, rfiId) });
      void qc.invalidateQueries({ queryKey: qk.rfiActivity(projectId, rfiId) });
      void qc.removeQueries({ queryKey: qk.rfiAttachmentReadUrl(projectId, rfiId, att.id) });
      toast.success("Attachment removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = useQuery({
    queryKey: qk.rfiAttachmentReadUrl(projectId, rfiId, att.id),
    queryFn: () => presignReadRfiAttachment(projectId, rfiId, att.id),
    enabled: isImage,
    staleTime: 50 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    setImgBroken(false);
  }, [att.id, preview.data]);

  return (
    <li className="flex gap-3 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]/60 p-2.5">
      <button
        type="button"
        onClick={onOpenPreview}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] text-left outline-none ring-[var(--enterprise-primary)] focus-visible:ring-2"
        aria-label={`Open preview: ${att.fileName}`}
      >
        {isImage ? (
          preview.isPending ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--enterprise-text-muted)]" />
            </div>
          ) : preview.data && !imgBroken ? (
            <img
              src={preview.data}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={() => setImgBroken(true)}
            />
          ) : (
            <RfiAttachmentFormatTile kind="image" label={formatLabel} />
          )
        ) : (
          <RfiAttachmentFormatTile kind={formatKind} label={formatLabel} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-[var(--enterprise-text)]">
            {att.fileName}
          </p>
          {canDelete ? (
            <button
              type="button"
              disabled={deleteMut.isPending}
              onClick={() => setDeleteDialogOpen(true)}
              className="shrink-0 rounded-md p-1.5 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] disabled:opacity-40"
              aria-label={`Remove ${att.fileName}`}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
          <span className="font-medium text-[var(--enterprise-text)]">{formatLabel}</span>
          {formatAttachmentSize(att.sizeBytes) ? (
            <span> · {formatAttachmentSize(att.sizeBytes)}</span>
          ) : null}
          <span>
            {" "}
            · {att.uploadedBy?.name ?? "—"} · {formatDate(att.createdAt)}
          </span>
        </p>
        <button
          type="button"
          onClick={onOpenPreview}
          className="mt-1.5 text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
        >
          Open
        </button>
      </div>
      <DeleteRfiAttachmentConfirmDialog
        open={deleteDialogOpen}
        fileName={att.fileName}
        isDeleting={deleteMut.isPending}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => deleteMut.mutate()}
      />
    </li>
  );
}

function RfiActivitySection({
  isPending,
  rows,
  nowMs,
  embedded,
}: {
  isPending: boolean;
  rows: RfiActivityRow[] | undefined;
  nowMs: number;
  /** When true, omit card chrome and titles (e.g. inside a dialog). */
  embedded?: boolean;
}) {
  const list = rows ?? [];

  const body = isPending ? (
    <div className="flex items-center gap-2 py-8 text-sm text-[var(--enterprise-text-muted)]">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      Loading…
    </div>
  ) : list.length === 0 ? (
    <div
      className={`rounded-lg border border-dashed border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/50 px-4 py-8 text-center ${embedded ? "" : "mt-4"}`}
    >
      <Activity
        className="mx-auto h-8 w-8 text-[var(--enterprise-text-muted)] opacity-50"
        aria-hidden
      />
      <p className="mt-2 text-sm text-[var(--enterprise-text)]">Nothing here yet</p>
      <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
        Events appear as this RFI is updated.
      </p>
    </div>
  ) : (
    <ol
      className={`divide-y divide-[var(--enterprise-border)] border-t border-[var(--enterprise-border)] ${embedded ? "mt-0" : "mt-4"}`}
      aria-label="RFI activity, newest first"
    >
      {list.map((row) => {
        const { Icon, iconWrapClass, headline, subline } = describeRfiActivity(row);
        const when = formatActivityRelative(row.createdAt, nowMs);
        const abs = new Date(row.createdAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const actorName = row.actor?.name?.trim() || null;
        return (
          <li key={row.id} className="flex gap-3 py-3.5 first:pt-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-[var(--enterprise-text)]">
                {headline}
              </p>
              {subline ? (
                <p className="mt-1 text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
                  {subline}
                </p>
              ) : null}
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--enterprise-text-muted)]">
                <span className="enterprise-hint-tip tabular-nums" data-hint={abs}>
                  {when}
                </span>
                {actorName ? (
                  <>
                    <span aria-hidden className="text-[var(--enterprise-border)]">
                      ·
                    </span>
                    <span className="font-medium text-[var(--enterprise-text)]">{actorName}</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden className="text-[var(--enterprise-border)]">
                      ·
                    </span>
                    <span>System</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );

  if (embedded) {
    return <div className="min-h-0">{body}</div>;
  }

  return (
    <div className={cardClass}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--enterprise-text)]">Timeline</h2>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-[var(--enterprise-text-muted)]">
          Newest first
        </span>
      </div>
      <p className="text-xs leading-relaxed text-[var(--enterprise-text-muted)]">
        Edits, review, responses, and file changes.
      </p>
      {body}
    </div>
  );
}

function rfiResponderUserIds(rfi: RfiRow): string[] {
  if (rfi.assignees && rfi.assignees.length > 0) return rfi.assignees.map((a) => a.id);
  if (rfi.assignedToUserId) return [rfi.assignedToUserId];
  return [];
}

function rfiResponderLabel(rfi: RfiRow): string {
  const names = (rfi.assignees ?? []).map((a) => a.name).filter(Boolean);
  if (names.length > 0) return names.join(", ");
  return rfi.assignedTo?.name ?? "—";
}

function sameSortedIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

export function RfiDetailClient({ projectId, rfiId }: { projectId: string; rfiId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { primary } = useEnterpriseWorkspace();
  const isPro = isWorkspaceProClient(primary?.workspace);
  const nowMs = useTickNowMs();
  const [questionDraft, setQuestionDraft] = useState("");
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [issueIdsEdit, setIssueIdsEdit] = useState<string[]>([]);
  const [assigneeIdsEdit, setAssigneeIdsEdit] = useState<string[]>([]);
  const [previewAtt, setPreviewAtt] = useState<RfiAttachmentRow | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [discussionEditorKey, setDiscussionEditorKey] = useState(0);
  const [selectedAnswerMessageId, setSelectedAnswerMessageId] = useState<string | null>(null);
  const [deleteRecordedAnswerOpen, setDeleteRecordedAnswerOpen] = useState(false);
  const [deleteRfiOpen, setDeleteRfiOpen] = useState(false);
  const discussionThreadRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: qk.me(),
    queryFn: fetchMe,
  });
  const meId = me?.user.id ?? null;

  const { data: team } = useQuery({
    queryKey: qk.projectTeam(projectId),
    queryFn: () => fetchProjectTeam(projectId),
    enabled: Boolean(projectId),
  });

  const isWorkspaceAdmin = useMemo(() => {
    if (!meId || !team) return false;
    return team.members.some((m) => m.userId === meId && m.workspaceRole === "ADMIN");
  }, [meId, team]);

  const onProjectTeam = Boolean(meId && team?.members.some((m) => m.userId === meId));
  const canDeleteRfi = isPro && onProjectTeam;

  const rfiQuery = useQuery({
    queryKey: qk.projectRfi(projectId, rfiId),
    queryFn: () => fetchProjectRfi(projectId, rfiId),
    enabled: Boolean(projectId && rfiId),
  });

  const activityQuery = useQuery({
    queryKey: qk.rfiActivity(projectId, rfiId),
    queryFn: () => fetchRfiActivity(projectId, rfiId),
    enabled: Boolean(projectId && rfiId),
  });

  const messagesQuery = useQuery({
    queryKey: qk.rfiMessages(projectId, rfiId),
    queryFn: () => fetchRfiMessages(projectId, rfiId),
    enabled: Boolean(projectId && rfiId),
  });

  const discussionThreadSig = useMemo(
    () => messagesQuery.data?.map((m) => m.id).join("\n") ?? "",
    [messagesQuery.data],
  );

  useEffect(() => {
    const el = discussionThreadRef.current;
    if (!el || !discussionThreadSig) return;
    el.scrollTop = el.scrollHeight;
  }, [discussionThreadSig]);

  const { data: projectIssues = [] } = useQuery({
    queryKey: qk.issuesForProject(projectId),
    queryFn: () => fetchIssuesForProject(projectId),
    enabled: Boolean(projectId && rfiId),
  });

  const rfi = rfiQuery.data;

  useEffect(() => {
    if (!rfi) return;
    setIssueIdsEdit(rfi.issues.map((i) => i.id));
    setAssigneeIdsEdit(rfiResponderUserIds(rfi));
  }, [rfi?.id ?? "", rfi?.updatedAt ?? ""]);

  useEffect(() => {
    if (!previewAtt || !rfi) return;
    if (!rfi.attachments.some((a) => a.id === previewAtt.id)) setPreviewAtt(null);
  }, [previewAtt, rfi]);

  const st = rfi ? norm(rfi.status) : "";

  const isCreator = Boolean(rfi && meId && (!rfi.creatorId || rfi.creatorId === meId));
  const isAssignee = Boolean(
    rfi &&
    meId &&
    ((rfi.assignees ?? []).some((a) => a.id === meId) || rfi.assignedToUserId === meId),
  );
  const canRespond = isAssignee || isWorkspaceAdmin;
  const closed = st === "CLOSED";
  const overdue = rfi ? isOverdue(rfi, nowMs) : false;
  const canEditAssignee = !closed && (isCreator || isWorkspaceAdmin);
  const canRemoveRecordedAnswer = (isCreator || canRespond) && !closed;

  const assignableMembers = useMemo(() => {
    return (team?.members ?? []).filter((m) => m.access === "full" || m.access === "project");
  }, [team]);

  const assignablePickRows = useMemo(
    () =>
      assignableMembers.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
        image: m.image ?? null,
      })),
    [assignableMembers],
  );

  const discussionMentionUsers = useMemo(
    () =>
      assignablePickRows.map((m) => ({
        id: m.userId,
        label: (m.name?.trim() || m.email || m.userId) as string,
        email: m.email?.trim() || null,
        image: m.image ?? null,
      })),
    [assignablePickRows],
  );

  const messageMut = useMutation({
    mutationFn: (body: string) => postRfiMessage(projectId, rfiId, { body }),
    onSuccess: (row: RfiMessageRow) => {
      qc.setQueryData(qk.rfiMessages(projectId, rfiId), (prev: RfiMessageRow[] | undefined) => [
        ...(prev ?? []),
        row,
      ]);
      void qc.invalidateQueries({ queryKey: qk.projectRfi(projectId, rfiId) });
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      void qc.invalidateQueries({ queryKey: qk.rfiActivity(projectId, rfiId) });
      void qc.invalidateQueries({ queryKey: qk.meNotifications() });
      setDiscussionEditorKey((k) => k + 1);
      setActionMsg(null);
    },
    onError: (e: Error) => {
      setActionMsg(e instanceof HttpError ? e.message : e.message);
    },
  });

  const patchMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchProjectRfi(projectId, rfiId, body),
    onSuccess: (data) => {
      qc.setQueryData(qk.projectRfi(projectId, rfiId), data);
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      void qc.invalidateQueries({ queryKey: qk.rfiActivity(projectId, rfiId) });
      void qc.invalidateQueries({ queryKey: qk.meNotifications() });
      setActionMsg(null);
      setVoidOpen(false);
      setVoidReason("");
      if (norm(data.status) === "ANSWERED") setSelectedAnswerMessageId(null);
    },
    onError: (e: Error) => {
      setActionMsg(e instanceof HttpError ? e.message : e.message);
    },
  });

  const deleteRfiMut = useMutation({
    mutationFn: () => deleteProjectRfi(projectId, rfiId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: qk.projectRfi(projectId, rfiId) });
      qc.removeQueries({ queryKey: qk.rfiActivity(projectId, rfiId) });
      qc.removeQueries({ queryKey: qk.rfiMessages(projectId, rfiId) });
      void qc.invalidateQueries({ queryKey: qk.projectRfis(projectId) });
      void qc.invalidateQueries({ queryKey: qk.meNotifications() });
      toast.success("RFI deleted");
      setDeleteRfiOpen(false);
      router.push(`/projects/${projectId}/rfi`);
    },
    onError: (e: Error) => {
      toast.error(e instanceof ProRequiredError ? e.message : e.message);
    },
  });

  useEffect(() => {
    setSelectedAnswerMessageId(null);
  }, [rfiId, rfiQuery.data?.status]);

  const recordedAnswerPreview = useMemo(() => {
    const r = rfiQuery.data;
    if (!r?.answerMessageId) return null;
    const fromRow = r.answerMessage;
    const fromList = messagesQuery.data?.find((m) => m.id === r.answerMessageId);
    const body = fromRow?.body ?? fromList?.body ?? null;
    if (!body) return null;
    return {
      body,
      authorName: fromRow?.author?.name ?? fromList?.author?.name ?? "Unknown",
      authorEmail: fromRow?.author?.email ?? fromList?.author?.email ?? null,
      authorImage: fromRow?.author?.image ?? fromList?.author?.image ?? null,
      createdAtIso: fromRow?.createdAt ?? fromList?.createdAt ?? "",
    };
  }, [rfiQuery.data, messagesQuery.data]);

  const recordedAnswerLoading =
    Boolean(rfiQuery.data?.answerMessageId) && !recordedAnswerPreview && messagesQuery.isPending;
  const recordedAnswerMissing =
    Boolean(rfiQuery.data?.answerMessageId) && !recordedAnswerPreview && !messagesQuery.isPending;

  if (rfiQuery.isPending) {
    return <EnterpriseLoadingState message="Loading RFI…" label="Loading RFI details" />;
  }

  if (!rfi) {
    return (
      <div className="enterprise-card p-8 text-center text-sm text-[var(--enterprise-text-muted)]">
        RFI not found.{" "}
        <Link
          href={`/projects/${projectId}/rfi`}
          className="font-medium text-[var(--enterprise-primary)] hover:underline"
        >
          Back to list
        </Link>
      </div>
    );
  }

  const pri = (rfi.priority || "MEDIUM").toUpperCase();
  const viewerHref = viewerHrefForRfi(rfi, projectId);

  async function onUploadFile(file: File) {
    if (closed) return;
    if (file.size > MAX_RFI_ATTACHMENT_BYTES) {
      toast.error("File too large (max 25 MB per attachment).");
      return;
    }
    setUploadBusy(true);
    setActionMsg(null);
    const contentType = guessContentType(file);
    try {
      await toast.promise(
        (async () => {
          const { uploadUrl, key } = await presignRfiAttachmentUpload(projectId, rfiId, {
            fileName: file.name,
            contentType,
            sizeBytes: file.size,
          });
          const put = await fetch(uploadUrl, {
            method: "PUT",
            mode: "cors",
            cache: "no-store",
            headers: { "Content-Type": contentType },
            body: file,
          });
          if (!put.ok) {
            const hint = await put.text().catch(() => "");
            throw new Error(
              hint.trim()
                ? `Storage upload failed (${put.status}). ${hint.slice(0, 200)}`
                : `Storage upload failed (${put.status}). Check the S3 bucket CORS policy allows PUT from ${typeof window !== "undefined" ? window.location.origin : "this app"}.`,
            );
          }
          await completeRfiAttachmentUpload(projectId, rfiId, {
            key,
            fileName: file.name,
            mimeType: contentType,
            sizeBytes: file.size,
          });
          await qc.invalidateQueries({ queryKey: qk.projectRfi(projectId, rfiId) });
          await qc.invalidateQueries({ queryKey: qk.rfiActivity(projectId, rfiId) });
        })(),
        {
          loading: "Uploading attachment…",
          success: "Attachment added",
          error: (e) => (e instanceof Error ? e.message : "Upload failed"),
        },
      );
    } finally {
      setUploadBusy(false);
    }
  }

  const activityCount = activityQuery.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <DeleteRfiConfirmDialog
        open={deleteRfiOpen}
        reference={`RFI #${String(rfi.rfiNumber).padStart(3, "0")}`}
        title={rfi.title}
        isDeleting={deleteRfiMut.isPending}
        onCancel={() => setDeleteRfiOpen(false)}
        onConfirm={() => deleteRfiMut.mutate()}
      />
      <div className="space-y-6 lg:space-y-7">
        <header
          id="rfi-overview"
          className="space-y-4 rounded-2xl border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-4 shadow-[var(--enterprise-shadow-card)] sm:p-5 lg:p-6"
        >
          <Link
            href={`/projects/${projectId}/rfi`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--enterprise-text-muted)] transition hover:text-[var(--enterprise-primary)]"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            All RFIs
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-2 py-1 font-mono text-xs font-semibold tabular-nums text-[var(--enterprise-text-muted)]">
              #{String(rfi.rfiNumber).padStart(3, "0")}
            </span>
            <span
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${rfiStatusBadgeClass(st)}`}
            >
              {RFI_STATUS_LABEL[st] ?? rfi.status}
            </span>
            <span
              className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${priorityBadgeClassLight(pri)}`}
            >
              {pri === "LOW" ? "Low" : pri === "HIGH" ? "High" : "Medium"} priority
            </span>
            {rfi.risk ? (
              <span
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${riskChipClass(rfi.risk)}`}
              >
                Risk: {rfi.risk === "med" ? "Medium" : rfi.risk === "high" ? "High" : "Low"}
              </span>
            ) : null}
            {overdue ? (
              <span
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${OVERDUE_CHIP}`}
              >
                Overdue
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setTimelineOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)] transition hover:border-[var(--enterprise-primary)]/30 hover:bg-[var(--enterprise-primary-soft)]"
            >
              <Activity className="h-3.5 w-3.5 text-[var(--enterprise-primary)]" aria-hidden />
              Timeline
              {activityCount > 0 ? (
                <span className="tabular-nums text-[var(--enterprise-text-muted)]">
                  ({activityCount})
                </span>
              ) : null}
            </button>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--enterprise-text)] sm:text-2xl lg:text-3xl">
            {rfi.title}
          </h1>

          <div className="mt-4 border-t border-[var(--enterprise-border)]/80 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {closed && (isCreator || canRespond) ? (
                <button
                  type="button"
                  disabled={patchMut.isPending}
                  onClick={() => patchMut.mutate({ status: "IN_REVIEW" })}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2 text-sm font-semibold text-[var(--enterprise-text)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)] disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Reopen RFI
                </button>
              ) : null}
              {!closed && st === "OPEN" && isCreator ? (
                <button
                  type="button"
                  disabled={patchMut.isPending}
                  onClick={() => patchMut.mutate({ status: "IN_REVIEW" })}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Send for review
                </button>
              ) : null}
              {!closed && st === "IN_REVIEW" && canRespond ? (
                <button
                  type="button"
                  disabled={
                    patchMut.isPending ||
                    !selectedAnswerMessageId ||
                    (messagesQuery.data?.length ?? 0) === 0
                  }
                  onClick={() => {
                    if (!selectedAnswerMessageId) return;
                    patchMut.mutate({
                      status: "ANSWERED",
                      answerMessageId: selectedAnswerMessageId,
                    });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-50"
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  Mark as answered
                </button>
              ) : null}
              {!closed && st === "ANSWERED" && isCreator ? (
                <button
                  type="button"
                  disabled={patchMut.isPending}
                  onClick={() => patchMut.mutate({ status: "CLOSED" })}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--enterprise-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--enterprise-primary-deep)] disabled:opacity-60"
                >
                  Close RFI
                </button>
              ) : null}
              {!closed && (st === "OPEN" || st === "IN_REVIEW") && isCreator ? (
                <button
                  type="button"
                  onClick={() => setVoidOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2.5 text-sm font-medium text-[var(--enterprise-text-muted)] shadow-sm transition hover:bg-[var(--enterprise-hover-surface)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Void / close
                </button>
              ) : null}
              {canDeleteRfi ? (
                <button
                  type="button"
                  onClick={() => setDeleteRfiOpen(true)}
                  disabled={deleteRfiMut.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-semantic-danger-border)] bg-[var(--enterprise-semantic-danger-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--enterprise-semantic-danger-text)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                  Delete RFI
                </button>
              ) : null}
            </div>
            {!closed && st === "IN_REVIEW" && canRespond ? (
              <p className="mt-2 max-w-xl text-xs text-[var(--enterprise-text-muted)]">
                In <span className="font-medium text-[var(--enterprise-text)]">Discussion</span>,
                click{" "}
                <span className="font-medium text-[var(--enterprise-text)]">
                  Use as official answer
                </span>{" "}
                on the right message, then press{" "}
                <span className="font-medium text-[var(--enterprise-text)]">Mark as answered</span>{" "}
                here.
              </p>
            ) : null}
            {voidOpen && isCreator && !closed ? (
              <div className="enterprise-alert-warning mt-4 p-4">
                <p className="text-sm font-semibold">
                  Close without a recorded answer in the thread?
                </p>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={2}
                  className={`${inputClass} mt-2 bg-[var(--enterprise-surface)]`}
                  placeholder="Optional reason (superseded, withdrawn, …)"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={patchMut.isPending}
                    onClick={() =>
                      patchMut.mutate({
                        status: "CLOSED",
                        voidReason: voidReason.trim() || null,
                      })
                    }
                    className="rounded-lg bg-[var(--enterprise-semantic-warning-text)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  >
                    Confirm close
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoidOpen(false)}
                    className="rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-4 py-2 text-sm font-medium text-[var(--enterprise-text)] shadow-[var(--enterprise-shadow-xs)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {st === "OPEN" && rfiResponderUserIds(rfi).length === 0 && canEditAssignee ? (
          <div
            className="enterprise-alert-warning px-4 py-3 shadow-[var(--enterprise-shadow-xs)]"
            role="status"
          >
            <p className="text-sm font-semibold">Choose who will respond</p>
            <p className="mt-1 text-xs leading-relaxed opacity-95">
              Select one or more people below. At least one responder is required before you can
              send this RFI for review.
            </p>
          </div>
        ) : null}

        <div
          className={`${cardClass} grid scroll-mt-36 gap-4 sm:grid-cols-2 lg:grid-cols-4`}
          id="rfi-meta"
        >
          <div
            id="rfi-assignee"
            className={`flex min-w-0 gap-3 ${canEditAssignee ? "sm:col-span-2 lg:col-span-4" : ""}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
              <User className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              {canEditAssignee ? (
                <>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Responders
                  </p>
                  {assignablePickRows.length === 0 ? (
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      No project members with access yet. Invite people under Project team.
                    </p>
                  ) : (
                    <EnterpriseMemberMultiPicker
                      members={assignablePickRows}
                      value={assigneeIdsEdit}
                      onChange={setAssigneeIdsEdit}
                      disabled={patchMut.isPending}
                      emptyMessage="No one matches that search."
                    />
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        patchMut.isPending ||
                        sameSortedIds(assigneeIdsEdit, rfiResponderUserIds(rfi))
                      }
                      onClick={() => patchMut.mutate({ assigneeUserIds: assigneeIdsEdit })}
                      className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Save responders
                    </button>
                    {assigneeIdsEdit.length > 0 ? (
                      <span className="text-xs text-[var(--enterprise-text-muted)]">
                        {assigneeIdsEdit.length} selected · any of them can submit the official
                        response
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--enterprise-text-muted)]">
                        Select everyone who should be notified and may answer.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                    Responders
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-[var(--enterprise-text)]">
                    {rfiResponderLabel(rfi)}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
              <Calendar className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] text-[var(--enterprise-text-muted)]">Due</p>
              <p className="text-sm font-medium text-[var(--enterprise-text)]">
                {formatFullDate(rfi.dueDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
              <Clock className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] text-[var(--enterprise-text-muted)]">Created</p>
              <p className="text-sm font-medium text-[var(--enterprise-text)]">
                {formatFullDate(rfi.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
              <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-[11px] text-[var(--enterprise-text-muted)]">From discipline</p>
              <p className="text-sm font-medium text-[var(--enterprise-text)]">
                {rfi.fromDiscipline ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div id="rfi-question" className={`${cardClass} scroll-mt-36`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitle}>Question</h2>
            {!closed && isCreator ? (
              <button
                type="button"
                onClick={() => {
                  if (editingQuestion) {
                    setEditingQuestion(false);
                    setQuestionDraft("");
                  } else {
                    setQuestionDraft(rfi.description ?? "");
                    setEditingQuestion(true);
                  }
                }}
                className="text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
              >
                {editingQuestion ? "Cancel" : "Edit"}
              </button>
            ) : null}
          </div>
          {editingQuestion ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                rows={5}
                className={inputClass}
              />
              <button
                type="button"
                disabled={patchMut.isPending}
                onClick={() => patchMut.mutate({ description: questionDraft.trim() || null })}
                className="rounded-lg bg-[var(--enterprise-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save question
              </button>
            </div>
          ) : (
            <p className={`mt-3 ${bodyProse}`}>{rfi.description ?? "No description provided."}</p>
          )}
        </div>

        <div id="rfi-references" className={`${cardClass} scroll-mt-36`}>
          <h2 className={sectionTitle}>References</h2>
          <p className="mt-1 text-xs text-[var(--enterprise-text-muted)]">
            Link site issues and/or a sheet. Multiple issues are supported when one RFI covers
            several pins.
          </p>
          {rfi.file || rfi.issues[0] ? (
            <p className="mt-3 text-sm text-[var(--enterprise-text)]">
              <span className="font-medium">
                {rfi.file?.name ?? rfi.issues[0]?.sheetName ?? "Sheet"}
              </span>
              {rfi.fileVersion ? ` · v${rfi.fileVersion.version}` : null}
              {rfi.pageNumber != null ? ` · Page ${rfi.pageNumber}` : null}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">No drawing linked.</p>
          )}
          {viewerHref ? (
            <Link
              href={viewerHref}
              className="mt-3 inline-flex text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
            >
              Open sheet in viewer
            </Link>
          ) : null}

          <div className="mt-4 border-t border-[var(--enterprise-border)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
              Related issues
            </h3>
            {rfi.issues.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {rfi.issues.map((iss) => (
                  <li key={iss.id} className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-bg)]/80 px-2.5 py-1 text-xs text-[var(--enterprise-text)]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {iss.title}
                    </span>
                    <Link
                      href={viewerHrefForLinkedIssue(projectId, iss, rfi.file?.name ?? "Sheet")}
                      className="text-xs font-medium text-[var(--enterprise-primary)] hover:underline"
                    >
                      Open issue
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">No issues linked.</p>
            )}

            {!closed && isCreator ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-[var(--enterprise-text-muted)]">Edit issue references</p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] p-2">
                  {projectIssues.length === 0 ? (
                    <p className="text-xs text-[var(--enterprise-text-muted)]">
                      No issues in project.
                    </p>
                  ) : (
                    projectIssues.map((i) => (
                      <label
                        key={i.id}
                        className="flex cursor-pointer items-start gap-2 text-sm text-[var(--enterprise-text)]"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={issueIdsEdit.includes(i.id)}
                          onChange={() => {
                            setIssueIdsEdit((prev) =>
                              prev.includes(i.id)
                                ? prev.filter((x) => x !== i.id)
                                : [...prev, i.id],
                            );
                          }}
                        />
                        <span className="leading-snug">{i.title}</span>
                      </label>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  disabled={patchMut.isPending}
                  onClick={() => patchMut.mutate({ issueIds: issueIdsEdit })}
                  className="rounded-lg bg-[var(--enterprise-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  Save references
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div id="rfi-attachments" className={`${cardClass} scroll-mt-36`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={sectionTitle}>Attachments</h2>
            {!closed ? (
              uploadBusy ? (
                <span className="inline-flex items-center gap-2 text-sm text-[var(--enterprise-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Uploading…
                </span>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
                  <RfiTakePhotoButton onFile={(f) => void onUploadFile(f)} disabled={uploadBusy} />
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--enterprise-primary)]">
                    <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Add file</span>
                    <input
                      type="file"
                      className="sr-only"
                      disabled={uploadBusy}
                      aria-label="Choose a file or photo from your device"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void onUploadFile(f);
                      }}
                    />
                  </label>
                </div>
              )
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {rfi.attachments.length === 0 ? (
              <li className="text-sm text-[var(--enterprise-text-muted)]">No attachments.</li>
            ) : (
              rfi.attachments.map((a) => (
                <RfiAttachmentListItem
                  key={a.id}
                  projectId={projectId}
                  rfiId={rfiId}
                  att={a}
                  formatDate={formatFullDate}
                  canDelete={!closed}
                  onOpenPreview={() => setPreviewAtt(a)}
                />
              ))
            )}
          </ul>
        </div>

        <div id="rfi-discussion" className={`${cardClass} scroll-mt-36`}>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--enterprise-primary)]/10 text-[var(--enterprise-primary)]">
              <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <h2 className={sectionTitle}>Discussion thread</h2>
              <p className="mt-0.5 text-xs text-[var(--enterprise-text-muted)]">
                Rich text and @mentions. While in review, a responder designates one reply as the
                official answer; participants are notified.
              </p>
            </div>
          </div>

          {recordedAnswerPreview ? (
            <div className="mt-2.5 rounded-lg border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-semantic-success-bg)] px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enterprise-semantic-success-text)]">
                  Recorded answer
                </p>
                {canRemoveRecordedAnswer ? (
                  <button
                    type="button"
                    onClick={() => setDeleteRecordedAnswerOpen(true)}
                    className="-my-0.5 -mr-0.5 rounded-md p-1 text-[var(--enterprise-semantic-success-text)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                    aria-label="Remove recorded answer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="mt-1.5 flex gap-2">
                <div className="relative mt-px flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--enterprise-semantic-success-border)] bg-[var(--enterprise-surface)] text-[9px] font-semibold text-[var(--enterprise-semantic-success-text)]">
                  {recordedAnswerPreview.authorImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- profile URL from auth
                    <img
                      src={recordedAnswerPreview.authorImage}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userInitials(
                      recordedAnswerPreview.authorName || null,
                      recordedAnswerPreview.authorEmail,
                    )
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span className="text-xs font-semibold text-[var(--enterprise-text)]">
                      {recordedAnswerPreview.authorName}
                    </span>
                    {recordedAnswerPreview.createdAtIso ? (
                      <time
                        className="text-[10px] text-[var(--enterprise-text-muted)]"
                        dateTime={recordedAnswerPreview.createdAtIso}
                      >
                        {formatActivityRelative(recordedAnswerPreview.createdAtIso, nowMs)}
                      </time>
                    ) : null}
                  </div>
                  <div className="mt-1 rounded-md border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-2 py-1.5 [&_.rfi-rich-body]:text-xs [&_.rfi-rich-body]:leading-snug">
                    <RfiMessageHtmlBody html={recordedAnswerPreview.body} className="mt-0" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {recordedAnswerLoading ? (
            <p className="mt-3 text-sm text-[var(--enterprise-text-muted)]">
              Loading recorded answer…
            </p>
          ) : null}
          {recordedAnswerMissing ? (
            <div className="mt-3 rounded-xl border border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enterprise-text-muted)]">
                  Recorded answer
                </p>
                {canRemoveRecordedAnswer && rfi.officialResponse?.trim() ? (
                  <button
                    type="button"
                    onClick={() => setDeleteRecordedAnswerOpen(true)}
                    className="rounded-md p-1 text-[var(--enterprise-text-muted)] transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)]"
                    aria-label="Remove recorded answer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
              {rfi.officialResponse?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--enterprise-text)]">
                  {rfi.officialResponse}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--enterprise-text-muted)]">
                  The original message is no longer in the thread.
                </p>
              )}
            </div>
          ) : null}

          {!rfi.answerMessageId &&
          rfi.officialResponse?.trim() &&
          (st === "ANSWERED" || st === "CLOSED") ? (
            <div className="enterprise-alert-warning mt-3 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Recorded answer (legacy)</p>
                {canRemoveRecordedAnswer ? (
                  <button
                    type="button"
                    onClick={() => setDeleteRecordedAnswerOpen(true)}
                    className="rounded-md p-1 opacity-80 transition hover:bg-[var(--enterprise-semantic-danger-bg)] hover:text-[var(--enterprise-semantic-danger-text)] hover:opacity-100"
                    aria-label="Remove recorded answer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[var(--enterprise-text)]">
                {rfi.officialResponse}
              </p>
            </div>
          ) : null}
          <div
            ref={discussionThreadRef}
            role="region"
            aria-label="Discussion thread"
            className="enterprise-scrollbar mt-4 max-h-[min(60vh,28rem)] min-h-[8rem] overflow-y-auto overscroll-y-contain rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] [-webkit-overflow-scrolling:touch]"
          >
            {messagesQuery.isPending ? (
              <p className="px-4 py-6 text-sm text-[var(--enterprise-text-muted)]">
                Loading thread…
              </p>
            ) : messagesQuery.isError ? (
              <p className="px-4 py-6 text-sm text-[var(--enterprise-semantic-danger-text)]">
                Could not load this thread.
              </p>
            ) : (messagesQuery.data?.length ?? 0) === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--enterprise-text-muted)]">
                No replies yet. Add the first comment below.
              </p>
            ) : (
              <ul className="flex flex-col gap-3 px-3 py-3 sm:gap-3.5 sm:px-4 sm:py-4">
                {messagesQuery.data!.map((msg) => (
                  <RfiDiscussionMessageItem
                    key={msg.id}
                    authorName={msg.author?.name ?? "Unknown"}
                    authorEmail={msg.author?.email ?? null}
                    authorImage={msg.author?.image ?? null}
                    bodyHtml={msg.body}
                    createdAtIso={msg.createdAt}
                    timeLabel={formatActivityRelative(msg.createdAt, nowMs)}
                    isRecordedAnswer={Boolean(
                      rfi.answerMessageId && msg.id === rfi.answerMessageId,
                    )}
                    showAnswerPicker={!closed && st === "IN_REVIEW" && canRespond}
                    isPickerSelected={selectedAnswerMessageId === msg.id}
                    onTogglePickAsAnswer={() =>
                      setSelectedAnswerMessageId((cur) => (cur === msg.id ? null : msg.id))
                    }
                  />
                ))}
              </ul>
            )}
          </div>
          {!closed ? (
            <div className="mt-4 shrink-0 border-t border-[var(--enterprise-border)] pt-4">
              <label className="sr-only">New discussion message</label>
              <RfiDiscussionRichEditor
                key={`${rfiId}-${discussionEditorKey}`}
                isPending={messageMut.isPending}
                mentionUsers={discussionMentionUsers}
                onSubmit={(html) => messageMut.mutate(html)}
              />
            </div>
          ) : null}
        </div>

        {actionMsg ? (
          <p className="text-sm text-[var(--enterprise-semantic-danger-text)]">{actionMsg}</p>
        ) : null}

        {closed && viewerHref ? (
          <Link
            href={viewerHref}
            className="inline-flex text-sm font-medium text-[var(--enterprise-primary)] hover:underline"
          >
            View in viewer
          </Link>
        ) : null}
      </div>

      <RfiTimelineDialog
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        eventCount={activityCount}
      >
        <RfiActivitySection
          embedded
          isPending={activityQuery.isPending}
          rows={activityQuery.data}
          nowMs={nowMs}
        />
      </RfiTimelineDialog>

      <DeleteRecordedAnswerConfirmDialog
        open={deleteRecordedAnswerOpen}
        isDeleting={patchMut.isPending}
        onCancel={() => setDeleteRecordedAnswerOpen(false)}
        onConfirm={() => {
          patchMut.mutate(
            { answerMessageId: null },
            {
              onSuccess: () => setDeleteRecordedAnswerOpen(false),
            },
          );
        }}
      />

      {previewAtt ? (
        <RfiAttachmentLightbox
          key={previewAtt.id}
          projectId={projectId}
          rfiId={rfiId}
          attachmentId={previewAtt.id}
          fileName={previewAtt.fileName}
          mimeType={previewAtt.mimeType}
          onClose={() => setPreviewAtt(null)}
        />
      ) : null}
    </div>
  );
}
