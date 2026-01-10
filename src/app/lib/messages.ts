/**
 * FLEX OS - Merkezi Mesaj Sözlüğü
 * Tasarım Atölyesi Standartları (2026)
 */

export type MessageType = 'error' | 'warning' | 'info' | 'success';

export interface FlexMessage {
  text: string;
  type: MessageType;
}

export const FLEX_MESSAGES: Record<string, FlexMessage> = {
  // --- AUTH HATALARI (Giriş Güvenliği Standartı) ---
  'auth/invalid-email': {
    text: 'E-posta adresi formatı uygun değil',
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
  'auth/invalid-credential': {
  text: 'Giriş bilgileri hatalı.',
  type: 'error'
},

  // --- AKTİVASYON VE ŞİFRE HATALARI (Yeni) ---
  'auth/password-criteria-failed': {
    text: 'Parola kriterleri karşılanmıyor',
    type: 'error'
  },
  'auth/passwords-do-not-match': {
    text: 'Parolalar eşleşmiyor',
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

  // --- BAŞARI MESAJLARI ---
  'auth/login-success': {
    text: 'Giriş başarılı. Hoş geldiniz!',
    type: 'success'
  },
  'auth/activation-success': {
    text: 'Hesap başarıyla aktifleştirildi',
    type: 'success'
  },
    'auth/reset-email-sent': {
    text: 'E-Posta Başarıyla Gönderildi',
    type: 'success'
  }
};

/**
 * Gelen koda göre merkezi sözlükten mesajı döner.
 * Eğer kod bulunamazsa standart bir hata mesajı döndürür.
 */
export const getFlexMessage = (code: string): FlexMessage => {
  return FLEX_MESSAGES[code] || { 
    text: 'beklenmedik bir durum oluştu.', 
    type: 'error' 
  };
};