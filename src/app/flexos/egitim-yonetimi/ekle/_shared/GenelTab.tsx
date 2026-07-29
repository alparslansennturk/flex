"use client";

import type { FormState } from "./types";
import { S, IC } from "./constants";

export function GenelTab({ s, branches, onChange, patch, isBireysel, isKurumsal, yapiStd }: {
  s: FormState;
  branches: { id: string; name: string }[];
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  patch: (p: Partial<FormState>) => void;
  isBireysel: boolean;
  isKurumsal: boolean;
  yapiStd: boolean;
}) {
  return (
    <div style={{ maxWidth: 580 }}>
      {/* Branş — merkezî branş listesinden seçilir (ileride GET /api/flexos/branches'e bağlanacak). Şimdilik boş. */}
      <div style={{ marginBottom: 22 }}>
        <label style={S.label}>Branş</label>
        <div style={{ position: "relative" }}>
          <select className="ee-select" value={s.bransId} onChange={onChange("bransId")} style={S.select}>
            <option value="">{branches.length ? "Branş seçin…" : "Branş yok — Eğitim Ayarları › Branş Havuzu'ndan ekleyin"}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={S.label}>Eğitim Adı</label>
        <input className="ee-input" type="text" value={s.egitimAdi} onChange={onChange("egitimAdi")} placeholder="Örn: Python ile Yapay Zeka" style={S.input} />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 7 }}>
          Eğitim Adı (MEB)
          {!s.mebAdi && (
            <span style={S.mirrorChip}>
              <span dangerouslySetInnerHTML={{ __html: IC.copy }} />
              varsayılan: eğitim adı
            </span>
          )}
        </label>
        <input className="ee-input" type="text" value={s.mebAdi || s.egitimAdi} onChange={(e) => patch({ mebAdi: e.target.value })} placeholder="MEB kayıt adı (farklıysa düzenleyin)" style={S.input} />
      </div>

      {/* Eğitim Yapısı yalnız Bireysel'de anlamlı (Kurumsal = gün bazlı program). */}
      {isBireysel && (
        <div style={{ marginBottom: 22 }}>
          <label style={S.label}>Eğitim Yapısı</label>
          <div style={S.segWrap}>
            <button onClick={() => patch({ egitimYapisi: "Standart Paket" })} style={yapiStd ? S.segOn : S.segOff}>Standart Paket</button>
            <button onClick={() => patch({ egitimYapisi: "Track Bazlı" })} style={yapiStd ? S.segOff : S.segOn}>Track Bazlı</button>
          </div>
          <p style={{ margin: "7px 2px 0", fontSize: 12, color: "#94a3b8" }}>Standart Paket = tek satış. Track Bazlı = bölüm/track olarak parça parça satış.</p>
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <label style={S.label}>Eğitim Tipi</label>
        <div style={{ position: "relative" }}>
          <select className="ee-select" value={s.egitimTipi} onChange={onChange("egitimTipi")} style={S.select}>
            <option value="Bireysel">Bireysel</option>
            <option value="Kurumsal">Kurumsal</option>
          </select>
          <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
        </div>
      </div>

      {/* Satış Modeli (Kurumsal'da pasif) */}
      <div style={{ marginBottom: 22, opacity: isBireysel ? 1 : 0.55, pointerEvents: isBireysel ? "auto" : "none", transition: "opacity .18s" }}>
        <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 7 }}>
          Satış Modeli
          {isBireysel ? <span style={S.pillIndigo}>bireysel</span> : <span style={S.pillGray}>kurumsal</span>}
        </label>
        <div style={{ position: "relative" }}>
          <select className="ee-select" value={s.satisModeli} onChange={onChange("satisModeli")} disabled={isKurumsal} style={{ ...S.select, cursor: isBireysel ? "pointer" : "not-allowed", opacity: isBireysel ? 1 : 0.65 }}>
            <option value="Grup Eğitimi">Grup Eğitimi</option>
            <option value="Özel Ders">Özel Ders</option>
          </select>
          <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={S.label}>Eğitim Ortamı</label>
        <div style={{ position: "relative" }}>
          <select className="ee-select" value={s.egitimOrtami} onChange={onChange("egitimOrtami")} style={S.select}>
            <option value="Yüz Yüze">Yüz Yüze</option>
            <option value="Online">Online</option>
            <option value="Hibrit">Hibrit</option>
          </select>
          <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
        </div>
      </div>

      {/* Eğitim Süresi — bireysel: saat, kurumsal: gün sayısı ayrıca aşağıda */}
      {isBireysel && (
        <div style={{ marginBottom: 22 }}>
          <label style={S.label}>Eğitim Süresi (Saat)</label>
          <input className="ee-input" type="number" min={1} max={9999} value={s.egitimSuresi} onChange={onChange("egitimSuresi")} placeholder="Toplam saat" style={{ ...S.input, width: 180 }} />
          <p style={{ margin: "7px 2px 0", fontSize: 12, color: "#94a3b8" }}>Full paket toplam süresi. Bölümlü eğitimlerde İçerikler sekmesinden bölümlere dağıtılır.</p>
        </div>
      )}

      {/* Kurumsal = gün bazlı program → gün sayısı (Süre tipi Eğitim Tipi'nden türetilir). */}
      {isKurumsal && (
        <div style={{ marginBottom: 22, animation: "ee-slide .25s ease", overflow: "hidden" }}>
          <label style={S.label}>Toplam Gün Sayısı</label>
          <input className="ee-input" type="number" min={1} max={60} value={s.gunSayisi} onChange={onChange("gunSayisi")} style={{ ...S.input, width: 160 }} />
          <p style={{ margin: "7px 2px 0", fontSize: 12, color: "#94a3b8" }}>İçerikler sekmesinde gün gün planlama kartları oluşturur.</p>
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <label style={S.label}>Sözleşme Tipi</label>
        <div style={{ position: "relative" }}>
          <select className="ee-select" value={s.sozlesmeTipi} onChange={onChange("sozlesmeTipi")} style={S.select}>
            <option value="Mesafeli Satış Sözleşmesi">Mesafeli Satış Sözleşmesi</option>
            <option value="Kurumsal Hizmet Sözleşmesi">Kurumsal Hizmet Sözleşmesi</option>
            <option value="Bireysel Eğitim Sözleşmesi">Bireysel Eğitim Sözleşmesi</option>
            <option value="Ön Kayıt Protokolü">Ön Kayıt Protokolü</option>
          </select>
          <span style={S.selChev} dangerouslySetInnerHTML={{ __html: IC.selChev }} />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={S.label}>KDV Oranı (%)</label>
        <input className="ee-input" type="number" min={0} max={100} value={s.kdvOrani} onChange={onChange("kdvOrani")} style={{ ...S.input, width: 160 }} />
      </div>

      <div style={{ marginBottom: 4 }}>
        <label style={S.label}>
          Açıklama <span style={{ color: "#94a3b8", fontWeight: 500 }}>· web sitesi pazarlama metni</span>
        </label>
        <div className="ee-editor" style={{ border: "1px solid #e3e8f0", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "7px 10px", borderBottom: "1px solid #eef1f6", background: "#fafbfd" }}>
            <span className="ee-fmt" style={{ ...S.fmtBtn, fontWeight: 800 }}>B</span>
            <span className="ee-fmt" style={{ ...S.fmtBtn, fontStyle: "italic" }}>I</span>
            <span className="ee-fmt" style={{ ...S.fmtBtn, textDecoration: "underline" }}>U</span>
            <span style={{ width: 1, height: 18, background: "#e2e8f1", margin: "0 6px" }} />
            <span className="ee-fmt" style={S.fmtBtn} dangerouslySetInnerHTML={{ __html: IC.list }} />
            <span className="ee-fmt" style={S.fmtBtn} dangerouslySetInnerHTML={{ __html: IC.link }} />
          </div>
          <textarea value={s.aciklama} onChange={onChange("aciklama")} rows={4} placeholder="Eğitimin kazanımlarını, hedef kitlesini ve içeriğini pazarlama diliyle anlatın…" style={S.textarea} />
        </div>
      </div>
    </div>
  );
}
