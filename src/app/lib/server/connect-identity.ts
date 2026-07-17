// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { firestorePersonRepo } from "./person-repo.firestore";
import { firestoreFlexosUserRepo } from "./flexos-user-repo.firestore";

export interface ConnectIdentity {
  uid: string;
  name: string;
  colorKey: string;
  kind: "staff" | "student";
}

// `odevler/teslim/.../page.tsx`deki AYNI 6 renkli sistem paleti — tutarlılık için
// (proje kuralı: avatar = baş harf + renk, illüstrasyon YOK).
const AVATAR_COLORS = ["#3A7BD5", "#FF8D28", "#009F3E", "#7C3AED", "#1CB5AE", "#F91079"];

function colorForUid(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * uid → {name, colorKey, kind} toplu çözümleme — mesaj/liste render'ında kullanılır.
 * `Message.authorUid`/`lastMessage.senderUid`'den isim SAKLANMAZ (2026-07-18 kararı),
 * her okumada burada çözülür — tek doğruluk kaynağı `persons`/`flexos_users`.
 */
export async function resolveConnectIdentities(uids: string[], tenantId: string): Promise<Record<string, ConnectIdentity>> {
  const uniqueUids = [...new Set(uids)].filter(Boolean);
  if (uniqueUids.length === 0) return {};

  const [persons, users] = await Promise.all([
    firestorePersonRepo.getByAuthUids(uniqueUids, tenantId),
    firestoreFlexosUserRepo.getByAuthUids(uniqueUids, tenantId),
  ]);

  const result: Record<string, ConnectIdentity> = {};
  for (const p of persons) {
    if (!p.authUid) continue;
    result[p.authUid] = {
      uid: p.authUid,
      name: `${p.firstName} ${p.lastName}`.trim(),
      colorKey: colorForUid(p.authUid),
      kind: "student",
    };
  }
  for (const u of users) {
    if (!u.authUid || result[u.authUid]) continue; // person eşleşmesi öncelikli (olmamalı ama defansif)
    result[u.authUid] = {
      uid: u.authUid,
      name: `${u.name} ${u.surname}`.trim(),
      colorKey: colorForUid(u.authUid),
      kind: "staff",
    };
  }

  // Hiçbir yerde bulunamayan uid'ler (silinmiş hesap vb.) için güvenli fallback.
  for (const uid of uniqueUids) {
    if (!result[uid]) result[uid] = { uid, name: "Bilinmeyen Kullanıcı", colorKey: colorForUid(uid), kind: "staff" };
  }

  return result;
}
