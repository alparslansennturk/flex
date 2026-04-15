"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Send } from "lucide-react";
import FileUploader from "./FileUploader";
import type { Submission } from "@/app/types/submission";

interface UploadFormProps {
  studentId:   string;
  taskId:      string;
  groupId:     string;
  /** Mevcut teslim varsa revizyon akışı için göster */
  currentStatus?: Submission["status"];
  onSuccess:   (submission: Submission) => void;
}

type FormState = "idle" | "uploading" | "success" | "error";

export default function UploadForm({
  studentId,
  taskId,
  groupId,
  currentStatus,
  onSuccess,
}: UploadFormProps) {
  const [file, setFile]       = useState<File | null>(null);
  const [note, setNote]       = useState("");
  const [state, setState]     = useState<FormState>("idle");
  const [errorMsg, setError]  = useState<string | null>(null);

  const isRevision = currentStatus === "revision";
  const canSubmit  = !!file && state !== "uploading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setState("uploading");
    setError(null);

    try {
      const fd = new FormData();
      fd.append("studentId", studentId);
      fd.append("taskId",    taskId);
      fd.append("groupId",   groupId);
      fd.append("file",      file);
      if (note.trim()) fd.append("note", note.trim());

      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Yükleme başarısız.");
        setState("error");
        return;
      }

      setState("success");
      setFile(null);
      setNote("");
      onSuccess(data as Submission);
    } catch {
      setError("Ağ hatası. Lütfen tekrar deneyin.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-status-success-50 border border-status-success-100 flex items-center justify-center">
          <CheckCircle2 size={22} className="text-status-success-500" />
        </div>
        <p className="text-[15px] font-bold text-base-primary-900">Ödev teslim edildi!</p>
        <p className="text-[13px] text-surface-400">Eğitmen inceleyecek ve geri bildirim verecek.</p>
        <button
          onClick={() => setState("idle")}
          className="mt-2 text-[12px] font-bold text-base-primary-500 hover:underline cursor-pointer"
        >
          Yeni teslim yap
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRevision && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200">
          <AlertTriangle size={15} className="text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-[12px] font-medium text-yellow-700">
            Revizyon istendi. Güncellenmiş dosyanı yükle.
          </p>
        </div>
      )}

      <div>
        <label className="block text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">
          Dosya
        </label>
        <FileUploader
          value={file}
          onChange={setFile}
          disabled={state === "uploading"}
        />
      </div>

      <div>
        <label className="block text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">
          Not <span className="text-surface-300 font-normal normal-case">(opsiyonel)</span>
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          disabled={state === "uploading"}
          placeholder="Eğitmene iletmek istediğin bir not var mı?"
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-[13px] text-base-primary-900 placeholder:text-surface-300 outline-none focus:border-base-primary-400 focus:bg-white resize-none transition-all disabled:opacity-50"
        />
      </div>

      {errorMsg && (
        <p className="text-[12px] font-medium text-status-danger-500">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-base-primary-900 text-white text-[13px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {state === "uploading" ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Yükleniyor…</>
        ) : (
          <><Send size={14} />{isRevision ? "Revize Teslim Et" : "Ödevi Teslim Et"}</>
        )}
      </button>
    </form>
  );
}
