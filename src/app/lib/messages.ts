/**
 * FLEX OS - Merkezi Mesaj Sözlüğü
 */

export type MessageType = 'error' | 'warning' | 'info' | 'success';

export interface FlexMessage {
  text: string;
  type: MessageType;
}

export const FLEX_MESSAGES: Record<string, FlexMessage> = {
  // --- MEVCUT AUTH HATALARI ---
  'auth/invalid-email': { text: 'E-posta adresi formatı uygun değil', type: 'error' },
  'auth/user-not-found': { text: 'Giriş bilgileri hatalı', type: 'error' },
  'auth/wrong-password': { text: 'Giriş bilgileri hatalı', type: 'error' },
  'auth/too-many-requests': { text: 'Çok fazla deneme yapıldı. Lütfen bekleyin.', type: 'error' },
  'auth/invalid-credential': { text: 'Giriş bilgileri hatalı.', type: 'error' },
  'auth/password-criteria-failed': { text: 'Parola kriterleri karşılanmıyor', type: 'error' },
  'auth/passwords-do-not-match': { text: 'Parolalar eşleşmiyor', type: 'error' },
  'auth/weak-password': { text: 'Seçtiğiniz şifre güvenlik standartlarının altında.', type: 'warning' },
  'system/unauthorized': { text: 'Bu işlem için yetkiniz bulunmuyor.', type: 'warning' },
  'auth/network-request-failed': { text: 'Bağlantı sorunu oluştu.', type: 'info' },
  'auth/login-success': { text: 'Giriş başarılı. Hoş geldiniz!', type: 'success' },
  'auth/activation-success': { text: 'Hesabın aktifleştirildi!', type: 'success' },
  'auth/reset-email-sent': { text: 'E-Posta Başarıyla Gönderildi', type: 'success' },

  // --- YENİ EKLENEN VALİDASYON HATALARI (BURAYI EKLEDİK) ---
  'validation/required-fields': { 
    text: 'Eksik alanlar var. Lütfen kırmızı alanları doldurun.', 
    type: 'error' 
  },
  'validation/invalid-phone': { 
    text: 'Geçerli bir telefon numarası giriniz.', 
    type: 'error' 
  },
  'validation/role-required': { 
    text: 'En az bir kullanıcı rolü seçmelisiniz.', 
    type: 'error' 
  }
};

export const getFlexMessage = (code: string): FlexMessage => {
  return FLEX_MESSAGES[code] || { text: 'Beklenmedik bir durum oluştu.', type: 'error' };
};