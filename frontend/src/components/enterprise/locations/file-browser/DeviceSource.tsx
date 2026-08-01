"use client";

import { useCallback, useRef, useState } from "react";
import { FolderUp, HardDriveUpload, Plus, Upload } from "lucide-react";

export type PickedFile = { file: File; path: string[] };

type Props = {
  onFiles: (files: PickedFile[]) => void;
  /** Smaller strip when a batch is already staged. */
  compact?: boolean;
  /** Optional heading shown above the drop affordance (empty full-height state). */
  title?: string;
  subtitle?: string;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (cb: (file: File) => void, err: (e: unknown) => void) => void;
  createReader?: () => {
    readEntries: (cb: (entries: FileSystemEntryLike[]) => void, err: (e: unknown) => void) => void;
  };
};

function entryToFile(entry: FileSystemEntryLike): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file?.(resolve, reject);
  });
}

function readDir(entry: FileSystemEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader?.();
  if (!reader) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all);
          return;
        }
        all.push(...entries);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function walkEntry(entry: FileSystemEntryLike, prefix: string[]): Promise<PickedFile[]> {
  if (entry.isFile) {
    try {
      const file = await entryToFile(entry);
      return [{ file, path: [...prefix, entry.name] }];
    } catch {
      return [];
    }
  }
  if (entry.isDirectory) {
    const children = await readDir(entry);
    const nested = await Promise.all(children.map((c) => walkEntry(c, [...prefix, entry.name])));
    return nested.flat();
  }
  return [];
}

export function DeviceSource({ onFiles, compact = false, title, subtitle }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleInput = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const picked: PickedFile[] = Array.from(fileList).map((file) => {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        const path = rel && rel.length > 0 ? rel.split("/") : [file.name];
        return { file, path };
      });
      onFiles(picked);
    },
    [onFiles],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const items = e.dataTransfer.items;
      const entries: FileSystemEntryLike[] = [];
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const entry = (
            item as DataTransferItem & {
              webkitGetAsEntry?: () => FileSystemEntryLike | null;
            }
          ).webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }
      }
      if (entries.length > 0) {
        const results = await Promise.all(entries.map((entry) => walkEntry(entry, [])));
        onFiles(results.flat());
        return;
      }
      handleInput(e.dataTransfer.files);
    },
    [onFiles, handleInput],
  );

  const inputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        multiple
        accept=".ifc,.ifczip,.pdf,image/*,*/*"
        onChange={(e) => {
          handleInput(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="sr-only"
        multiple
        // @ts-expect-error non-standard directory upload attributes
        webkitdirectory=""
        directory=""
        onChange={(e) => {
          handleInput(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 transition ${
          dragActive
            ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)]"
            : "border-[var(--enterprise-border)] bg-[var(--enterprise-surface)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <p className="text-sm text-[var(--enterprise-text-muted)]">
          Drop more files here, or add from your device
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="mobile-touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add files
          </button>
          <button
            type="button"
            className="mobile-touch-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-3 py-2 text-sm font-medium text-[var(--enterprise-text)] hover:bg-[var(--enterprise-hover-surface)]"
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderUp className="h-4 w-4" aria-hidden />
            Add folder
          </button>
        </div>
        {inputs}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        className={`flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition sm:px-10 ${
          dragActive
            ? "border-[var(--enterprise-primary)] bg-[var(--enterprise-primary-soft)]"
            : "border-[var(--enterprise-border)] bg-[var(--enterprise-hover-surface)]/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <div className="flex max-w-md flex-col items-center gap-5">
          {title ? (
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-[var(--enterprise-text)]">{title}</h3>
              {subtitle ? (
                <p className="text-sm text-[var(--enterprise-text-muted)]">{subtitle}</p>
              ) : null}
            </div>
          ) : null}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--enterprise-primary-soft)]">
            <HardDriveUpload className="h-7 w-7 text-[var(--enterprise-primary)]" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-[var(--enterprise-text)]">
              Drag files or folders here
            </p>
            <p className="enterprise-type-caption text-[var(--enterprise-text-muted)]">
              IFC models and PDF drawings. Folders keep their structure.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="enterprise-btn-primary mobile-touch-target inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden />
              Choose files
            </button>
            <button
              type="button"
              className="mobile-touch-target inline-flex items-center gap-2 rounded-lg border border-[var(--enterprise-border)] bg-[var(--enterprise-surface)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--enterprise-hover-surface)]"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp className="h-4 w-4" aria-hidden />
              Choose folder
            </button>
          </div>
        </div>
      </div>
      {inputs}
    </div>
  );
}
