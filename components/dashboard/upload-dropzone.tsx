"use client";

import { useRef } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = {
  isActive: boolean;
  onDragStateChange: (value: boolean) => void;
  onFilesSelected: (files: FileList | null) => void;
};

export function UploadDropzone({ isActive, onDragStateChange, onFilesSelected }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed px-5 py-6 transition",
        isActive ? "border-accent bg-accent/10" : "border-white/10 bg-white/5"
      )}
      onDragOver={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDragStateChange(false);
        onFilesSelected(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          onFilesSelected(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/10 p-3">
            <UploadCloud className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="font-semibold text-white">Upload files to this folder</p>
            <p className="text-sm text-slate-400">Drag and drop here or pick files manually.</p>
          </div>
        </div>

        <button type="button" className="button-primary" onClick={() => inputRef.current?.click()}>
          Select files
        </button>
      </div>
    </div>
  );
}
