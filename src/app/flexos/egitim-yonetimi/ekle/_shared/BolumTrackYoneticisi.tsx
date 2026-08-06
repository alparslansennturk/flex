"use client";

import type { FormState, Bolum, Track, EditingTrack, DragTrack } from "./types";
import { S, IC, addBtn } from "./constants";

export function BolumTrackYoneticisi({
  s, onChange, canAddBolum, addBolum, hasBolum, trackLocked, canAddTrack, addTrack,
  targetBolum, remainingHours, toggleTrackSell, onTrackTargetChange, removeBolum, removeTrack,
  editingTrack, setEditingTrack, startEditTrack, saveEditTrack, cancelEditTrack,
  dragTrack, dragBolum, onTrackDragStart, onTrackDragOver, onTrackDrop,
  onBolumDragStart, onBolumDragOver, onBolumDrop, setDragBolum, setDragTrack, totalHours,
}: {
  s: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  canAddBolum: boolean;
  addBolum: () => void;
  hasBolum: boolean;
  trackLocked: boolean;
  canAddTrack: boolean;
  addTrack: () => void;
  targetBolum: Bolum | undefined;
  remainingHours: number;
  toggleTrackSell: () => void;
  onTrackTargetChange: (val: string) => void;
  removeBolum: (id: number) => void;
  removeTrack: (bId: number, tId: number) => void;
  editingTrack: EditingTrack | null;
  setEditingTrack: (v: EditingTrack | null) => void;
  startEditTrack: (bId: number, t: Track) => void;
  saveEditTrack: () => void;
  cancelEditTrack: () => void;
  dragTrack: DragTrack | null;
  dragBolum: number | null;
  onTrackDragStart: (bId: number, tId: number) => void;
  onTrackDragOver: (e: React.DragEvent) => void;
  onTrackDrop: (bId: number, targetTId: number) => void;
  onBolumDragStart: (bId: number) => void;
  onBolumDragOver: (e: React.DragEvent) => void;
  onBolumDrop: (targetBId: number) => void;
  setDragBolum: (v: number | null) => void;
  setDragTrack: (v: DragTrack | null) => void;
  totalHours: () => number;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: "#0f1f3d" }}>Bölüm &amp; Track Yöneticisi</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", background: "#f3e8ff", padding: "3px 10px", borderRadius: 999 }}>track bazlı · parçalanabilir</span>
      </div>

      {/* Bölüm Ekle */}
      <div style={S.panel}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 11, letterSpacing: ".01em" }}>Bölüm Ekle</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input className="ee-input" type="text" value={s.dBolumAd} onChange={onChange("dBolumAd")} placeholder="Bölüm adı — örn: Grafik-1" style={S.inputSm} />
          </div>
          <div style={{ width: 140 }}>
            <input className="ee-input" type="number" min={0} value={s.dBolumSaat} onChange={onChange("dBolumSaat")} placeholder="Toplam saat" style={S.inputSm} />
          </div>
          <button type="button" onClick={addBolum} disabled={!canAddBolum} style={addBtn(canAddBolum, "#4f46e5")}>
            <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />Bölüm Ekle
          </button>
        </div>
      </div>

      {/* Track Ekle */}
      <div style={{ ...S.panel, opacity: trackLocked ? 0.6 : 1, transition: "opacity .18s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>Track Ekle</div>
          {trackLocked && (
            <span style={S.lockChip}>
              <span dangerouslySetInnerHTML={{ __html: IC.lock }} />Önce en az bir bölüm ekleyin
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <div style={{ width: 190 }}>
            <div style={{ position: "relative" }}>
              <select className="ee-select" value={s.dTrackTarget} onChange={(e) => onTrackTargetChange(e.target.value)} disabled={trackLocked} style={S.selectSm}>
                {hasBolum
                  ? s.bolumler.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)
                  : <option value="">Önce bölüm ekleyin</option>}
              </select>
              <span style={S.selChevSm} dangerouslySetInnerHTML={{ __html: IC.selChevSm }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 170 }}>
            <input className="ee-input" type="text" value={s.dTrackAd} onChange={onChange("dTrackAd")} disabled={trackLocked} placeholder="Track adı — örn: Adobe Photoshop" style={S.inputSm} />
          </div>
          <button type="button" onClick={addTrack} disabled={!canAddTrack} style={addBtn(canAddTrack, "#4f46e5")}>
            <span dangerouslySetInnerHTML={{ __html: IC.plusSm }} />Track Ekle
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 13, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Track Saati</span>
            <input className="ee-input" type="number" min={1} max={remainingHours > 0 ? remainingHours : undefined} value={s.dTrackSaat} onChange={onChange("dTrackSaat")} disabled={trackLocked} placeholder="zorunlu" style={S.inputTrackHours} />
            {targetBolum && <span style={{ fontSize: 12, fontWeight: 600, color: remainingHours > 0 ? "#16a34a" : "#dc2626" }}>Kalan: {remainingHours} saat</span>}
          </div>
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => !trackLocked && toggleTrackSell()} style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: trackLocked ? "not-allowed" : "pointer", userSelect: "none" }}>
            <span style={{ ...S.checkbox, border: s.dTrackSell ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: s.dTrackSell ? "#4f46e5" : "#fff" }}>
              {s.dTrackSell && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>Bu Track tek başına satılabilir</span>
          </div>
          {s.dTrackSell && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, animation: "ee-fade .2s ease" }}>
            </div>
          )}
        </div>
      </div>

      {/* ağaç görünümü */}
      <div style={{ marginTop: 20 }}>
        {/* otomatik ana başlık — eğitim adı + toplam saat (bölümlerin toplamı) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 14px", borderBottom: "2px solid #eef1f6", marginBottom: 14 }}>
          <span style={{ fontSize: 19, fontWeight: 800, color: "#0f1f3d", letterSpacing: "-.3px" }}>
            {s.egitimAdi.trim() || "Eğitim Adı"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#4338ca", background: "#e8ecfd", padding: "4px 12px", borderRadius: 999 }}>
            {totalHours()} Saat
          </span>
        </div>
        {!hasBolum && (
          <div style={S.emptyBox}>
            <div style={S.emptyIcon} dangerouslySetInnerHTML={{ __html: IC.folderBig }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "#334155" }}>Henüz bölüm yok</div>
            <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 300 }}>Yukarıdan ilk bölümü ekleyin; ardından altına track tanımlayabilirsiniz.</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {s.bolumler.map((b) => (
            <div
              key={b.id}
              onDragOver={onBolumDragOver}
              onDrop={(e) => { e.preventDefault(); if (dragBolum !== null) onBolumDrop(b.id); }}
              style={{ border: "1px solid #e9edf4", borderRadius: 14, overflow: "hidden", opacity: dragBolum === b.id ? 0.4 : 1, transition: "opacity .15s" }}
            >
              <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); onBolumDragStart(b.id); }}
                onDragEnd={() => setDragBolum(null)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: "#f8fafc", borderBottom: "1px solid #eef1f6", cursor: "grab" }}
              >
                <span style={{ ...S.bolumIcon, cursor: "grab" }} dangerouslySetInnerHTML={{ __html: IC.folder }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#0f1f3d", flex: 1 }}>{b.name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", background: "#eef2f8", padding: "4px 11px", borderRadius: 999 }}>{(Number(b.hours) || 0)} Saat</span>
                <button type="button" className="ee-del" title="Bölümü sil" style={S.smDelBtn} onClick={() => removeBolum(b.id)}>
                  <span dangerouslySetInnerHTML={{ __html: IC.trashSm }} />
                </button>
              </div>
              <div style={{ padding: "8px 16px 8px 30px" }}>
                {b.tracks.length === 0 && <div style={{ fontSize: 12.5, color: "#94a3b8", padding: "8px 4px" }}>Bu bölümde henüz track yok.</div>}
                {b.tracks.map((t) => {
                  const isEditing = editingTrack?.bId === b.id && editingTrack?.tId === t.id;
                  const isDragging = dragTrack?.bId === b.id && dragTrack?.tId === t.id;
                  return isEditing ? (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", borderBottom: "1px solid #f4f6fa", background: "#f0f4ff", borderRadius: 8 }}>
                      <span style={S.trackIcon} dangerouslySetInnerHTML={{ __html: IC.file }} />
                      <input className="ee-input" type="text" value={editingTrack.name} onChange={(e) => setEditingTrack({ ...editingTrack, name: e.target.value })} style={{ ...S.inputSm, flex: 1, fontSize: 13.5 }} autoFocus />
                      <input className="ee-input" type="number" min={1} value={editingTrack.hours} onChange={(e) => setEditingTrack({ ...editingTrack, hours: e.target.value })} style={{ ...S.inputTrackHours, width: 70 }} />
                      <span style={{ fontSize: 12, color: "#64748b" }}>saat</span>
                      <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => setEditingTrack({ ...editingTrack, sellable: !editingTrack.sellable })} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", userSelect: "none" }}>
                        <span style={{ ...S.checkbox, width: 16, height: 16, border: editingTrack.sellable ? "1.5px solid #4f46e5" : "1.5px solid #cbd5e1", background: editingTrack.sellable ? "#4f46e5" : "#fff" }}>
                          {editingTrack.sellable && <span dangerouslySetInnerHTML={{ __html: IC.checkWhite }} />}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Satılabilir</span>
                      </div>
                      <button type="button" onClick={saveEditTrack} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Kaydet</button>
                      <button type="button" onClick={cancelEditTrack} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>İptal</button>
                    </div>
                  ) : (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); onTrackDragStart(b.id, t.id); }}
                      onDragOver={(e) => { e.stopPropagation(); onTrackDragOver(e); }}
                      onDrop={(e) => { e.stopPropagation(); onTrackDrop(b.id, t.id); }}
                      onDragEnd={() => { setDragTrack(null); setDragBolum(null); }}
                      style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 4px", borderBottom: "1px solid #f4f6fa", opacity: isDragging ? 0.4 : 1, cursor: "grab", transition: "opacity .15s" }}
                    >
                      <span style={{ ...S.trackIcon, cursor: "grab" }} dangerouslySetInnerHTML={{ __html: IC.file }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#334155", flex: 1 }}>{t.name}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>{(Number(t.hours) || 0)} Saat</span>
                      {t.sellable && (
                        <span style={S.sellChip}>
                          <span dangerouslySetInnerHTML={{ __html: IC.sellSm }} />Satışa Açık
                        </span>
                      )}
                      <button type="button" title="Track düzenle" style={{ ...S.xsDelBtn, color: "#4f46e5" }} onClick={() => startEditTrack(b.id, t)}>
                        <span dangerouslySetInnerHTML={{ __html: IC.editSm }} />
                      </button>
                      <button type="button" className="ee-del" title="Track sil" style={S.xsDelBtn} onClick={() => removeTrack(b.id, t.id)}>
                        <span dangerouslySetInnerHTML={{ __html: IC.xSm }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
