"use client";

import { useState, useEffect, useRef } from "react";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { useUser } from "@/app/context/UserContext";
import { Check, Users, Paperclip, Upload, X, ExternalLink, Link2, Loader2 } from "lucide-react";

const LEVELS = ["Seviye 1", "Seviye 2", "Seviye 3"];

export interface AssignSelection {
  classId:        string; // group code (öğrenci sorguları için backward compat)
  groupId:        string; // group Firestore doc ID (benzersiz kimlik)
  groupBranch:    string; // gruba ait şube
  groupModule?:   "GRAFIK_1" | "GRAFIK_2"; // grubun modülü
  level:          string;
  endDate:        string;
  customSubtitle?:    string; // sadece bu göreve özel açıklama (şablonu değiştirmez)
  attachmentUrl?:     string;
  attachmentName?:    string;
  attachmentType?:    string;
}

interface Group {
  id: string;
  code: string;
  branch?: string;
  instructor?: string;
  instructorId?: string;
  status?: string;
  module?: "GRAFIK_1" | "GRAFIK_2";
  discipline?: string;
}

export function AssignActivateModal({
  taskName,
  templateId,
  templateLevel,
  templateScope,
  templateSubtitle,
  templateDiscipline,
  onConfirm,
  onCancel,
}: {
  taskName: string;
  templateId?: string;
  templateLevel?: string;
  templateScope?: string;
  templateSubtitle?: string;
  templateDiscipline?: string | null; // null = tüm branşlar, değer varsa filtrele
  onConfirm: (selections: AssignSelection[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [level,           setLevel]           = useState(templateLevel ?? "");
  const [endDate,         setEndDate]         = useState("");
  const [customSubtitle,  setCustomSubtitle]  = useState(templateSubtitle ?? "");
  const [loading,         setLoading]         = useState(false);
  const [visible,         setVisible]         = useState(false);
  const [groups,          setGroups]          = useState<Group[]>([]);
  const [groupsLoading,   setGroupsLoading]   = useState(true);
  const [busyGroupIds,    setBusyGroupIds]    = useState<string[]>([]);

  // Dosya eki
  const [attachment,   setAttachment]   = useState<{ url: string; name: string; type: string } | null>(null);
  const [attachMode,   setAttachMode]   = useState<"idle" | "drive">("idle");
  const [driveLink,    setDriveLink]    = useState("");
  const [driveName,    setDriveName]    = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState("");
  const [dragOver,     setDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useUser();

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Eğitmene ait aktif grupları ve mevcut aktif görevleri çek
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) { setGroupsLoading(false); return; }

    const q = query(collection(db, "groups"), where("instructorId", "==", uid));
    const unsub = onSnapshot(q, async snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      const active = all.filter(g => g.status === "active");
      // templateDiscipline varsa sadece eşleşen branş grubunu göster
      setGroups(
        templateDiscipline
          ? active.filter(g => g.discipline === templateDiscipline)
          : active
      );

      // Kişisel şablonlar serbest tekrar kullanım için busy kontrolü atlanır
      if (templateScope === "personal") {
        setBusyGroupIds([]);
      } else {
        // Bu şablon için grubu daha önce almış olanları bul — tek where + JS filtre (composite index sorununu önler)
        const taskSnap = templateId
          ? await getDocs(query(collection(db, "tasks"), where("templateId", "==", templateId)))
          : await getDocs(query(collection(db, "tasks"), where("ownedBy", "==", uid)));
        const busy = taskSnap.docs
          .filter(d => {
            const data = d.data();
            if (data.status !== "active" || data.isGraded === true) return false;
            if (templateId) return data.ownedBy === uid;
            return true;
          })
          .map(d => d.data().groupId as string)
          .filter(Boolean);
        setBusyGroupIds(busy);
      }

      setGroupsLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const instructorName = user ? `${user.name} ${user.surname ?? ""}`.trim() : "Eğitmen";
      fd.append("folderPath", JSON.stringify(["Ödev Şablonları", instructorName, taskName]));
      const uploadToken = await auth.currentUser?.getIdToken();
      const res  = await fetch("/api/upload", { method: "POST", body: fd, headers: { Authorization: `Bearer ${uploadToken ?? ""}` } });
      const data = await res.json() as { webViewLink?: string; fileName?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Yükleme başarısız");
      setAttachment({ url: data.webViewLink!, name: data.fileName ?? file.name, type: "upload" });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDriveSave = () => {
    const url = driveLink.trim();
    if (!url) return;
    setAttachment({ url, name: driveName.trim() || "Google Drive Dosyası", type: "drive" });
    setAttachMode("idle");
    setDriveLink("");
    setDriveName("");
  };

  const handleCancel = () => { setVisible(false); setTimeout(onCancel, 280); };

  const toggleGroup = (id: string) => {
    if (busyGroupIds.includes(id)) return;
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const today = new Date().toISOString().split("T")[0];
  const canSubmit = selectedGroupIds.length > 0 && !!level && !!endDate;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    const selections: AssignSelection[] = selectedGroupIds.map(id => {
      const g = groups.find(gr => gr.id === id)!;
      return {
        classId: g.code, groupId: g.id, groupBranch: g.branch ?? "", groupModule: g.module,
        level, endDate,
        customSubtitle:  customSubtitle.trim() || undefined,
        attachmentUrl:   attachment?.url   ?? undefined,
        attachmentName:  attachment?.name  ?? undefined,
        attachmentType:  attachment?.type  ?? undefined,
      };
    });
    try {
      await onConfirm(selections);
      setVisible(false);
    } catch (err) {
      console.error("Ödev başlatma hatası:", err);
      alert("Ödev başlatılamadı. Sayfayı yenileyip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-800 flex items-center justify-center p-6 transition-all duration-300 ${visible ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-base-primary-900/40 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleCancel}
      />
      <div className={`relative bg-white rounded-16 shadow-2xl w-full max-w-4xl p-8 flex flex-col gap-6 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {/* Başlık */}
        <div>
          <p className="text-[20px] font-bold text-base-primary-900 mb-1">Ödevi Aktife Al</p>
          <p className="text-[14px] text-surface-500">
            <span className="font-bold text-base-primary-700">"{taskName}"</span> için grup, seviye ve tarih belirleyin.
          </p>
        </div>

        {/* ── Ana satır: Sol = Grup | Sağ = Seviye + Tarih + Dosya ── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Sol: Grup Seçimi */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">Grup Seçimi</p>
              <div className="flex items-center gap-2">
                {templateDiscipline && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    {templateDiscipline} branşı
                  </span>
                )}
                {selectedGroupIds.length > 1 && (
                  <span className="text-[11px] text-base-primary-500 font-semibold">{selectedGroupIds.length} seçildi</span>
                )}
              </div>
            </div>
            {groupsLoading ? (
              <div className="flex items-center justify-center flex-1 min-h-[120px] bg-surface-50 rounded-12 border border-surface-100">
                <div className="w-5 h-5 border-2 border-surface-200 border-t-base-primary-500 rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 min-h-[120px] bg-surface-50 rounded-12 border border-surface-100 gap-2">
                <Users size={20} className="text-surface-300" />
                <p className="text-[12px] text-surface-400 font-medium text-center">Atanmış aktif grup yok</p>
              </div>
            ) : (
              <div className="overflow-y-auto rounded-12 border border-surface-200 divide-y divide-surface-100 flex-1">
                {groups.map(g => {
                  const isSelected = selectedGroupIds.includes(g.id);
                  const isBusy    = busyGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      disabled={isBusy}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isBusy ? "bg-surface-50 cursor-not-allowed opacity-50"
                        : isSelected ? "bg-base-primary-50 cursor-pointer"
                        : "bg-white hover:bg-surface-50 cursor-pointer"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "bg-base-primary-900 border-base-primary-900" : "border-surface-300"
                      }`}>
                        {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="w-20 text-[12px] font-medium text-surface-400 shrink-0 truncate">{g.branch ?? ""}</span>
                        <span className="text-surface-200 text-[10px] shrink-0">—</span>
                        <span className={`text-[13px] font-bold truncate ${
                          isSelected ? "text-base-primary-900" : isBusy ? "text-surface-400" : "text-surface-700"
                        }`}>{g.code}</span>
                        {isBusy && <span className="text-[11px] text-surface-400 font-medium ml-auto shrink-0">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sağ: Seviye + Tarih + Dosya Eki */}
          <div className="flex flex-col gap-4">
            {/* Seviye */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">Seviye</p>
                {templateLevel && (
                  <span className="text-[10px] font-semibold text-base-primary-500 bg-base-primary-50 px-2 py-0.5 rounded-full">Şablonda belirlendi</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map(l => (
                  <button
                    key={l}
                    onClick={() => !templateLevel && setLevel(l)}
                    disabled={!!templateLevel}
                    className={`py-3 rounded-xl text-[13px] font-bold border transition-all ${
                      level === l
                        ? templateLevel ? "bg-base-primary-700 text-white border-base-primary-700"
                          : "bg-base-primary-900 text-white border-base-primary-900"
                        : templateLevel ? "bg-surface-100 border-surface-200 text-surface-400"
                          : "bg-white border-surface-200 text-surface-600 cursor-pointer hover:border-base-primary-400 hover:text-base-primary-700"
                    } ${templateLevel ? "cursor-not-allowed" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Bitiş Tarihi */}
            <div>
              <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Bitiş Tarihi</p>
              <input
                type="date"
                value={endDate}
                min={today}
                onChange={e => setEndDate(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-surface-200 bg-surface-50 text-[14px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all cursor-pointer"
              />
            </div>

            {/* Dosya Eki */}
            <div>
              <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide mb-2">Dosya Eki</p>

              {attachment && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl">
                  <Paperclip size={13} className="text-base-primary-400 shrink-0" />
                  <span className="text-[12px] font-semibold text-base-primary-900 flex-1 truncate">{attachment.name}</span>
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer"
                    className="text-surface-400 hover:text-base-primary-600 transition-colors p-1 cursor-pointer">
                    <ExternalLink size={13} />
                  </a>
                  <button onClick={() => setAttachment(null)}
                    className="text-surface-300 hover:text-status-danger-500 transition-colors cursor-pointer p-1">
                    <X size={12} />
                  </button>
                </div>
              )}

              {!attachment && uploading && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-400">
                  <Loader2 size={13} className="animate-spin" />
                  <span className="text-[12px] font-medium">Yükleniyor...</span>
                </div>
              )}

              {!attachment && !uploading && attachMode === "drive" && (
                <div className="flex flex-col gap-2 bg-surface-50 border border-surface-200 rounded-xl p-3">
                  <input value={driveName} onChange={e => setDriveName(e.target.value)}
                    placeholder="Dosya adı (isteğe bağlı)"
                    className="w-full h-8 px-3 rounded-lg border border-surface-200 bg-white text-[12px] outline-none focus:border-base-primary-400 transition-colors" />
                  <div className="flex gap-2">
                    <input value={driveLink} onChange={e => setDriveLink(e.target.value)}
                      placeholder="Google Drive linki..."
                      className="flex-1 h-8 px-3 rounded-lg border border-surface-200 bg-white text-[12px] outline-none focus:border-base-primary-400 transition-colors" />
                    <button onClick={handleDriveSave} disabled={!driveLink.trim()}
                      className="px-3 h-8 bg-base-primary-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-40 cursor-pointer hover:bg-base-primary-800 transition-colors shrink-0">
                      Ekle
                    </button>
                    <button onClick={() => setAttachMode("idle")}
                      className="px-2 h-8 bg-surface-100 text-surface-600 rounded-lg cursor-pointer hover:bg-surface-200 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {!attachment && !uploading && attachMode === "idle" && (
                <div className="flex flex-col gap-2">
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 border-2 border-dashed rounded-xl text-[12px] font-semibold transition-colors cursor-pointer w-full ${
                      dragOver
                        ? "border-base-primary-400 bg-base-primary-50 text-base-primary-600"
                        : "border-surface-300 bg-surface-50 text-surface-500 hover:border-base-primary-300 hover:text-base-primary-600"
                    }`}
                  >
                    <Upload size={13} />
                    <span>{dragOver ? "Bırak, yüklensin" : "Bilgisayardan Yükle & Sürükle Bırak"}</span>
                  </div>
                  <button onClick={() => setAttachMode("drive")}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-surface-50 border border-dashed border-surface-300 rounded-xl text-[12px] font-semibold text-surface-500 hover:border-base-primary-300 hover:text-base-primary-600 transition-colors cursor-pointer w-full justify-center">
                    <Link2 size={13} /> Drive Linki Ekle
                  </button>
                </div>
              )}
              {uploadError && <p className="text-[11px] text-status-danger-500 mt-1">{uploadError}</p>}
            </div>
          </div>
        </div>

        {/* ── Açıklama: tam genişlik ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">Ödev Açıklaması</p>
            <span className="text-[10px] text-surface-300 font-medium">Bu ödeve özel · Şablonu değiştirmez</span>
          </div>
          <textarea
            value={customSubtitle}
            onChange={e => setCustomSubtitle(e.target.value)}
            rows={7}
            placeholder="Açıklama yok"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-surface-50 text-[13px] text-text-primary font-medium outline-none focus:border-base-primary-500 focus:bg-white transition-all resize-none"
          />
        </div>

        {/* Butonlar */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 h-12 rounded-xl border border-surface-200 text-[14px] font-bold text-surface-600 hover:bg-surface-50 transition-all cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || loading}
            className="flex-1 h-12 rounded-xl bg-base-primary-900 text-white text-[14px] font-bold hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              `Aktife Al${selectedGroupIds.length > 1 ? ` (${selectedGroupIds.length} grup)` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
