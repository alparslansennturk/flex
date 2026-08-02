"use client";

import { GroupOption } from "./types";
import { IC } from "./constants";

interface GroupOptionsListProps {
  groupOptions: GroupOption[];
  selectedGroupId: string;
  /** Gruba Ata'da aynı grup birden fazla bekleyen kayıt için aday olabilir (aynı `id`, farklı
   * `enrollmentId`) — hangi satırın seçildiğini ayırt etmek için gerekli. Grup Değiştir'de her
   * zaman tek kayıt taşındığından bu prop kullanılmaz/boş kalabilir. */
  selectedEnrollmentId?: string;
  onSelect: (id: string, enrollmentId?: string) => void;
}

/** Gruba Ata / Grup Değiştir modallerinin ortak grup seçim listesi (çakışan gruplar disabled). */
export function GroupOptionsList({ groupOptions, selectedGroupId, selectedEnrollmentId, onSelect }: GroupOptionsListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {groupOptions.map((g) => {
        const sel = selectedGroupId === g.id && (g.enrollmentId ?? "") === (selectedEnrollmentId ?? "");
        const blocked = !!g.conflictWith;
        return (
          <div key={`${g.id}-${g.enrollmentId}`} className={blocked ? undefined : "oh-grow"}
            onClick={() => { if (!blocked) onSelect(g.id, g.enrollmentId); }}
            title={blocked ? `${g.conflictWith} grubuyla saat/gün çakışıyor` : undefined}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, cursor: blocked ? "not-allowed" : "pointer", border: sel ? "1.5px solid #2867bd" : "1.5px solid #E2E5EA", background: sel ? "#EFF3FA" : "#fff", opacity: blocked ? 0.45 : 1 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: sel ? "5px solid #2867bd" : "2px solid #CDD2DA", transition: "all .12s" }} />
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "#f1f5f9", color: "#6F7B87", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}
              dangerouslySetInnerHTML={{ __html: IC.groupIcon }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B", whiteSpace: "nowrap" }}>{g.code}</div>
              <div style={{ fontSize: 12.5, color: blocked ? "#B42318" : "#8E95A3", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {blocked ? `${g.conflictWith} ile çakışıyor` : g.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
