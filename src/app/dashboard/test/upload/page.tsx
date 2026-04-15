"use client";

/**
 * TEST SAYFASI — /dashboard/test/upload
 *
 * Bu sayfa sadece geliştirme ve test amaçlıdır.
 * Production'a geçişte bu route kaldırılacak,
 * componentler production sayfasına bağlanacak.
 */

import { useState, useCallback } from "react";
import { FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import UploadForm       from "@/app/components/upload/UploadForm";
import SubmissionList   from "@/app/components/upload/SubmissionList";
import CommentSection   from "@/app/components/upload/CommentSection";
import type { Submission, Comment } from "@/app/types/submission";

// ─── Test ID girişi ───────────────────────────────────────────────────────────

function IDField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-[11px] font-bold text-surface-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`${label} gir…`}
        className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-surface-50 text-[12px] font-mono text-base-primary-900 outline-none focus:border-base-primary-400 focus:bg-white transition-all"
      />
    </div>
  );
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────

export default function UploadTestPage() {
  const [studentId, setStudentId] = useState("");
  const [taskId,    setTaskId]    = useState("");
  const [groupId,   setGroupId]   = useState("");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [comments,    setComments]    = useState<Comment[]>([]);
  const [showIds,     setShowIds]     = useState(true);

  const idsReady = studentId.trim() && taskId.trim() && groupId.trim();

  const handleSuccess = useCallback((sub: Submission) => {
    setSubmissions(prev => [sub, ...prev]);
  }, []);

  const handleAddComment = useCallback(async (body: string) => {
    // Test modunda gerçek API yerine lokal state'e ekle
    const mockComment: Comment = {
      id:           `mock_${Date.now()}`,
      submissionId: submissions[0]?.id ?? "test",
      authorId:     "test_teacher",
      authorType:   "teacher",
      authorName:   "Eğitmen (Test)",
      body,
      createdAt:    new Date(),
    };
    setComments(prev => [...prev, mockComment]);
  }, [submissions]);

  const latestStatus = submissions[0]?.status;

  return (
    <div className="w-full max-w-[1920px] mx-auto px-8 py-8 space-y-6">

      {/* Test banner */}
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-yellow-50 border border-yellow-200">
        <FlaskConical size={16} className="text-yellow-500 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-bold text-yellow-800">Test Ortamı</p>
          <p className="text-[12px] text-yellow-600">
            Bu sayfa sadece geliştirme amaçlıdır. Production'da görünmez.
            Route: <code className="font-mono">/dashboard/test/upload</code>
          </p>
        </div>
      </div>

      {/* ID Girişi */}
      <div className="bg-white rounded-16 border border-surface-100 shadow-sm">
        <button
          onClick={() => setShowIds(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 cursor-pointer"
        >
          <span className="text-[13px] font-bold text-base-primary-900">Test ID&apos;leri</span>
          {showIds ? <ChevronUp size={15} className="text-surface-400" /> : <ChevronDown size={15} className="text-surface-400" />}
        </button>

        {showIds && (
          <div className="px-6 pb-5 flex flex-wrap gap-3 border-t border-surface-100 pt-4">
            <IDField label="Student ID" value={studentId} onChange={setStudentId} />
            <IDField label="Task ID"    value={taskId}    onChange={setTaskId}    />
            <IDField label="Group ID"   value={groupId}   onChange={setGroupId}   />
          </div>
        )}
      </div>

      {/* Ana içerik */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sol: Yükleme formu */}
        <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-6 py-5 space-y-4">
          <div>
            <h2 className="text-[15px] font-bold text-base-primary-900">Ödev Teslim</h2>
            <p className="text-[12px] text-surface-400 mt-0.5">UploadForm componenti</p>
          </div>

          {idsReady ? (
            <UploadForm
              studentId={studentId.trim()}
              taskId={taskId.trim()}
              groupId={groupId.trim()}
              currentStatus={latestStatus}
              onSuccess={handleSuccess}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="text-[13px] text-surface-400">Yukarıdaki ID alanlarını doldur</p>
            </div>
          )}
        </div>

        {/* Sağ: Teslim geçmişi */}
        <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-6 py-5 space-y-4">
          <div>
            <h2 className="text-[15px] font-bold text-base-primary-900">Teslim Geçmişi</h2>
            <p className="text-[12px] text-surface-400 mt-0.5">SubmissionList componenti</p>
          </div>
          <SubmissionList submissions={submissions} />
        </div>

        {/* Alt: Yorum bölümü */}
        <div className="bg-white rounded-16 border border-surface-100 shadow-sm px-6 py-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-[15px] font-bold text-base-primary-900">Yorumlar</h2>
            <p className="text-[12px] text-surface-400 mt-0.5">
              CommentSection componenti · Test modunda yorumlar sadece local state&apos;te tutulur
            </p>
          </div>
          <CommentSection
            comments={comments}
            currentAuthorId="test_teacher"
            currentAuthorType="teacher"
            currentAuthorName="Test Eğitmen"
            onAddComment={handleAddComment}
            disabled={!idsReady}
          />
        </div>
      </div>
    </div>
  );
}
