"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  /** JPEG from the live preview. */
  onCapture: (file: File) => void;
};

export function IssueReferenceLiveCapture(props: Props) {
  const { open, onClose, onCapture } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const tryConstraints: MediaStreamConstraints[] = [
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          { video: { facingMode: "user" }, audio: false },
          { video: true, audio: false },
        ];
        let stream: MediaStream | null = null;
        for (const c of tryConstraints) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(c);
            break;
          } catch {
            /* try next */
          }
        }
        if (cancelled || !stream) throw new Error("no stream");
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.playsInline = true;
          await v.play().catch(() => undefined);
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          stopStream();
          toast.error(
            "Could not access the camera. Allow camera access in your browser, use HTTPS, or pick a photo from your library.",
          );
          onClose();
        }
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
      setReady(false);
    };
  }, [open, onClose, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopStream();
        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  }, [onCapture, onClose, stopStream]);

  if (!open || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close camera"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]"
        onClick={() => {
          stopStream();
          onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal
        aria-label="Take a photo"
        className="relative z-[1] flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-700/90 bg-slate-950 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
            <Camera className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} aria-hidden />
            In-browser camera
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="viewer-focus-ring rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="relative aspect-[4/3] w-full bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          {!ready ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-[12px] text-slate-400">
              Starting camera…
            </div>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-800/90 px-3 py-3">
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="viewer-focus-ring rounded-lg border border-slate-600/80 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-slate-800/80"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={capture}
            className="viewer-focus-ring rounded-lg bg-[var(--viewer-primary)] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[var(--viewer-primary-hover)] disabled:opacity-40"
          >
            Capture photo
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
