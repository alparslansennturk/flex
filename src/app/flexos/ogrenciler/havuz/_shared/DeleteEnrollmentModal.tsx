"use client";

import { Student } from "./types";
import { S, IC } from "./constants";

interface DeleteTarget { student: Student; enrollmentId: string; label: string }

interface DeleteEnrollmentModalProps {
  deleteTarget: DeleteTarget;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** "Tamamen Sil" onay modalı — hard-delete, geri alınamaz (asıl güvenlik sunucu tarafında). */
export function DeleteEnrollmentModal({ deleteTarget, deleting, onClose, onConfirm }: DeleteEnrollmentModalProps) {
  return (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} style={S.modalOverlay} onClick={onClose}>
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} style={{ ...S.modal, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        {/* head */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "22px 24px 16px", borderBottom: "1px solid #EEF0F3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEE2E2", color: "#D93636", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
              dangerouslySetInnerHTML={{ __html: IC.trash }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>Kaydı Tamamen Sil</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                <strong style={{ color: "#414B59", fontWeight: 700 }}>{deleteTarget.student.name}</strong> — {deleteTarget.label}
              </p>
            </div>
          </div>
          <button type="button" className="oh-iconbtn" style={{ ...S.bellBtn, width: 36, height: 36 }} onClick={onClose} disabled={deleting}>
            <span dangerouslySetInnerHTML={{ __html: IC.x }} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: "18px 24px" }}>
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <span style={{ color: "#D93636", flex: "0 0 auto" }} dangerouslySetInnerHTML={{ __html: IC.alert }} />
            <p style={{ margin: 0, fontSize: 13, color: "#991B1B", fontWeight: 500, lineHeight: 1.5 }}>
              Bu işlem <strong>geri alınamaz</strong> — kayıt veritabanından tamamen silinir (gruptan çıkarmadan farklı).
              Öğrenci ve diğer kayıtları etkilenmez. Bu kayıt bir satışa bağlıysa veya notu girilmişse sunucu
              işlemi zaten reddedecektir.
            </p>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 11, padding: "4px 24px 20px" }}>
          <button type="button" className="oh-clear" style={{ ...S.selectBtn, border: "1px solid #E2E5EA", color: "#6F7B87" }} onClick={onClose} disabled={deleting}>Vazgeç</button>
          <button type="button"
            style={{ ...S.filterBtn, background: "linear-gradient(135deg,#EF4444,#D93636)", boxShadow: "0 8px 18px -8px rgba(217,54,54,.5)", opacity: deleting ? 0.6 : 1, pointerEvents: deleting ? "none" : "auto" }}
            onClick={onConfirm}
          >
            <span dangerouslySetInnerHTML={{ __html: IC.trash }} />
            {deleting ? "Siliniyor…" : "Tamamen Sil"}
          </button>
        </div>
      </div>
    </div>
  );
}
