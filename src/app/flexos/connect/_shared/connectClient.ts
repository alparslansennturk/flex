/**
 * Flex Connect — paylaşımlı client fonksiyonları. Personel (`/flexos/connect`) ve
 * öğrenci (`/flexos/student/connect`) sayfaları AYNI fonksiyonları kullanır —
 * `personId` verilirse öğrenci route ailesine (`/api/flexos/student/connect/*`),
 * verilmezse personel route ailesine (`/api/flexos/connect/*`) gider (bkz.
 * `connect-principal.ts`: iki ayrı kimlik çözümleme mekanizması).
 */
import { collection, documentId, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";

export type ConnectRealm = "staff" | "trainer_student";
export type ConnectConversationType = "channel" | "group" | "community" | "dm";
export type ConnectWritePolicy = "admins" | "members";

export interface ConversationView {
  id: string;
  realm: ConnectRealm;
  type: ConnectConversationType;
  name: string;
  description?: string;
  colorKey?: string;
  writePolicy: ConnectWritePolicy;
  audience?: string;
  lastMessage: { text: string; senderUid: string; senderName: string; at: string } | null;
  unread: boolean;
  unreadCount: number;
  isMember: boolean;
  isAdmin: boolean;
  /** Konuşmanın SAHİBİ mi — silme gibi en-yüksek-yetki işlemler SADECE owner'a görünür. */
  isOwner: boolean;
  pinned: boolean;
  /** Kişisel sessize alma tercihi (2026-07-19) — sessize alınmış konuşmalarda push gitmez. */
  muted: boolean;
  /** Kişisel arşiv tercihi (2026-07-22) — yeni mesaj gelince otomatik false'a döner. */
  archived: boolean;
  /** SADECE type==="dm" — karşı tarafın uid'i (Personel/Öğrenciler/Eğitmenlerim
   * dizininden birine tıklayınca var olan DM'i bulmak için). */
  peerUid?: string;
  /** Düzenleme modalının ANINDA açılabilmesi için (2026-07-18) — liste zaten
   * bu veriyi taşıyor, ayrı bir fetch gerekmez. */
  admins: string[];
  ownerUid: string;
  childIds?: string[];
  announcementChannelId?: string;
  /** Konuşma listesinin en üstünde "Sohbet [tarih] başladı" kartı için (2026-07-20). */
  createdAt: string;
}

/** Yanıtlama alıntısı (2026-07-20) — statik anlık görüntü, canlı referans DEĞİL. */
export interface ConnectReplySnapshot {
  messageId: string;
  authorUid: string;
  authorName: string;
  textSnippet: string;
}

export interface MessageView {
  id: string;
  authorUid: string;
  authorName: string;
  colorKey: string;
  isMine: boolean;
  text: string;
  createdAt: string;
  editedAt?: string;
  deletedForEveryone?: boolean;
  reactionCounts?: Record<string, number>;
  myReaction?: string;
  /** SADECE isMine — DİĞER tüm üyeler okumuşsa true (WhatsApp çift mavi tik). */
  readByAll?: boolean;
  /** SADECE isMine — DİĞER tüm üyelerin istemcisine ulaştıysa true (WhatsApp çift GRİ tik, 2026-07-22). */
  deliveredByAll?: boolean;
  /** Faz 2 madde 5 (2026-07-18) — dosya eki(leri). */
  attachments?: ConnectAttachment[];
  /** Kurumsal kural (2026-07-20) — öğrenci→eğitmen DM'de 22:00-09:00 arası gönderildi. */
  afterHours?: boolean;
  /** SADECE "system" mesajlarını ayırt eder (2026-07-20) — yoksa "text" varsayılır. */
  kind?: "text" | "system";
  /** SADECE kind==="system" — "{count} kişi gruba eklendi" render'ı için. */
  systemEvent?: { type: "members_added"; count: number };
  /** Yanıtlama alıntısı (2026-07-20). */
  replyTo?: ConnectReplySnapshot;
  /** Çağıran bu mesajı yıldızlamış mı. */
  starred?: boolean;
}

export interface ConnectAttachment {
  /** ESKİ (Drive tabanlı) ekler için — 2026-07-21 sonrası yeni ekler `storagePath` kullanır. */
  driveFileId?: string;
  storagePath?: string;
  webViewLink: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface DirectoryUser {
  uid: string;
  name: string;
  title?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = auth.currentUser;
  const token = u ? await u.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

function base(personId?: string): string {
  return personId ? "/api/flexos/student/connect" : "/api/flexos/connect";
}
function qs(personId?: string): string {
  return personId ? `?personId=${personId}` : "";
}

export async function fetchConversations(personId?: string): Promise<ConversationView[]> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations${qs(personId)}`, { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: ConversationView[] };
  return data.items;
}

export async function fetchMessages(conversationId: string, personId?: string): Promise<MessageView[]> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages${qs(personId)}`, { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: MessageView[] };
  return data.items;
}

export async function postMessage(
  conversationId: string,
  text: string,
  personId?: string,
  /** Yanıtlama (2026-07-20) — "Yanıtla"/"Özelden Yanıtla" ile seçilen kaynak mesajın anlık görüntüsü. */
  replyTo?: ConnectReplySnapshot,
): Promise<{ error?: string } | null> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ text, replyTo }),
  });
  if (!res.ok) return (await res.json().catch(() => ({}))) as { error?: string };
  return null;
}

/** Dosya eki + opsiyonel metin gönder (Faz 2 madde 5 — 2026-07-18, WhatsApp gibi
 * metin BOŞ olabilir). `XMLHttpRequest` KASITLI kullanılıyor (fetch upload progress
 * vermiyor) — `onProgress` gerçek yüzdeyi (`upload.onprogress`) raporlar. `Content-Type`
 * BİLEREK set edilmiyor, tarayıcı `FormData` sınırını (boundary) kendisi ekler. */
export async function sendMessageWithAttachment(
  conversationId: string,
  file: File,
  text: string,
  personId?: string,
  onProgress?: (pct: number) => void,
): Promise<{ error?: string } | null> {
  const headers = await authHeaders();
  const form = new FormData();
  form.append("file", file);
  form.append("text", text);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base(personId)}/conversations/${conversationId}/messages/attachment${qs(personId)}`);
    if (headers.Authorization) xhr.setRequestHeader("Authorization", headers.Authorization);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve(null); return; }
      let error = "Yüklenemedi.";
      try { error = (JSON.parse(xhr.responseText) as { error?: string }).error ?? error; } catch { /* boş yanıt olabilir */ }
      resolve({ error });
    };
    xhr.onerror = () => resolve({ error: "Ağ hatası." });
    xhr.send(form);
  });
}

/** Mesaj düzenle — SADECE yazar (WhatsApp, 2026-07-18). */
export async function editMessage(conversationId: string, messageId: string, text: string, personId?: string): Promise<{ error?: string } | null> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages/${messageId}${qs(personId)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return (await res.json().catch(() => ({}))) as { error?: string };
  return null;
}

/** `scope:"everyone"` — SADECE yazar, herkeste "Bu mesaj silindi" olur. `scope:"me"` —
 * herkes kullanabilir, SADECE kendi görünümünden kaybolur. */
export async function deleteMessage(conversationId: string, messageId: string, scope: "everyone" | "me", personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages/${messageId}?scope=${scope}${personId ? `&personId=${personId}` : ""}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

/** Reaksiyon ver/değiştir (`emoji`) / kaldır (`emoji:null`) — WhatsApp tarzı, kişi
 * başına tek emoji (Faz 2 madde 2, 2026-07-18). */
export async function setMessageReaction(conversationId: string, messageId: string, emoji: string | null, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages/${messageId}/reactions${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ emoji }),
  });
  return res.ok;
}

/** Yıldızla/kaldır (2026-07-20) — reaksiyonla AYNI ilke, okuma yetkisi yeter. */
export async function toggleMessageStar(conversationId: string, messageId: string, starred: boolean, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages/${messageId}/star${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ starred }),
  });
  return res.ok;
}

export interface StarredMessageView {
  conversationId: string;
  conversationName: string;
  conversationType: ConnectConversationType;
  messageId: string;
  authorName: string;
  text: string;
  createdAt: string;
  attachments?: ConnectAttachment[];
}

/** "Yıldızlı Mesajlarım" (2026-07-20) — tüm konuşmalar arası tek liste. */
export async function fetchStarredMessages(personId?: string): Promise<StarredMessageView[]> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/starred${qs(personId)}`, { headers });
  if (!res.ok) {
    // Sessizce boş döndürmüyoruz artık — teşhis kolaylığı için (2026-07-20 kullanıcı
    // bulgusu: yıldızladıktan sonra liste boştu, gerçek sunucu hatası konsolda hiç görünmüyordu).
    const body = await res.json().catch(() => ({}));
    console.error("[connect] fetchStarredMessages hata:", res.status, (body as { error?: string }).error);
    return [];
  }
  const data = (await res.json()) as { items: StarredMessageView[] };
  return data.items;
}

export async function markConversationRead(conversationId: string, personId?: string): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${base(personId)}/conversations/${conversationId}/read${qs(personId)}`, { method: "POST", headers });
}

/** Sabitle/sabitlemeyi kaldır — kişisel tercih, yetki gerektirmez (Faz 2, Favoriler). */
export async function setConversationPinned(conversationId: string, pinned: boolean, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/pin${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ pinned }),
  });
  return res.ok;
}

/** Sessize al/kaldır — kişisel tercih, yetki gerektirmez (2026-07-19, push bildirimi bu bayrağı okur). */
export async function setConversationMuted(conversationId: string, muted: boolean, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/mute${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ muted }),
  });
  return res.ok;
}

/** Arşivle/arşivden çıkar — kişisel tercih, yetki gerektirmez (2026-07-22). Yıkıcı DEĞİL
 * (`hideConversation`'ın aksine) — her konuşma tipinde herkes kullanabilir. */
export async function setConversationArchived(conversationId: string, archived: boolean, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/archive${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ archived }),
  });
  return res.ok;
}

/** Bu cihazın FCM token'ını kaydet — bildirim izni verilince çağrılır. */
export async function registerPushToken(token: string, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/push/register${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.ok;
}

/** Çıkış yaparken bu cihazın token'ını sil — kalıcı olmayan bir cihazda tekrar push almasın. */
export async function unregisterPushToken(token: string, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/push/unregister${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.ok;
}

/** Genel bildirim tercihi (aç/kapat) — token kayıtlı olmasa bile okunabilir (varsayılan false). */
export async function fetchPushSettings(personId?: string): Promise<{ notificationsEnabled: boolean; soundEnabled: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/push/settings${qs(personId)}`, { headers });
  if (!res.ok) return { notificationsEnabled: false, soundEnabled: false };
  return (await res.json()) as { notificationsEnabled: boolean; soundEnabled: boolean };
}

export async function setPushNotificationsEnabled(enabled: boolean, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/push/settings${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  return res.ok;
}

/** Bildirim SESİ (2026-07-20) — bildirimin kendisinden bağımsız, varsayılan KAPALI. */
export async function setPushSoundEnabled(enabled: boolean, personId?: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/push/settings${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ soundEnabled: enabled }),
  });
  return res.ok;
}

/**
 * Flex Connect Mobil "Sorun Bildir" / "Öneri Gönder" (2026-07-20) — SADECE öğrenci
 * route ailesinde var (`personId` zorunlu, `case.create` yetkisi gerektirmeyen dar
 * kapsamlı self-servis uç nokta). Personel tarafında karşılığı YOK — bkz.
 * `mobile/page.tsx`'teki `mailto:` yedeği (Case bir Person'a bağlı olmak zorunda,
 * personelin buna denk bir kaydı yok).
 */
export async function reportIssue(kind: "sorun" | "oneri", message: string, personId: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/student/connect/report-issue?personId=${personId}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ kind, message }),
  });
  return res.ok;
}

/**
 * Ad/açıklama/yayıncı listesi düzenleme (2026-07-18, kalan 2 madde) —
 * SADECE personel (öğrenci hiçbir zaman owner/admin olamaz, bkz. `updateConversationMeta`).
 */
export async function updateConversationMeta(
  conversationId: string,
  input: { name?: string; description?: string; adminUids?: string[]; childIds?: string[] },
): Promise<{ ok: boolean; error?: string; admins?: string[]; childIds?: string[]; announcementChannelId?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/connect/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.ok) {
    const data = (await res.json()) as { item: { admins: string[]; childIds?: string[]; announcementChannelId?: string } };
    return { ok: true, admins: data.item.admins, childIds: data.item.childIds, announcementChannelId: data.item.announcementChannelId };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: (data as { error?: string }).error ?? "Sunucu hatası." };
}

/** Kanal/grup/topluluk silme (2026-07-18, kullanıcı isteği) — SADECE owner. */
export async function deleteConversationById(conversationId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/connect/conversations/${conversationId}`, { method: "DELETE", headers });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: (data as { error?: string }).error ?? "Sunucu hatası." };
}

/** Üyeyi konuşmadan çıkar (admin başkasını, herkes kendini çıkarabilir) —
 * `leaveConversation` ile AYNI uç, sadece "kendinden başkasını çıkarma" akışında
 * daha net bir isim (2026-07-18, grup/kanal üye yönetimi). */
export async function removeConversationMember(conversationId: string, uid: string): Promise<boolean> {
  return leaveConversation(conversationId, uid);
}

export async function fetchDirectory(): Promise<DirectoryUser[]> {
  const headers = await authHeaders();
  const res = await fetch("/api/flexos/connect/directory", { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: DirectoryUser[] };
  return data.items;
}

/** Personel raydaki "Öğrenciler" — eğitmenin KENDİ öğrencileri, dedup (DM için). */
export async function fetchStudentDirectory(): Promise<DirectoryUser[]> {
  const headers = await authHeaders();
  const res = await fetch("/api/flexos/connect/student-directory", { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: DirectoryUser[] };
  return data.items;
}

/** Öğrenci raydaki "Eğitmenlerim" — kayıtlı olduğu grupların eğitmen(ler)i (DM için). */
export async function fetchTrainerDirectory(personId: string): Promise<DirectoryUser[]> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/student/connect/trainer-directory?personId=${personId}`, { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: DirectoryUser[] };
  return data.items;
}

export interface ConversationMemberView {
  uid: string;
  name?: string;
  colorKey?: string;
  role: "owner" | "admin" | "member" | "guest";
  /** SADECE role==="guest" — "Yardımcı Eğitmen"/"Gözlemci"/"Konuk"/"Veli" gibi rozet (Faz 2 madde 4). */
  guestTitle?: string;
}

export interface ConversationDetail {
  id: string;
  name: string;
  description?: string;
  audience?: string;
  members: ConversationMemberView[];
  /** SADECE type==="channel" — Yayıncılar (yazma yetkisi olanlar). */
  admins: string[];
  ownerUid: string;
  /** SADECE type==="community" — paketlediği grup konuşmalarının id'leri. */
  childIds?: string[];
  /** SADECE type==="community" — bağlı "Genel Duyuru" kanalının id'si (2026-07-18). */
  announcementChannelId?: string;
}

/** "Bilgi" paneli — açıklama + gerçek üye listesi (audience köprü kanallarında
 * üye dokümanı olmayabilir, bu durumda sadece yöneticiler listelenir — "428 üye"
 * gibi uydurma bir sayı GÖSTERİLMEZ, mockup'ın aksine gerçek veriye sadık kalınır). */
export async function fetchConversationDetail(conversationId: string, personId?: string): Promise<ConversationDetail | null> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}${qs(personId)}`, { headers });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    item: { id: string; name: string; description?: string; audience?: string; admins: string[]; ownerUid: string; childIds?: string[]; announcementChannelId?: string };
    members: ConversationMemberView[];
  };
  return {
    id: data.item.id,
    name: data.item.name,
    description: data.item.description,
    audience: data.item.audience,
    members: data.members,
    admins: data.item.admins,
    ownerUid: data.item.ownerUid,
    childIds: data.item.childIds,
    announcementChannelId: data.item.announcementChannelId,
  };
}

/** Konuşmadan ayrıl — SADECE personel sayfasında sunulur (bkz. page.tsx menü). */
export async function leaveConversation(conversationId: string, uid: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/connect/conversations/${conversationId}/members?uid=${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

/**
 * "Sohbeti Sil" (2026-07-20) — SADECE personel için (öğrenci tarafında karşılığı
 * YOK, `hideConversationForMe` yetki kuralı gereği). WhatsApp'taki gibi kişisel
 * gizleme — karşı tarafın görünümünü etkilemez, mesajları silmez.
 */
export async function hideConversation(conversationId: string): Promise<boolean> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/connect/conversations/${conversationId}/hide`, { method: "POST", headers });
  return res.ok;
}

/** Misafir/üye ekle (Faz 2 madde 4 — 2026-07-18) — SADECE personel sayfasında
 * (grup yönetimi, "Bilgi" paneli). `guestTitle` SADECE `role:"guest"` ile anlamlı. */
export async function addConversationMember(
  conversationId: string,
  uid: string,
  role: "member" | "guest" = "guest",
  guestTitle?: string,
): Promise<{ error?: string } | null> {
  const headers = await authHeaders();
  const res = await fetch(`/api/flexos/connect/conversations/${conversationId}/members`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ uid, role, guestTitle }),
  });
  if (!res.ok) return (await res.json().catch(() => ({}))) as { error?: string };
  return null;
}

export interface CreateConversationBody {
  realm: ConnectRealm;
  type: ConnectConversationType;
  name: string;
  description?: string;
  colorKey?: string;
  memberUids: string[];
  audience?: "all_students";
  childIds?: string[];
  /** SADECE type==="community" (2026-07-18) — bkz. `ConnectConversation.announcementChannelId`. */
  announcementChannelId?: string;
  sourceGroupId?: string;
  broadcastToAllStaff?: boolean;
  readerUids?: string[];
  /** SADECE type==="channel" (2026-07-20) — "Herkes Yazabilir" seçimi, bkz. `ConnectWritePolicy`. */
  writePolicy?: ConnectWritePolicy;
}

/** `personId` verilirse öğrenci route ailesine gider — Faz 1'de SADECE "kendi
 * eğitmenine DM" istisnası için (bkz. `connect-service.ts::createConversation`). */
export async function createConversation(body: CreateConversationBody, personId?: string): Promise<{ id: string } | { error: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Oluşturulamadı." };
  return data as { id: string };
}

/**
 * Gerçek-zamanlı mesaj dinleme — mevcut ödev-chat (`chats/{id}/messages`) ile
 * AYNI KANITLANMIŞ desen (`onSnapshot`, SSE/broadcast DEĞİL). Rules izin verdiği
 * için (üye VEYA audience köprüsü) client doğrudan dinleyebilir.
 */
export function subscribeToMessages(conversationId: string, onChange: () => void): () => void {
  const q = query(collection(db, "connect_conversations", conversationId, "messages"), orderBy("createdAt", "asc"));
  return onSnapshot(q, () => onChange(), (err) => console.error("[connect] messages onSnapshot hata:", err));
}

export interface TypingSignal { uid: string; name: string; at: string }

/** Gerçek presence — mesajlarla AYNI `onSnapshot` deseni, `typing` alt-koleksiyonu üzerinden. */
export function subscribeToTyping(conversationId: string, onChange: (signals: TypingSignal[]) => void): () => void {
  const q = collection(db, "connect_conversations", conversationId, "typing");
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data() as TypingSignal)),
    (err) => console.error("[connect] typing onSnapshot hata:", err),
  );
}

/** "Yazıyor" sinyali gönder — çağıran taraf throttle etmeli (ör. 2sn'de bir), her tuşta değil. */
export async function sendTypingSignal(conversationId: string, personId?: string): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${base(personId)}/conversations/${conversationId}/typing${qs(personId)}`, { method: "POST", headers }).catch(() => {});
}

// ─── Presence (2026-07-20) — SADECE personel. Typing'den farklı olarak
// konuşmaya özel DEĞİL, `connect_presence/{uid}` tek global doküman. ───

export type PresenceStatus = "online" | "in_class" | "dnd";
export interface PresenceSignal { uid: string; status: PresenceStatus; lastActiveAt: string }

export const PRESENCE_HEARTBEAT_MS = 20_000;
/** Gönderim aralığının 2 katından fazla — kaçırılan tek heartbeat'te yanlış çevrimdışı göstermeyi önler. */
export const PRESENCE_TTL_MS = 45_000;

/** `connect_presence/{uid}` — 30'luk `documentId() "in"` chunk (Firestore sınırı),
 * her chunk için ayrı `onSnapshot`, sonuçlar birleştirilip TEK callback'te raporlanır. */
export function subscribeToPresence(uids: string[], onChange: (signals: PresenceSignal[]) => void): () => void {
  const unique = [...new Set(uids)].filter(Boolean);
  if (unique.length === 0) { onChange([]); return () => {}; }
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));

  const latest = new Map<number, PresenceSignal[]>();
  function emit() { onChange(chunks.flatMap((_, i) => latest.get(i) ?? [])); }

  const unsubs = chunks.map((chunk, i) =>
    onSnapshot(
      query(collection(db, "connect_presence"), where(documentId(), "in", chunk)),
      (snap) => { latest.set(i, snap.docs.map((d) => d.data() as PresenceSignal)); emit(); },
      (err) => console.error("[connect] presence onSnapshot hata:", err),
    ),
  );
  return () => unsubs.forEach((u) => u());
}

export async function sendHeartbeat(personId?: string): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${base(personId)}/presence/heartbeat${qs(personId)}`, { method: "POST", headers }).catch(() => {});
}

export async function setMyPresenceStatus(status: PresenceStatus): Promise<void> {
  const headers = await authHeaders();
  await fetch("/api/flexos/connect/presence/status", {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status }),
  }).catch(() => {});
}

/** Gerçek offline hesabı — manuel "online"/"in_class"/"dnd" ne olursa olsun heartbeat
 * kesilmişse KIRMIZI. typing'deki bayatlık ilkesiyle AYNI (`Date.now() - at < TTL`). */
export function isPresenceOffline(p: PresenceSignal | undefined): boolean {
  if (!p) return true;
  return Date.now() - new Date(p.lastActiveAt).getTime() > PRESENCE_TTL_MS;
}
