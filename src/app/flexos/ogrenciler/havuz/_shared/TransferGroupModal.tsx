"use client";

import { GroupOption, Student } from "./types";
import { S, IC } from "./constants";
import { FlexSpinner } from "../../../_components/FlexSpinner";
import { GroupOptionsList } from "./GroupOptionsList";

interface TransferTarget { student: Student; enrollmentId: string; groupId: string; groupLabel: string }

interface TransferGroupModalProps {
  transferTarget: TransferTarget;
  groupOptions: GroupOption[];
  loadingGroups: boolean;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  transferCloseAs: "completed" | "cancelled" | null;
  setTransferCloseAs: (v: "completed" | "cancelled") => void;
  transferring: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** "Grup Değiştir" modalı — zaten gruplu bir kaydı başka gruba taşır, eski kaydın kapanış durumu sorulur. */
export function TransferGroupModal({
  transferTarget, groupOptions, loadingGroups, selectedGroupId, setSelectedGroupId,
  transferCloseAs, setTransferCloseAs, transferring, onClose, onConfirm,
}: TransferGroupModalProps) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* head */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "22px 24px 16px", borderBottom: "1px solid #EEF0F3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#DDE8F8", color: "#205297", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
              dangerouslySetInnerHTML={{ __html: IC.transfer }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.3px", color: "#1E222B" }}>Grup Değiştir</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#8E95A3", fontWeight: 500 }}>
                <strong style={{ color: "#414B59", fontWeight: 700 }}>{transferTarget.student.name}</strong> için <strong style={{ color: "#414B59", fontWeight: 700 }}>{transferTarget.groupLabel}</strong> yerine yeni bir grup seçin.
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
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#414B59" }}>Taşınabilecek başka grup yok</div>
              <div style={{ fontSize: 13, color: "#8E95A3", maxWidth: 280 }}>Önce Sınıflar sayfasından uygun bir grup oluşturun.</div>
            </div>
          ) : (
            <GroupOptionsList groupOptions={groupOptions} selectedGroupId={selectedGroupId} onSelect={setSelectedGroupId} />
          )}

          {!loadingGroups && groupOptions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #EEF0F3" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#414B59", marginBottom: 3 }}>
                <strong style={{ color: "#414B59" }}>{transferTarget.groupLabel}</strong>&apos;daki kayıt nasıl kapansın?
              </div>
              <div style={{ fontSize: 11.5, color: "#8E95A3", marginBottom: 9 }}>Sistem bunu bilemez — hangisi olduğunu siz seçmelisiniz.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([
                  { key: "completed" as const, title: "Modül/Ders tamamlandı — Mezun", desc: "Öğrenci bu bölümü/dersi bitirdi, sertifika/not burada donar." },
                  { key: "cancelled" as const, title: "Sadece sınıf değişikliği — Mezun DEĞİL", desc: "Ders henüz bitmedi, başka bir sebeple (saat/lokasyon vb.) sınıf değişti." },
                ]).map((opt) => {
                  const sel = transferCloseAs === opt.key;
                  return (
                    <div key={opt.key} className="oh-grow" onClick={() => setTransferCloseAs(opt.key)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", borderRadius: 12, cursor: "pointer", border: sel ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: sel ? "#EFF3FA" : "#fff" }}>
                      <span style={{ width: 18, height: 18, marginTop: 1, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: sel ? "5px solid #2867bd" : "2px solid #CDD2DA", transition: "all .12s" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E222B" }}>{opt.title}</div>
                        <div style={{ fontSize: 12, color: "#8E95A3", fontWeight: 500, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 11, padding: "16px 24px 20px", borderTop: "1px solid #EEF0F3" }}>
          <button className="oh-clear" style={{ ...S.selectBtn, border: "1px solid #E2E5EA", color: "#6F7B87" }} onClick={onClose} disabled={transferring}>Vazgeç</button>
          <button className="oh-filter" style={{ ...S.filterBtn, opacity: !selectedGroupId || !transferCloseAs || transferring ? 0.55 : 1, pointerEvents: !selectedGroupId || !transferCloseAs || transferring ? "none" : "auto" }} onClick={onConfirm}>
            <span dangerouslySetInnerHTML={{ __html: IC.transfer }} />
            {transferring ? "Taşınıyor…" : "Gruba Taşı"}
          </button>
        </div>
      </div>
    </div>
  );
}
