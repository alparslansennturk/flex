"use client";

/**
 * "Yeni Konuşma" modalı — tasarımla (`Flex Connect.dc.html`) birebir: Kanal/Grup/
 * Topluluk (DM YOK — 2026-07-18 kullanıcı düzeltmesi: DM'in ayrı bir "oluştur"
 * akışı yok, Personel/Öğrenciler dizininden başlatılıyor, bkz. `openDirectMessage`).
 * 780px genişlik, 2 kolonlu gövde (sol: ad/açıklama, sağ: türe özel panel).
 *
 * Realm artık AYRI bir adım DEĞİL — türe göre TÜRETİLİYOR: Kanal "Personel Kanalı" |
 * "Öğrenci Kanalı" seçimiyle başlar (2026-07-18 kullanıcı isteği). Personel Kanalı'nda
 * TÜM aktif personel otomatik okuyucu olur (`broadcastToAllStaff`, server hesaplar),
 * Yayıncı seçilenler YAZABİLİR olur (admins'e girer). Öğrenci Kanalı'nda TÜM öğrenciler
 * otomatik okur (`audience:"all_students"`, mevcut mekanizma), Yayıncı seçilenler yazar.
 * Grup varsayılan `trainer_student`+gerçek sınıf/roster ("Sınıf" modu,
 * kullanıcı isteği: sınıf seçilince roster ANINDA altına eklenir), "Personel" moduna
 * geçilirse `staff`+personel çipleri (var olan iş grubu kapasitesi, kaybolmasın diye
 * korundu). Topluluk gerçek sınıflardan ≥2 seçip otomatik "Genel Duyuru" kanalı +
 * sınıf odaları (`sourceGroupId` ile dedup) oluşturur.
 *
 * 2026-08-03: `connect/page.tsx`'ten (2597 satır mega-component) çıkarıldı — dosyanın
 * geri kalanından tamamen bağımsız, kendi kendine yeten bir modal (FLEXOS_TEKNIK_BORC.md
 * madde 1: "connect/page.tsx'i composer/mesaj listesi/modal'lara böl").
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Megaphone, UsersRound, X, Check, Loader2 } from "lucide-react";
import { type DirectoryUser, type ConnectConversationType, fetchDirectory, createConversation } from "./connectClient";
import { authHeaders } from "@/app/lib/client/auth-headers";
import { initials } from "./format";
import { type IconComponent, UsersThreeIcon } from "./ConnectIcon";
import type { GroupItem, RosterItem } from "./groupTypes";

export type CreateType = "channel" | "group" | "community";

export function CreateConversationModal({
  open, onClose, onCreated, initialType,
}: { open: boolean; onClose: () => void; onCreated: (id: string, type: ConnectConversationType) => void; initialType?: CreateType }) {
  const [type, setType] = useState<CreateType>("channel");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Kanal — "Personel Kanalı" (tüm personel otomatik okur) veya "Öğrenci Kanalı"
  // (tüm öğrenciler otomatik okur, audience:"all_students"). İkisinde de Yayıncılar
  // seçilenler yazabilir (admins).
  const [channelAudience, setChannelAudience] = useState<"staff" | "students">("staff");
  const [staffDirectory, setStaffDirectory] = useState<DirectoryUser[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [selectedStaffUids, setSelectedStaffUids] = useState<string[]>([]);

  // Grup — "Sınıf" (gerçek sınıf odası) veya "Personel" (staff iş grubu)
  const [groupMode, setGroupMode] = useState<"class" | "staff">("class");
  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Topluluk
  const [selectedCommunityGroupIds, setSelectedCommunityGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setType(initialType ?? "channel"); setName(""); setDescription(""); setChannelAudience("staff");
    setSelectedStaffUids([]); setGroupMode("class"); setSelectedGroupId(""); setRoster([]);
    setSelectedCommunityGroupIds([]);
    setDirectoryLoading(true);
    fetchDirectory().then((d) => { setStaffDirectory(d); setDirectoryLoading(false); });
    (async () => {
      const headers = await authHeaders();
      const res = await fetch("/api/flexos/groups", { headers });
      if (res.ok) setMyGroups((await res.json() as { items: GroupItem[] }).items);
    })();
  }, [open, initialType]);

  // Sınıf seçilince roster ANINDA altına eklenir (kullanıcı isteği, 2026-07-18).
  useEffect(() => {
    if (type !== "group" || groupMode !== "class" || !selectedGroupId) { setRoster([]); return; }
    setRosterLoading(true);
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(`/api/flexos/groups/${selectedGroupId}/roster`, { headers });
      if (res.ok) setRoster((await res.json() as { items: RosterItem[] }).items.filter((r) => r.authUid));
      setRosterLoading(false);
    })();
  }, [type, groupMode, selectedGroupId]);

  if (!open) return null;

  const communityReach = myGroups
    .filter((g) => selectedCommunityGroupIds.includes(g.id))
    .reduce((sum, g) => sum + (g.enrolled ?? 0), 0);

  const canSubmit =
    name.trim().length > 0 &&
    (type === "channel"
      ? true // oluşturan zaten yazabilir (owner/admin), Yayıncı seçimi zorunlu değil
      : type === "group"
        ? groupMode === "class"
          ? !!selectedGroupId
          : selectedStaffUids.length > 0
        : selectedCommunityGroupIds.length >= 2);

  async function fetchRosterFor(groupId: string): Promise<RosterItem[]> {
    const headers = await authHeaders();
    const res = await fetch(`/api/flexos/groups/${groupId}/roster`, { headers });
    if (!res.ok) return [];
    return (await res.json() as { items: RosterItem[] }).items.filter((r) => r.authUid);
  }

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (type === "channel") {
        const result = await createConversation({
          realm: channelAudience === "students" ? "trainer_student" : "staff",
          type: "channel", name: name.trim(), description: description.trim() || undefined,
          memberUids: selectedStaffUids,
          audience: channelAudience === "students" ? "all_students" : undefined,
          broadcastToAllStaff: channelAudience === "staff",
        });
        if ("error" in result) { toast.error(result.error); return; }
        toast.success("Kanal oluşturuldu.");
        onCreated(result.id, "channel");
        return;
      }

      if (type === "group") {
        if (groupMode === "class") {
          const result = await createConversation({
            realm: "trainer_student", type: "group", name: name.trim(), description: description.trim() || undefined,
            memberUids: roster.map((r) => r.authUid!).filter(Boolean),
            sourceGroupId: selectedGroupId,
          });
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Grup oluşturuldu.");
          onCreated(result.id, "group");
        } else {
          const result = await createConversation({
            realm: "staff", type: "group", name: name.trim(), description: description.trim() || undefined,
            memberUids: selectedStaffUids,
          });
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Grup oluşturuldu.");
          onCreated(result.id, "group");
        }
        return;
      }

      // Topluluk: her seçili sınıf için sınıf odası oluştur/yeniden-kullan (server
      // `sourceGroupId` ile dedup ediyor) → union roster'la otomatik "Genel Duyuru"
      // kanalı → son olarak topluluk kaydının kendisi (childIds = sınıf odaları).
      const rosters = await Promise.all(selectedCommunityGroupIds.map(async (groupId) => ({ groupId, items: await fetchRosterFor(groupId) })));
      const groupConvIds: string[] = [];
      const allAuthUids = new Set<string>();
      for (const { groupId, items } of rosters) {
        const g = myGroups.find((mg) => mg.id === groupId);
        const conv = await createConversation({
          realm: "trainer_student", type: "group",
          name: g ? `${g.code} — Sınıf Odası` : "Sınıf Odası",
          memberUids: items.map((r) => r.authUid!).filter(Boolean),
          sourceGroupId: groupId,
        });
        if ("error" in conv) { toast.error(conv.error); return; }
        groupConvIds.push(conv.id);
        items.forEach((r) => r.authUid && allAuthUids.add(r.authUid));
      }
      const channelResult = await createConversation({
        realm: "trainer_student", type: "channel", name: `${name.trim()} — Genel Duyuru`,
        // memberUids BOŞ: kanalda Yayıncı YOK, SADECE eğitmen (owner) yazar.
        // Bundled sınıfların öğrencileri readerUids ile salt-okunur eklenir —
        // "ben yazarım, öğrenci yazamaz" (kullanıcı isteği, 2026-07-18).
        memberUids: [], readerUids: [...allAuthUids],
      });
      if ("error" in channelResult) { toast.error(channelResult.error); return; }
      const communityResult = await createConversation({
        realm: "trainer_student", type: "community", name: name.trim(), description: description.trim() || undefined,
        memberUids: [], childIds: groupConvIds,
        // Bağlantı (2026-07-18) — sonradan topluluğa yeni grup eklenince o grubun
        // rosteru OTOMATİK bu kanala okuyucu olarak eklenebilsin diye.
        announcementChannelId: channelResult.id,
      });
      if ("error" in communityResult) { toast.error(communityResult.error); return; }
      toast.success("Topluluk oluşturuldu.");
      // Topluluğun kendisi henüz rayda gösterilecek bir sekme yok (Faz 1-sonu) —
      // gerçek iletişim "Genel Duyuru" kanalında olduğu için ORAYA açılır.
      onCreated(channelResult.id, "channel");
    } finally {
      setSaving(false);
    }
  }

  const createTitle = type === "community" ? "Yeni Topluluk Oluştur" : type === "group" ? "Yeni Grup Oluştur" : "Yeni Kanal Oluştur";
  const createSubtitle =
    type === "community" ? "Birden çok sınıfını tek çatı altında topla ve hepsine birden duyuru yap."
      : type === "group" ? "Üyelerin karşılıklı yazışabileceği bir grup kurun."
        : "Duyurularınızı tek yerden paylaşacağınız bir kanal kurun.";
  const nameLabel = type === "community" ? "Topluluk Adı" : type === "group" ? "Grup Adı" : "Kanal Adı";
  const namePlaceholder = type === "community" ? "ör. Grafik Tasarım Öğrencileri" : type === "group" ? "ör. Grafik Tasarım A Grubu" : "ör. Kurum Duyuruları";
  const visibilityNote =
    type === "community" ? `Genel Duyuru · ${communityReach} üyeye ulaşır`
      : type === "group" ? (groupMode === "class" ? "Özel — yalnızca sınıf öğrencileri" : "Özel — yalnızca eklenen üyeler")
        : channelAudience === "students" ? "Herkese açık — tüm öğrenciler otomatik okur" : "Herkese açık — tüm personel otomatik okur";
  const createCta = type === "community" ? "Topluluğu Oluştur" : type === "group" ? "Grubu Oluştur" : "Kanalı Oluştur";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        style={{ background: "rgba(18,35,59,.42)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white flex flex-col"
          style={{ width: "100%", maxWidth: 780, maxHeight: "calc(100vh - 48px)", overflowY: "auto", borderRadius: 20, boxShadow: "0 30px 80px -20px rgba(18,35,59,.5)" }}
          initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3.5" style={{ padding: "22px 26px 18px", borderBottom: "1px solid #EEF0F3" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#1B1F26" }}>{createTitle}</h3>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#8A909B", fontWeight: 500 }}>{createSubtitle}</p>
            </div>
            <button onClick={onClose} className="flex items-center justify-center cursor-pointer" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid #E4E6EB", color: "#6B717C" }}><X size={18} /></button>
          </div>

          <div style={{ padding: "20px 26px 8px" }}>
            <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Tür</label>
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {[
                { key: "channel" as const, label: "Kanal", desc: "Tek yönlü duyuru", Icon: Megaphone as IconComponent },
                { key: "group" as const, label: "Grup", desc: "Karşılıklı sohbet", Icon: UsersRound as IconComponent },
                { key: "community" as const, label: "Topluluk", desc: "Grupları birleştir", Icon: UsersThreeIcon },
              ].map((t) => {
                const sel = type === t.key;
                return (
                  <button key={t.key} onClick={() => setType(t.key)} className="flex items-center gap-3 cursor-pointer transition-all text-left" style={{ padding: "14px 15px", borderRadius: 13, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}>
                    <div className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 11, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}><t.Icon size={19} /></div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1B1F26" }}>{t.label}</div>
                      <div style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500, marginTop: 1 }}>{t.desc}</div>
                    </div>
                    <span className="relative rounded-full flex items-center justify-center shrink-0" style={{ width: 19, height: 19, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                      {sel && <Check size={10} strokeWidth={3.6} color="#fff" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-6 items-start">
              <div>
                <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 8 }}>{nameLabel}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder} className="w-full outline-none" style={{ height: 44, padding: "0 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 14, fontWeight: 600, marginBottom: 18 }} />
                <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 8 }}>Açıklama <span style={{ fontWeight: 600, color: "#C3CAD4", textTransform: "none", letterSpacing: 0 }}>· opsiyonel</span></label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={`Bu ${type === "group" ? "grubun" : type === "community" ? "topluluğun" : "kanalın"} amacını kısaca yazın…`} className="w-full outline-none resize-none" style={{ padding: "11px 14px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#FBFCFD", fontSize: 13.5 }} />
              </div>

              <div>
                {type === "channel" && (
                  <>
                    <div className="flex gap-1.5 mb-2">
                      {([{ key: "staff", label: "Personel Kanalı" }, { key: "students", label: "Öğrenci Kanalı" }] as { key: "staff" | "students"; label: string }[]).map((m) => (
                        <button
                          key={m.key} onClick={() => setChannelAudience(m.key)}
                          className="cursor-pointer transition-all font-bold"
                          style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid transparent", fontSize: 12.5, background: channelAudience === m.key ? "#EAF1FB" : "transparent", color: channelAudience === m.key ? "#205297" : "#8A909B" }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: "0 0 12px", fontSize: 12, color: "#A2A8B2", fontWeight: 500 }}>
                      {channelAudience === "staff"
                        ? "Tüm personel üye olmadan otomatik okur; aşağıda seçtiğin Yayıncılar yazabilir."
                        : "Tüm öğrenciler üye olmadan otomatik okur; aşağıda seçtiğin Yayıncılar (personel) yazabilir."}
                    </p>
                    <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Yayıncılar <span style={{ color: "#2867bd", textTransform: "none" }}>· {selectedStaffUids.length} seçili</span></label>
                    {/* minHeight === maxHeight: dizin yüklenirken (boş) → yüklendikten
                        sonra arası modal aniden büyümesin (2026-07-18 kullanıcı bulgusu:
                        "kanal seçince önce yayıncı olmadan geliyor, 1sn sonra yükseliyor"). */}
                    <div className="flex flex-col gap-1.5" style={{ minHeight: 200, maxHeight: 200, overflowY: "auto" }}>
                      {directoryLoading ? (
                        <div className="w-full flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                      ) : (
                        <>
                          {staffDirectory.map((u) => {
                            const sel = selectedStaffUids.includes(u.uid);
                            return (
                              <button
                                key={u.uid}
                                onClick={() => setSelectedStaffUids((prev) => (sel ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]))}
                                className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                                style={{ padding: "8px 11px", borderRadius: 11, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                              >
                                <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 30, height: 30, borderRadius: 9, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C", fontSize: 11.5 }}>
                                  {initials(u.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{u.name}</div>
                                  {u.title && <div className="truncate" style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{u.title}</div>}
                                </div>
                                <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                                  {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                                </span>
                              </button>
                            );
                          })}
                          {staffDirectory.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Personel bulunamadı.</p>}
                        </>
                      )}
                    </div>
                  </>
                )}

                {type === "group" && (
                  <>
                    <div className="flex gap-1.5 mb-3">
                      {([{ key: "class", label: "Sınıf" }, { key: "staff", label: "Personel" }] as { key: "class" | "staff"; label: string }[]).map((m) => (
                        <button
                          key={m.key} onClick={() => setGroupMode(m.key)}
                          className="cursor-pointer transition-all font-bold"
                          style={{ padding: "6px 13px", borderRadius: 9, border: "1px solid transparent", fontSize: 12.5, background: groupMode === m.key ? "#EAF1FB" : "transparent", color: groupMode === m.key ? "#205297" : "#8A909B" }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {groupMode === "class" ? (
                      <>
                        <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Sınıflarım</label>
                        <div className="flex flex-col gap-2" style={{ maxHeight: 190, overflowY: "auto" }}>
                          {myGroups.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
                          {myGroups.map((g) => {
                            const sel = selectedGroupId === g.id;
                            return (
                              <button
                                key={g.id}
                                onClick={() => { setSelectedGroupId(g.id); if (!name.trim()) setName(g.code); }}
                                className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                                style={{ padding: "9px 11px", borderRadius: 12, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                              >
                                <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F5", color: "#5A616C" }}><UsersRound size={17} /></div>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{g.code} — {g.branch}</div>
                                  <div style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{g.enrolled ?? 0} öğrenci</div>
                                </div>
                                <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                                  {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {selectedGroupId && (
                          <div className="mt-3">
                            <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Eklenecek Üyeler <span style={{ color: "#2867bd", textTransform: "none" }}>· {roster.length}</span></label>
                            <div className="flex flex-wrap gap-2" style={{ minHeight: 60, maxHeight: 120, overflowY: "auto" }}>
                              {rosterLoading ? (
                                <div className="w-full flex items-center justify-center"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                              ) : roster.length === 0 ? (
                                <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Bu sınıfta öğrenci girişi olan kimse yok.</p>
                              ) : (
                                roster.map((r) => (
                                  <span key={r.personId} className="inline-flex items-center" style={{ padding: "6px 12px", borderRadius: 999, border: "1.5px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 12.5, fontWeight: 700 }}>
                                    {r.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="block font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 9 }}>Üyeler <span style={{ color: "#2867bd", textTransform: "none" }}>· {selectedStaffUids.length} seçili</span></label>
                        {/* Liste menü + checkbox (2026-07-18 kullanıcı isteği: çip
                            grid yerine, Sınıflarım/Topluluk satırlarıyla AYNI desen —
                            tek tek işaretleyip sonra "Oluştur"a basılıyor). */}
                        <div className="flex flex-col gap-1.5" style={{ minHeight: 200, maxHeight: 200, overflowY: "auto" }}>
                          {directoryLoading ? (
                            <div className="w-full flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-surface-400" /></div>
                          ) : (
                            <>
                              {staffDirectory.map((u) => {
                                const sel = selectedStaffUids.includes(u.uid);
                                return (
                                  <button
                                    key={u.uid}
                                    onClick={() => setSelectedStaffUids((prev) => (sel ? prev.filter((x) => x !== u.uid) : [...prev, u.uid]))}
                                    className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                                    style={{ padding: "8px 11px", borderRadius: 11, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                                  >
                                    <div className="flex items-center justify-center shrink-0 font-bold text-white" style={{ width: 30, height: 30, borderRadius: 9, background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C", fontSize: 11.5 }}>
                                      {initials(u.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{u.name}</div>
                                      {u.title && <div className="truncate" style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{u.title}</div>}
                                    </div>
                                    <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                                      {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                                    </span>
                                  </button>
                                );
                              })}
                              {staffDirectory.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Personel bulunamadı.</p>}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {type === "community" && (
                  <>
                    <label className="flex items-center gap-1.5 font-bold uppercase" style={{ fontSize: 11.5, color: "#8A909B", letterSpacing: ".05em", marginBottom: 4 }}>
                      Sınıfları Birleştir <span style={{ color: "#2867bd", textTransform: "none" }}>· {selectedCommunityGroupIds.length} sınıf</span>
                    </label>
                    <p style={{ margin: "0 0 11px", fontSize: 12, color: "#A2A8B2", fontWeight: 500 }}>Seçtiğin sınıflar tek toplulukta toplanır. Genel Duyuru&apos;ya yazdığın mesaj hepsine aynı anda gider.</p>
                    <div className="flex flex-col gap-2" style={{ maxHeight: 190, overflowY: "auto" }}>
                      {myGroups.length === 0 && <p style={{ fontSize: 12.5, color: "#A2A8B2" }}>Kendi adınıza kayıtlı sınıf bulunamadı.</p>}
                      {myGroups.map((g) => {
                        const sel = selectedCommunityGroupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            onClick={() => setSelectedCommunityGroupIds((prev) => (sel ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                            className="flex items-center gap-2.5 cursor-pointer transition-all text-left"
                            style={{ padding: "9px 11px", borderRadius: 12, border: `1.5px solid ${sel ? "#2867bd" : "#E4E6EB"}`, background: sel ? "#F4F8FE" : "#fff" }}
                          >
                            <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F5", color: "#5A616C" }}><UsersRound size={17} /></div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B1F26" }}>{g.code} — {g.branch}</div>
                              <div style={{ fontSize: 11.5, color: "#8A909B", fontWeight: 500 }}>{g.enrolled ?? 0} öğrenci</div>
                            </div>
                            <span className="relative rounded-md flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                              {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2.5 mt-3.5" style={{ padding: "11px 13px", borderRadius: 11, background: "#F4F8FE", border: "1px solid #DCE9FB" }}>
                      <Megaphone size={16} color="#2867bd" className="shrink-0" />
                      <span style={{ fontSize: 12, color: "#3B5876", fontWeight: 600, lineHeight: 1.4 }}>
                        Otomatik <strong>Genel Duyuru</strong> kanalı oluşturulur — <strong>{communityReach} üyeye</strong> tek seferde ulaşırsın.
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3" style={{ padding: "18px 26px 22px", marginTop: 8 }}>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: "#8A909B", fontWeight: 500 }}>
              {visibilityNote}
            </div>
            <div className="flex gap-2.5">
              <button onClick={onClose} className="cursor-pointer" style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid #E4E6EB", background: "#fff", color: "#4A515C", fontSize: 14, fontWeight: 600 }}>Vazgeç</button>
              <button
                onClick={submit} disabled={!canSubmit || saving}
                className="inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                style={{ padding: "11px 20px", borderRadius: 11, border: "none", background: canSubmit ? "#2867bd" : "#C3CAD4", color: "#fff", fontSize: 14, fontWeight: 700 }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {createCta}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
