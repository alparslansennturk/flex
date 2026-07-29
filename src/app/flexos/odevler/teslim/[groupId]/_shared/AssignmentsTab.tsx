"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/app/lib/client/auth-headers";
import type { AssignmentStatus } from "../../../_shared/EditAssignmentModal";
import type { AssignmentAttachment, AssignmentItem, SubmissionRow } from "./types";
import { fmtEndDate } from "./format";
import { TaskAccordion } from "./TaskAccordion";

type Filter = "all" | "active" | "completed" | "archived";

export function AssignmentsTab({ assignments, submissions, totalStudents, groupId, focusAssignmentId, onEdit, onAttachmentsChanged, onDeleted, onStatusChanged }: {
  assignments: AssignmentItem[]; submissions: SubmissionRow[]; totalStudents: number; groupId: string; focusAssignmentId: string | null; onEdit: (a: AssignmentItem) => void; onAttachmentsChanged: (assignmentId: string, attachments: AssignmentAttachment[]) => void; onDeleted: (assignmentId: string) => void; onStatusChanged: (assignmentId: string, status: AssignmentStatus) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  // İptal edilen (arşivlenen) ödevler Aktif/Tamamlanan'a hiç karışmaz — eskiden bu ayrım
  // SADECE teslim tarihine bakıyordu, `status==="archived"` hiç kontrol edilmediği için
  // iptal edilmiş ama tarihi ileride olan bir ödev hâlâ "Aktif Ödevler"de listeleniyordu.
  // Arşivlenenler artık ayrı bir "Arşiv" sekmesinde, "Geri Al"/kalıcı silme aksiyonuyla görünüyor.
  const visibleAssignments = assignments.filter((a) => a.status !== "archived");
  // "closed" (Notları Kaydet / Ödevi Bitir ile tamamlanmış) ödev, teslim tarihi ileride
  // olsa bile "Tamamlananlar"da görünmeli — 2026-07-29 fix, bkz. `gradeBatch` yorumu.
  const activeAssignments = visibleAssignments
    .filter((a) => { if (a.status === "closed") return false; const d = a.dueDate ? new Date(a.dueDate) : null; return d ? d >= today : true; })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const completedAssignments = visibleAssignments
    .filter((a) => { if (a.status === "closed") return true; const d = a.dueDate ? new Date(a.dueDate) : null; return !!d && d < today; })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const archivedAssignments = assignments
    .filter((a) => a.status === "archived")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "active", label: "Aktif Ödevler" },
    { key: "completed", label: "Tamamlananlar" },
    { key: "archived", label: "Arşiv" },
  ];
  const showActive = filter === "all" || filter === "active";
  const showCompleted = filter === "all" || filter === "completed";
  const showArchived = filter === "archived";

  return (
    <div>
      <div className="w-full rounded-2xl mb-6" style={{ height: 220, backgroundColor: "#F91079" }} />

      <div className="flex items-center gap-2 mb-7">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-[13px] border transition-colors cursor-pointer
              ${filter === f.key
                ? "bg-white border-surface-300 text-text-primary font-semibold shadow-sm"
                : "bg-transparent border-surface-200 text-surface-500 font-medium hover:border-surface-300 hover:text-surface-700"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showActive && activeAssignments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[18px] font-bold text-text-primary mb-3">Aktif Ödevler</h2>
          <div className="space-y-3">
            {activeAssignments.map((a) => (
              <TaskAccordion key={a.id} assignment={a} submissions={submissions.filter((s) => s.assignmentId === a.id)} totalStudents={totalStudents} groupId={groupId} isActiveSection initialOpen={a.id === focusAssignmentId} onEdit={onEdit} onAttachmentsChanged={onAttachmentsChanged} onStatusChanged={onStatusChanged} />
            ))}
          </div>
        </section>
      )}

      {showCompleted && completedAssignments.length > 0 && (
        <section>
          <h2 className="text-[18px] font-bold text-text-primary mb-3">Tamamlananlar</h2>
          <div className="space-y-3">
            {completedAssignments.map((a) => (
              <TaskAccordion key={a.id} assignment={a} submissions={submissions.filter((s) => s.assignmentId === a.id)} totalStudents={totalStudents} groupId={groupId} isActiveSection={false} initialOpen={a.id === focusAssignmentId} onEdit={onEdit} onAttachmentsChanged={onAttachmentsChanged} onStatusChanged={onStatusChanged} />
            ))}
          </div>
        </section>
      )}

      {showArchived && (
        archivedAssignments.length > 0 ? (
          <section>
            <h2 className="text-[18px] font-bold text-text-primary mb-3">Arşiv</h2>
            <div className="space-y-3">
              {archivedAssignments.map((a) => (
                <ArchivedAssignmentCard key={a.id} assignment={a} onDeleted={onDeleted} onStatusChanged={onStatusChanged} />
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
            <BookOpen size={22} />
            <p className="text-[13px] font-medium">Arşivlenmiş ödev yok</p>
          </div>
        )
      )}

      {!showArchived && assignments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-surface-400">
          <BookOpen size={22} />
          <p className="text-[13px] font-medium">Bu gruba ait ödev yok</p>
        </div>
      )}
    </div>
  );
}

/** Arşivlenmiş (iptal edilmiş) ödev kartı — görüntüleme + "Geri Al" (2026-07-29, acil
 *  fix — eskiden SADECE kalıcı silme vardı, yanlışlıkla arşive düşen bir ödevin kurtarılacak
 *  hiçbir yolu yoktu) + kalıcı silme. Teslim/dosya yönetimi yok (TaskAccordion'un aksine,
 *  iptal edilmiş bir ödevde bunların anlamı kalmıyor). */
function ArchivedAssignmentCard({ assignment, onDeleted, onStatusChanged }: { assignment: AssignmentItem; onDeleted: (assignmentId: string) => void; onStatusChanged: (assignmentId: string, status: AssignmentStatus) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Bu ödevi KALICI olarak silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
    setDeleting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/assignments/${assignment.id}`, { method: "DELETE", headers });
      if (!res.ok) { toast.error("Ödev silinemedi."); return; }
      toast.success("Ödev kalıcı olarak silindi.");
      onDeleted(assignment.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) { toast.error("Geri alınamadı."); return; }
      toast.success("Ödev arşivden geri alındı.");
      onStatusChanged(assignment.id, "published");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-4 flex items-center justify-between gap-4 opacity-80">
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-text-primary truncate">{assignment.title}</p>
        {assignment.dueDate && <p className="text-[12px] text-surface-400 mt-0.5">{fmtEndDate(assignment.dueDate)}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
      <button
        onClick={handleRestore}
        disabled={restoring || deleting}
        className="h-8 px-4 rounded-full text-[12px] font-semibold border border-status-success-200 text-status-success-600 hover:bg-status-success-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {restoring ? "Geri Alınıyor…" : "Geri Al"}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting || restoring}
        className="h-8 px-4 rounded-full text-[12px] font-semibold border border-status-danger-200 text-status-danger-500 hover:bg-status-danger-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {deleting ? "Siliniyor…" : "Kalıcı Sil"}
      </button>
      </div>
    </div>
  );
}
