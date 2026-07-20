export type ConnectPresenceStatus = "online" | "in_class" | "dnd";

/**
 * connect_presence/{uid} — konuşmadan bağımsız, personel başına TEK global
 * doküman (typing'in aksine bir konuşma alt-koleksiyonu değil). "offline"
 * burada bir alan değil: heartbeat susarsa client `lastActiveAt`'e bakıp
 * TTL'e göre türetir (typing'deki bayatlık ilkesiyle aynı).
 */
export interface ConnectPresence {
  uid: string;
  tenantId: string;
  status: ConnectPresenceStatus; // kullanıcının son manuel seçimi — heartbeat bunu DEĞİŞTİRMEZ
  lastActiveAt: string; // ISO — her heartbeat + her manuel durum değişiminde güncellenir
}
