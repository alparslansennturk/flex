"use client";

import { IC, S } from "./constants";

interface DeleteModalProps {
  trainerName: string | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

/** Eğitmen silme onay modalı — geri alınamaz uyarısı. */
export function DeleteModal({ trainerName, onClose, onConfirm }: DeleteModalProps) {
  return (
    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={onClose} style={S.overlay}>
      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={(e) => e.stopPropagation()} style={S.modal}>
        <div style={{ padding: "26px 26px 20px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: "#FFECEC", display: "flex", alignItems: "center", justifyContent: "center", color: "#D93636", marginBottom: 16 }}>
            <span dangerouslySetInnerHTML={{ __html: IC.trashLg }} />
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.3px" }}>Eğitmeni sil</h3>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "#6F7B87" }}>
            <strong style={{ color: "#1E222B", fontWeight: 700 }}>{trainerName}</strong> kaydını silmek üzeresiniz. Bu işlem geri alınamaz; eğitmenin yetkinlik ve not geçmişi de kaldırılır.
          </p>
        </div>
        <div style={{ display: "flex", gap: 11, padding: "16px 26px 22px", justifyContent: "flex-end" }}>
          <button type="button" className="sg-cancel" onClick={onClose} style={S.cancelBtn}>Vazgeç</button>
          <button type="button" className="sg-confirm-del" onClick={onConfirm} style={S.confirmDelBtn}>
            <span dangerouslySetInnerHTML={{ __html: IC.trashWhite }} /> Evet, sil
          </button>
        </div>
      </div>
    </div>
  );
}
