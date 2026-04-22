"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import {
  doc, getDoc, getDocs, collection, query, where, onSnapshot, orderBy,
} from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import Sidebar from "@/app/components/layout/Sidebar";
import Header from "@/app/components/layout/Header";
import SubmissionStatusBadge from "@/app/components/assignment-test/SubmissionStatusBadge";
import SubmissionTimeline from "@/app/components/assignment-test/SubmissionTimeline";
import CommentInput from "@/app/components/assignment-test/CommentInput";
import FilePreview from "@/app/components/assignment-test/FilePreview";
import { ArrowLeft, Calendar, RotateCcw, CheckCircle2, Download, Loader2, User } from "lucide-react";
import type { Submission, SubmissionStatus } from "@/app/types/submission";
import type { SubmissionComment } from "@/app/types/submission-comment";
import type { SubmissionFileVersion } from "@/app/types/submission-file";

interface PageData {
  submission: Submission;
  studentName: string;
  taskName: string;
  taskEndDate?: string;
  files: SubmissionFileVersion[];
  authorNames: Record<string, string>;
}

export default function SubmissionDetailPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();
  const params = useParams<{ groupId: string; assignmentId: string; submissionId: string }>();
  const { groupId, assignmentId, submissionId } = params;

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [activeFileVersionId, setActiveFileVersionId] = useState<string | undefined>();
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, submissionId]);

  // Real-time comments
  useEffect(() => {
    if (!submissionId) return;
    const q = query(
      collection(db, "submission_comments"),
      where("submissionId", "==", submissionId),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({
        id: d.id,
        submissionId: d.data().submissionId,
        authorId: d.data().authorId,
        authorType: d.data().authorType,
        text: d.data().text,
        isRead: d.data().isRead ?? false,
        order: d.data().order ?? 0,
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
      })));
    });
    return () => unsub();
  }, [submissionId]);

  async function loadData() {
    setLoading(true);
    try {
      const subSnap = await getDoc(doc(db, "submissions", submissionId));
      if (!subSnap.exists()) return;
      const subData = subSnap.data();

      const [taskSnap, studentSnap, filesSnap] = await Promise.all([
        getDoc(doc(db, "tasks", subData.taskId)),
        getDoc(doc(db, "students", subData.studentId)),
        getDocs(query(
          collection(db, "submission_files"),
          where("submissionId", "==", submissionId),
          orderBy("versionNo", "asc"),
        )),
      ]);

      const submission: Submission = {
        id: subSnap.id,
        studentId: subData.studentId,
        taskId: subData.taskId,
        groupId: subData.groupId,
        iteration: subData.iteration ?? 1,
        file: {
          driveFileId: subData.file?.driveFileId ?? "",
          driveViewLink: subData.file?.driveViewLink ?? "",
          fileUrl: subData.file?.fileUrl ?? "",
          fileName: subData.file?.fileName ?? "",
          fileSize: subData.file?.fileSize ?? 0,
          mimeType: subData.file?.mimeType ?? "",
        },
        note: subData.note,
        status: subData.status,
        feedback: subData.feedback,
        gradedBy: subData.gradedBy,
        grade: subData.grade,
        isLate: subData.isLate ?? false,
        daysLate: subData.daysLate,
        submittedAt: subData.submittedAt?.toDate?.() ?? new Date(),
        reviewedAt: subData.reviewedAt?.toDate?.(),
        completedAt: subData.completedAt?.toDate?.(),
        updatedAt: subData.updatedAt?.toDate?.() ?? new Date(),
      };

      const studentName = studentSnap.exists()
        ? `${studentSnap.data().name ?? ""} ${studentSnap.data().lastName ?? ""}`.trim()
        : "—";
      const taskName = taskSnap.exists() ? (taskSnap.data().name ?? "") : "—";
      const taskEndDate = taskSnap.exists() ? taskSnap.data().endDate : undefined;

      const files: SubmissionFileVersion[] = filesSnap.docs.map(d => ({
        id: d.id,
        submissionId: d.data().submissionId,
        studentId: d.data().studentId,
        driveFileId: d.data().driveFileId ?? "",
        fileUrl: d.data().fileUrl ?? "",
        fileName: d.data().fileName ?? "",
        fileSize: d.data().fileSize ?? 0,
        versionNo: d.data().versionNo ?? 1,
        isLatest: d.data().isLatest ?? false,
        uploadedAt: d.data().uploadedAt?.toDate?.() ?? new Date(),
      }));

      // Eğer submission_files yoksa submission.file'dan fallback
      const effectiveFiles = files.length > 0 ? files : [{
        id: "main",
        submissionId,
        studentId: subData.studentId,
        driveFileId: submission.file.driveFileId,
        fileUrl: submission.file.fileUrl,
        fileName: submission.file.fileName,
        fileSize: submission.file.fileSize,
        versionNo: 1,
        isLatest: true,
        uploadedAt: submission.submittedAt,
      }];

      const latestFile = effectiveFiles.find(f => f.isLatest) ?? effectiveFiles[0];
      setActiveFileVersionId(latestFile?.id);

      // Author names için user'ı da ekle
      const authorNames: Record<string, string> = {
        [subData.studentId]: studentName,
        ...(user ? { [user.uid]: user.displayName ?? "Eğitmen" } : {}),
      };

      setData({ submission, studentName, taskName, taskEndDate, files: effectiveFiles, authorNames });
    } finally {
      setLoading(false);
    }
  }

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusChange = async (status: SubmissionStatus) => {
    if (!user || actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/assignment-test/submissions/${submissionId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, authorId: user.uid }),
      });
      if (!res.ok) throw new Error();
      showToast(
        status === "completed" ? "Teslim onaylandı!" : "Revizyon istendi.",
        "success"
      );
      await loadData();
    } catch {
      showToast("İşlem başarısız.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendComment = async (text: string) => {
    if (!user) return;
    const res = await fetch(`/api/assignment-test/submissions/${submissionId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorId: user.uid, authorType: "teacher", text }),
    });
    if (!res.ok) throw new Error("Yorum gönderilemedi.");
    showToast("Yorum gönderildi.", "success");
  };

  if (authLoading || !user) return null;

  const sub = data?.submission;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB] font-inter antialiased text-text-primary">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <div className="w-[94%] mx-auto pt-6 pb-10 max-w-[1280px] xl:max-w-[1600px]">

            {/* Geri */}
            <button
              onClick={() => router.push(`/dashboard/assignment-test/${groupId}/${assignmentId}`)}
              className="flex items-center gap-2 text-[13px] font-bold text-surface-500 hover:text-base-primary-600 transition-colors mb-5 cursor-pointer"
            >
              <ArrowLeft size={15} /> Geri Dön
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-surface-400">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : !data || !sub ? (
              <div className="py-20 text-center text-[14px] text-surface-400">Teslim bulunamadı.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

                {/* Sol: Header + Dosya + Timeline + Yorum */}
                <div className="space-y-5">
                  {/* Header */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-base-primary-100 flex items-center justify-center">
                          <User size={18} className="text-base-primary-600" />
                        </div>
                        <div>
                          <h1 className="text-[17px] font-bold text-base-primary-900">{data.studentName}</h1>
                          <p className="text-[12px] text-surface-400">{data.taskName}</p>
                        </div>
                      </div>
                      <SubmissionStatusBadge status={sub.status} size="md" />
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-[12px] text-surface-500 flex-wrap">
                      <span>Teslim #{sub.iteration}</span>
                      <span>·</span>
                      <span>{new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(sub.submittedAt)}</span>
                      {sub.isLate && (
                        <>
                          <span>·</span>
                          <span className="text-status-danger-500 font-bold">{sub.daysLate} gün geç</span>
                        </>
                      )}
                      {sub.grade != null && (
                        <>
                          <span>·</span>
                          <span className="font-bold text-base-primary-700">Not: {sub.grade}/100</span>
                        </>
                      )}
                    </div>
                    {sub.note && (
                      <div className="mt-3 px-4 py-3 bg-surface-50 rounded-xl border border-surface-100">
                        <p className="text-[12px] font-bold text-surface-500 mb-0.5">Öğrenci notu</p>
                        <p className="text-[13px] text-text-secondary italic">"{sub.note}"</p>
                      </div>
                    )}
                  </div>

                  {/* Dosya önizleme */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <h2 className="text-[14px] font-bold text-text-primary mb-4">Dosya</h2>
                    <FilePreview
                      versions={data.files}
                      currentVersionId={activeFileVersionId}
                      onVersionChange={setActiveFileVersionId}
                    />
                  </div>

                  {/* Timeline */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5">
                    <h2 className="text-[14px] font-bold text-text-primary mb-4">Aktivite</h2>
                    <SubmissionTimeline
                      submissionId={submissionId}
                      authorNames={data.authorNames}
                    />
                  </div>

                  {/* Yorum girişi */}
                  <div>
                    <h2 className="text-[14px] font-bold text-text-primary mb-3">Yorum Ekle</h2>
                    <CommentInput authorType="teacher" onSend={handleSendComment} />
                  </div>
                </div>

                {/* Sağ: Sticky panel */}
                <div className="space-y-4 lg:sticky lg:top-6 self-start">
                  {/* Durum + Aksiyonlar */}
                  <div className="bg-white border border-surface-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-2">Mevcut Durum</p>
                      <SubmissionStatusBadge status={sub.status} size="md" />
                    </div>

                    {data.taskEndDate && (
                      <div>
                        <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-1">Deadline</p>
                        <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                          <Calendar size={13} />
                          {new Date(data.taskEndDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-1">Revizyon</p>
                      <p className="text-[15px] font-bold text-text-primary">#{sub.iteration - 1}</p>
                    </div>

                    <div className="pt-2 space-y-2 border-t border-surface-100">
                      <button
                        onClick={() => handleStatusChange("revision")}
                        disabled={actionLoading || sub.status === "completed"}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50
                          text-orange-600 text-[13px] font-bold hover:bg-orange-100 transition-colors cursor-pointer
                          disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={14} /> Revizyon İste
                      </button>
                      <button
                        onClick={() => handleStatusChange("completed")}
                        disabled={actionLoading || sub.status === "completed"}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500
                          text-white text-[13px] font-bold hover:bg-emerald-600 transition-colors cursor-pointer
                          disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 size={14} /> Onayla
                      </button>
                      <a
                        href={sub.file.fileUrl}
                        download={sub.file.fileName}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-base-primary-200
                          text-base-primary-600 text-[13px] font-bold hover:bg-base-primary-50 transition-colors"
                      >
                        <Download size={14} /> Dosya İndir
                      </a>
                    </div>
                  </div>

                  {/* Son yorumlar */}
                  {comments.length > 0 && (
                    <div className="bg-white border border-surface-200 rounded-2xl p-5">
                      <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-3">Son Yorumlar</p>
                      <div className="space-y-2">
                        {comments.slice(-3).map(c => (
                          <div key={c.id} className="px-3 py-2 bg-surface-50 rounded-xl border border-surface-100">
                            <p className="text-[10px] font-bold text-surface-400 mb-0.5 capitalize">{c.authorType}</p>
                            <p className="text-[12px] text-text-secondary line-clamp-2">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-white text-[13px] font-bold shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-300
          ${toast.type === "success" ? "bg-emerald-500" : "bg-status-danger-500"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
