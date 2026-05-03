"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { auth } from "@/app/lib/firebase";
import type { UploadJob } from "@/app/types/upload";

const MAX_CONCURRENT = 4;
const CHUNK_SIZE = 256 * 1024; // 256KB — matches server-side safety limit

export interface UploadQueueParams {
  studentId: string;
  taskId:    string;
  groupId:   string;
  note?:     string;
}

interface UploadResult {
  success:       boolean;
  cancelled:     boolean;
  submissionId?: string;
  error?:        string;
}

export function useUploadQueue({ studentId, taskId, groupId, note }: UploadQueueParams) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const startedRef      = useRef<Set<string>>(new Set());
  const controllersRef  = useRef<Map<string, AbortController>>(new Map());

  const updateJob = useCallback((id: string, updates: Partial<UploadJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  const uploadFile = useCallback(async (
    job:    UploadJob,
    signal: AbortSignal,
  ): Promise<UploadResult> => {
    const user = auth.currentUser;
    if (!user) return { success: false, cancelled: false, error: "Kimlik doğrulaması gerekli." };

    try {
      // Step 1: init resumable session
      updateJob(job.id, { status: "initializing", startTime: new Date() });

      const initToken = await user.getIdToken(true);
      const initRes = await fetch("/api/submissions/init-resumable-upload", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${initToken}` },
        body:    JSON.stringify({
          studentId,
          taskId,
          groupId,
          fileName: job.fileName,
          fileSize: job.fileSize,
          mimeType: job.file.type || "application/octet-stream",
        }),
        signal,
      });

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Başlatma başarısız (${initRes.status})`);
      }
      const { uploadId } = await initRes.json() as { uploadId: string };

      // Step 2: upload chunks through server proxy
      updateJob(job.id, { status: "uploading" });

      const totalChunks = Math.ceil(job.fileSize / CHUNK_SIZE);
      let driveFileId: string | null = null;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end   = Math.min(start + CHUNK_SIZE, job.fileSize);
        const chunk = job.file.slice(start, end);

        const chunkToken = await user.getIdToken();
        const chunkRes = await fetch("/api/submissions/upload-chunk", {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${chunkToken}`,
            "x-upload-id":   uploadId,
            "content-range": `bytes ${start}-${end - 1}/${job.fileSize}`,
            "x-file-type":   job.file.type || "application/octet-stream",
          },
          body:   chunk,
          signal,
        });

        if (!chunkRes.ok) {
          const err = await chunkRes.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? `Chunk ${i + 1}/${totalChunks} başarısız (${chunkRes.status})`);
        }

        const chunkData = await chunkRes.json() as { status: string; driveFileId?: string };
        updateJob(job.id, {
          uploadedBytes: end,
          progress:      Math.round((end / job.fileSize) * 100),
        });

        if (chunkData.status === "complete") {
          driveFileId = chunkData.driveFileId ?? null;
        }
      }

      // Step 3: finalize — creates submission + drive permissions
      updateJob(job.id, { status: "completing" });

      const completeToken = await user.getIdToken(true);
      const completeBody: Record<string, string> = { uploadId };
      if (driveFileId)  completeBody.driveFileId = driveFileId;
      if (note?.trim()) completeBody.note        = note.trim();

      const completeRes = await fetch("/api/submissions/complete-upload", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${completeToken}` },
        body:    JSON.stringify(completeBody),
        signal,
      });

      if (!completeRes.ok) {
        const err = await completeRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Tamamlama başarısız (${completeRes.status})`);
      }

      const { submissionId } = await completeRes.json() as { submissionId: string };
      return { success: true, cancelled: false, submissionId };

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, cancelled: true };
      }
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      return { success: false, cancelled: false, error: message };
    }
  }, [studentId, taskId, groupId, note, updateJob]);

  const startUpload = useCallback(async (job: UploadJob) => {
    const controller = new AbortController();
    controllersRef.current.set(job.id, controller);

    const result = await uploadFile(job, controller.signal);
    controllersRef.current.delete(job.id);

    if (result.success) {
      updateJob(job.id, {
        status:       "success",
        submissionId: result.submissionId,
        progress:     100,
        endTime:      new Date(),
      });
    } else if (!result.cancelled) {
      updateJob(job.id, {
        status:  "error",
        error:   result.error,
        endTime: new Date(),
      });
    } else {
      // cancelled by cancelJob — status already set, just record endTime
      updateJob(job.id, { endTime: new Date() });
    }
  }, [uploadFile, updateJob]);

  // Whenever jobs change: fill available upload slots with pending jobs
  useEffect(() => {
    const active  = jobs.filter(j => ["initializing", "uploading", "completing"].includes(j.status));
    const pending = jobs.filter(j => j.status === "pending" && !startedRef.current.has(j.id));
    const slots   = MAX_CONCURRENT - active.length;

    if (slots > 0 && pending.length > 0) {
      pending.slice(0, slots).forEach(job => {
        startedRef.current.add(job.id);
        startUpload(job);
      });
    }
  }, [jobs, startUpload]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newJobs: UploadJob[] = Array.from(files).map(file => ({
      id:            crypto.randomUUID(),
      file,
      fileName:      file.name,
      fileSize:      file.size,
      status:        "pending" as const,
      progress:      0,
      uploadedBytes: 0,
    }));
    setJobs(prev => [...prev, ...newJobs]);
  }, []);

  const cancelJob = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    updateJob(id, { status: "cancelled", endTime: new Date() });
  }, [updateJob]);

  const removeJob = useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    startedRef.current.delete(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const retryJob = useCallback((id: string) => {
    updateJob(id, {
      status:        "pending",
      progress:      0,
      uploadedBytes: 0,
      error:         undefined,
      endTime:       undefined,
    });
    startedRef.current.delete(id);
  }, [updateJob]);

  const clearCompleted = useCallback(() => {
    setJobs(prev => {
      prev
        .filter(j => ["success", "error", "cancelled"].includes(j.status))
        .forEach(j => startedRef.current.delete(j.id));
      return prev.filter(j => !["success", "error", "cancelled"].includes(j.status));
    });
  }, []);

  const activeCount  = jobs.filter(j => ["initializing", "uploading", "completing"].includes(j.status)).length;
  const totalSize    = jobs.reduce((sum, j) => sum + j.fileSize, 0);
  const uploadedSize = jobs.reduce((sum, j) => sum + j.uploadedBytes, 0);

  return {
    jobs,
    addFiles,
    cancelJob,
    removeJob,
    retryJob,
    clearCompleted,
    activeCount,
    totalSize,
    uploadedSize,
  };
}
