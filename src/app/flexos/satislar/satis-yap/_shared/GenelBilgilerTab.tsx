"use client";

import { AnimatePresence, motion } from "framer-motion";
import { formatTrPhone } from "@/app/lib/phone";
import { Uyruk } from "./types";
import { S, IC, uyrukCard, uyrukRadio } from "./constants";
import { SectionTitle, Label, SelectWrap } from "./ui";

interface GenelBilgilerTabProps {
  ad: string; setAd: (v: string) => void;
  soyad: string; setSoyad: (v: string) => void;
  dogumTarihi: string; setDogumTarihi: (v: string) => void;
  cinsiyet: string; setCinsiyet: (v: string) => void;
  uyruk: Uyruk; setUyruk: (v: Uyruk) => void;
  tcNo: string; setTcNo: (v: string) => void;
  pasaportNo: string; setPasaportNo: (v: string) => void;
  existingPerson: { name: string; enrollments: { educationName: string; statusLabel: string }[] } | null;
  isMinor: boolean;
  veliAd: string; setVeliAd: (v: string) => void;
  veliTc: string; setVeliTc: (v: string) => void;
  telefon: string; setTelefon: (v: string) => void;
  eposta: string; setEposta: (v: string) => void;
  calismaDurumu: string; setCalismaDurumu: (v: string) => void;
  adres: string; setAdres: (v: string) => void;
}

/** Satış Yap · Tab 1 — Kişisel bilgiler, uyruk/kimlik, 18 yaş altı veli sözleşmesi, iletişim, adres. */
export function GenelBilgilerTab({
  ad, setAd, soyad, setSoyad, dogumTarihi, setDogumTarihi, cinsiyet, setCinsiyet,
  uyruk, setUyruk, tcNo, setTcNo, pasaportNo, setPasaportNo, existingPerson,
  isMinor, veliAd, setVeliAd, veliTc, setVeliTc,
  telefon, setTelefon, eposta, setEposta, calismaDurumu, setCalismaDurumu, adres, setAdres,
}: GenelBilgilerTabProps) {
  const isTc = uyruk === "TC";
  const isYabanci = uyruk === "Yabanci";

  return (
    <>
      <SectionTitle>Kişisel Bilgiler</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 26 }}>
        <div>
          <Label>Adı</Label>
          <input type="text" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Örn: Ayşe" style={S.input} />
        </div>
        <div>
          <Label>Soyadı</Label>
          <input type="text" value={soyad} onChange={(e) => setSoyad(e.target.value)} placeholder="Örn: Yılmaz" style={S.input} />
        </div>
        <div>
          <Label>Doğum Tarihi</Label>
          <input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)} style={S.input} />
        </div>
        <div>
          <Label>Cinsiyet</Label>
          <SelectWrap>
            <select value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)} style={S.select}>
              <option value="">Seçiniz</option>
              <option value="Kadın">Kadın</option>
              <option value="Erkek">Erkek</option>
              <option value="Belirtmek istemiyorum">Belirtmek istemiyorum</option>
            </select>
          </SelectWrap>
        </div>
      </div>

      <SectionTitle>Uyruk &amp; Kimlik</SectionTitle>
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div onClick={() => setUyruk("TC")} style={uyrukCard(isTc)}>
          <span style={uyrukRadio(isTc)}>{isTc && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4f46e5" }} />}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>T.C. Vatandaşı</span>
        </div>
        <div onClick={() => setUyruk("Yabanci")} style={uyrukCard(isYabanci)}>
          <span style={uyrukRadio(isYabanci)}>{isYabanci && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4f46e5" }} />}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Yabancı Uyruklu</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: existingPerson ? 12 : 26 }}>
        <div style={{ opacity: isTc ? 1 : 0.5 }}>
          <Label withLock={isYabanci}>T.C. Kimlik No</Label>
          <input type="text" maxLength={11} value={tcNo} onChange={(e) => setTcNo(e.target.value)} disabled={isYabanci} placeholder="11 haneli kimlik no"
            style={{ ...S.input, background: isTc ? "#f8fafc" : "#f1f5f9", cursor: isTc ? "text" : "not-allowed" }} />
        </div>
        <div style={{ opacity: isYabanci ? 1 : 0.5 }}>
          <Label withLock={isTc}>Pasaport No</Label>
          <input type="text" value={pasaportNo} onChange={(e) => setPasaportNo(e.target.value)} disabled={isTc} placeholder="Pasaport numarası"
            style={{ ...S.input, background: isYabanci ? "#f8fafc" : "#f1f5f9", cursor: isYabanci ? "text" : "not-allowed" }} />
        </div>
      </div>

      {existingPerson && (
        <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 16px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe", marginBottom: 26 }}>
          <span style={{ color: "#2563eb", marginTop: 1, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: IC.infoCircle }} />
          <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.5 }}>
            <strong>{existingPerson.name || "Bu kişi"} sistemde kayıtlı.</strong>{" "}
            {existingPerson.enrollments.length > 0 ? (
              <>Daha önce/hâlen: {existingPerson.enrollments.map((e, i) => (
                <span key={i}>{i > 0 ? ", " : ""}{e.educationName} ({e.statusLabel})</span>
              ))}. Yeni bir eğitim için satışa normal şekilde devam edebilirsiniz.</>
            ) : (
              <>Önceki kayıtlarında aktif bir eğitim görünmüyor. Satışa normal şekilde devam edebilirsiniz.</>
            )}
          </div>
        </div>
      )}

      {/* 18 yaş altı — öğrenci adı listeye gider; sözleşme veli adına (framer-motion açılır/kapanır) */}
      <AnimatePresence initial={false}>
        {isMinor && (
          <motion.div
            key="minor-card"
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 26 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={S.minorCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
                <span style={S.minorIcon} dangerouslySetInnerHTML={{ __html: IC.alert }} />
                <div style={{ fontSize: 14.5, fontWeight: 800, color: "#9a3412" }}>18 Yaş Altı — Veli Sözleşmesi</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
                <div>
                  <Label>Veli Adı Soyadı</Label>
                  <input type="text" value={veliAd} onChange={(e) => setVeliAd(e.target.value)} placeholder="Sözleşmeyi imzalayan veli" style={S.inputWarn} />
                </div>
                <div>
                  <Label>Veli T.C. Kimlik No</Label>
                  <input type="text" maxLength={11} value={veliTc} onChange={(e) => setVeliTc(e.target.value)} placeholder="11 haneli kimlik no" style={S.inputWarn} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SectionTitle>İletişim &amp; Durum</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 26 }}>
        <div>
          <Label>Telefon No</Label>
          <input type="tel" inputMode="tel" value={telefon} onChange={(e) => setTelefon(formatTrPhone(e.target.value))} placeholder="0 (5__) ___ __ __" style={S.input} />
        </div>
        <div>
          <Label>E-Posta Adresi</Label>
          <input type="email" value={eposta} onChange={(e) => setEposta(e.target.value)} placeholder="ornek@eposta.com" style={S.input} />
        </div>
        <div>
          <Label>Çalışma Durumu</Label>
          <SelectWrap>
            <select value={calismaDurumu} onChange={(e) => setCalismaDurumu(e.target.value)} style={S.select}>
              <option value="">Seçiniz</option>
              <option value="Öğrenci">Öğrenci</option>
              <option value="Çalışıyor">Çalışıyor</option>
              <option value="Çalışmıyor">Çalışmıyor</option>
              <option value="Serbest Meslek">Serbest Meslek</option>
            </select>
          </SelectWrap>
        </div>
      </div>

      <SectionTitle>Adres</SectionTitle>
      <div>
        <Label>Açık Adres</Label>
        <textarea value={adres} onChange={(e) => setAdres(e.target.value)} rows={3} placeholder="Mahalle, cadde, sokak, no, ilçe / il…" style={S.textarea} />
      </div>
    </>
  );
}
