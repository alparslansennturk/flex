"use client";

import { GroupOption, Student } from "./types";
import { S, IC } from "./constants";
import { FlexSpinner } from "../../../_components/FlexSpinner";
import { GroupOptionsList } from "./GroupOptionsList";

interface AssignGroupModalProps {
  assignTarget: Student;
  groupOptions: GroupOption[];
  loadingGroups: boolean;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  /** Kişinin 2+ bekleyen satın alması aynı gruba eşleşebilir (aynı `id`, farklı `enrollmentId`) —
   * hangi satırın tıklandığını ayırt etmek için gerekli, bkz. GroupOptionsList. */
  selectedEnrollmentId: string;
  setSelectedEnrollmentId: (id: string) => void;
  assigning: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** "Gruba Ata" modalı — grupsuz bir kaydı seçilen gruba atar. */
export function AssignGroupModal({
  assignTarget, groupOptions, loadingGroups, selectedGroupId, setSelectedGroupId,
  selectedEnrollmentId, setSelectedEnrollmentId, assigning, onClose, onConfirm,
}: AssignGroupModalProps) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* head */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "22px 24px 16px", borderBottom: "1px solid #EEF0F3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DDE8F8", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
              dangerouslySetInnerHTML={{ __html: IC.userPlus }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>Gruba Ata</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                <strong style={{ color: "#414B59", fontWeight: 700 }}>{assignTarget.name}</strong> için bir grup seçin.
              </p>
            </div>
          </div>
          <button className="oh-iconbtn" style={{ ...S.bellBtn, width: 36, height: 36 }} onClick={onClose}>
            <span dangerouslySetInnerHTML={{ __html: IC.x }} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 16, maxHeight: 360, overflowY: "auto" }}>
          {loadingGroups ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "40px 20px" }}>
              <FlexSpinner />
              <div style={{ fontSize: 13, color: "#8E95A3" }}>Gruplar yükleniyor…</div>
            </div>
          ) : groupOptions.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 20px", textAlign: "center" }}>
              <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#414B59" }}>Henüz grup yok</div>
              <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 280 }}>Önce Sınıflar sayfasından bir grup oluşturun.</div>
            </div>
          ) : (
            <GroupOptionsList
              groupOptions={groupOptions}
              selectedGroupId={selectedGroupId}
              selectedEnrollmentId={selectedEnrollmentId}
              onSelect={(id, enrollmentId) => { setSelectedGroupId(id); setSelectedEnrollmentId(enrollmentId ?? ""); }}
            />
          )}
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 11, padding: "16px 24px 20px", borderTop: "1px solid #EEF0F3" }}>
          <button className="oh-clear" style={{ ...S.selectBtn, border: "1px solid #E2E5EA", color: "#6F7B87" }} onClick={onClose} disabled={assigning}>Vazgeç</button>
          <button className="oh-filter" style={{ ...S.filterBtn, opacity: !selectedGroupId || assigning ? 0.55 : 1, pointerEvents: !selectedGroupId || assigning ? "none" : "auto" }} onClick={onConfirm}>
            <span dangerouslySetInnerHTML={{ __html: IC.userPlus }} />
            {assigning ? "Atanıyor…" : "Gruba Ata"}
          </button>
        </div>
      </div>
    </div>
  );
}
