/**
 * Flex Connect servis cephesi (facade). Gerçek uygulama madde 16 (2026-07-31,
 * FLEXOS_TEKNIK_BORC.md) kapsamında alt-domain dosyalarına bölündü — bu dosya
 * SADECE geriye dönük uyumluluk için tüm public API'yi tek yerden re-export eder,
 * 45+ tüketici dosyanın import yolu (`.../services/connect-service`) DEĞİŞMEDİ:
 * - `connect-types.ts` — ConnectPrincipal/ConnectDeps ve input tipleri
 * - `connect-helpers.ts` — paylaşılan yetki/audit/isim çözümleme yardımcıları
 * - `connect-conversation-service.ts` — konuşma CRUD + kişisel görünüm tercihleri
 * - `connect-messaging-service.ts` — mesaj gönder/düzenle/sil/reaksiyon/yazıyor
 * - `connect-roster-service.ts` — üye ekle/çıkar/listele
 */
export type { ConnectDeps, ConnectPrincipal, CreateConversationInput, UpdateConversationMetaInput } from "./connect-types";

export { resolveDisplayName } from "./connect-helpers";

export {
  clearConversationForMe,
  createConversation,
  deleteConversation,
  getConversation,
  hideConversationForMe,
  listConversationsForPrincipal,
  markDeliveredFromList,
  setArchived,
  setMuted,
  setPinned,
  updateConversationMeta,
} from "./connect-conversation-service";

export {
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  listMessages,
  listStarredMessages,
  listTypingSignals,
  markRead,
  sendMessage,
  setMessageReaction,
  setTypingSignal,
  toggleMessageStar,
} from "./connect-messaging-service";

export { addMember, listMembers, removeMember } from "./connect-roster-service";
