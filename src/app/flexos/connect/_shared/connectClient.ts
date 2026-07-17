/**
 * Flex Connect — paylaşımlı client fonksiyonları. Personel (`/flexos/connect`) ve
 * öğrenci (`/flexos/student/connect`) sayfaları AYNI fonksiyonları kullanır —
 * `personId` verilirse öğrenci route ailesine (`/api/flexos/student/connect/*`),
 * verilmezse personel route ailesine (`/api/flexos/connect/*`) gider (bkz.
 * `connect-principal.ts`: iki ayrı kimlik çözümleme mekanizması).
 */
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";

export type ConnectRealm = "staff" | "trainer_student";
export type ConnectConversationType = "channel" | "group" | "community" | "dm";
export type ConnectWritePolicy = "admins" | "members";

export interface ConversationView {
  id: string;
  realm: ConnectRealm;
  type: ConnectConversationType;
  name: string;
  colorKey?: string;
  writePolicy: ConnectWritePolicy;
  audience?: string;
  lastMessage: { text: string; senderUid: string; senderName: string; at: string } | null;
  unread: boolean;
  unreadCount: number;
  isMember: boolean;
  isAdmin: boolean;
  pinned: boolean;
  /** SADECE type==="dm" — karşı tarafın uid'i (Personel/Öğrenciler/Eğitmenlerim
   * dizininden birine tıklayınca var olan DM'i bulmak için). */
  peerUid?: string;
}

export interface MessageView {
  id: string;
  authorUid: string;
  authorName: string;
  colorKey: string;
  isMine: boolean;
  text: string;
  createdAt: string;
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

export async function postMessage(conversationId: string, text: string, personId?: string): Promise<{ error?: string } | null> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}/messages${qs(personId)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return (await res.json().catch(() => ({}))) as { error?: string };
  return null;
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
}

export interface ConversationDetail {
  id: string;
  name: string;
  description?: string;
  audience?: string;
  members: ConversationMemberView[];
}

/** "Bilgi" paneli — açıklama + gerçek üye listesi (audience köprü kanallarında
 * üye dokümanı olmayabilir, bu durumda sadece yöneticiler listelenir — "428 üye"
 * gibi uydurma bir sayı GÖSTERİLMEZ, mockup'ın aksine gerçek veriye sadık kalınır). */
export async function fetchConversationDetail(conversationId: string, personId?: string): Promise<ConversationDetail | null> {
  const headers = await authHeaders();
  const res = await fetch(`${base(personId)}/conversations/${conversationId}${qs(personId)}`, { headers });
  if (!res.ok) return null;
  const data = (await res.json()) as { item: { id: string; name: string; description?: string; audience?: string }; members: ConversationMemberView[] };
  return { id: data.item.id, name: data.item.name, description: data.item.description, audience: data.item.audience, members: data.members };
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

export interface CreateConversationBody {
  realm: ConnectRealm;
  type: ConnectConversationType;
  name: string;
  description?: string;
  colorKey?: string;
  memberUids: string[];
  audience?: "all_students";
  childIds?: string[];
  sourceGroupId?: string;
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
