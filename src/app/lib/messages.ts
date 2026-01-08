import { MessageType } from './constants';

export interface FlexMessage {
  text: string;
  type: MessageType;
}

/**
 * FLEX OS - Merkezi Mesaj Sözlüğü
 * Güvenlik standartları gereği kullanıcı/şifre hataları tek tip mesajda toplandı.
 */
export const FLEX_MESSAGES: Record<string, FlexMessage> = {
  // --- AUTH HATALARI (Giriş Güvenliği Standartı) ---
  'auth/invalid-email': {
    text: 'Giriş bilgileri hatalı',
    type: 'error'
  },
  'auth/user-not-found': {
    text: 'Giriş bilgileri hatalı',
    type: 'error'
  },
  'auth/wrong-password': {
    text: 'Giriş bilgileri hatalı',
    type: 'error'
  },
  'auth/too-many-requests': {
    text: 'Çok fazla deneme yapıldı. Lütfen bekleyin.',
    type: 'error'
  },

  // --- UYARILAR ---
  'auth/weak-password': {
    text: 'Seçtiğiniz şifre güvenlik standartlarının altında.',
    type: 'warning'
  },
  'system/unauthorized': {
    text: 'Bu işlem için yetkiniz bulunmuyor.',
    type: 'warning'
  },

  // --- BİLGİLER ---
  'auth/network-request-failed': {
    text: 'Bağlantı sorunu oluştu. İnternetinizi kontrol edin.',
    type: 'info'
  },

  // --- BAŞARI ---
  'auth/login-success': {
    text: 'Giriş başarılı. Hoş geldiniz!',
    type: 'success'
  }
};

/**
 * Gelen koda göre merkezi sözlükten mesajı döner.
 */
export const getFlexMessage = (code: string): FlexMessage => {
  return FLEX_MESSAGES[code] || { 
    text: 'Beklenmedik bir durum oluştu.', 
    type: 'error' 
  };
};