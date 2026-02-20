import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// --- BU KISIM KUTSALDIR, DOKUNULMADI ---
const initializeAdmin = () => {
    if (admin.apps.length > 0) return;
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    if (rawKey) {
        try {
            const cleanedKey = rawKey
                .trim()
                .replace(/^c/, '')
                .replace(/^"|"$/g, '')
                .replace(/\\n/g, '\n');

            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: cleanedKey,
                }),
            });
            console.log("✅ Firebase Admin temizlenmiş anahtarla başlatıldı.");
        } catch (error) {
            console.error("❌ Başlatma sırasında kritik hata:", error);
        }
    } else {
        console.warn("⚠️ FIREBASE_PRIVATE_KEY bulunamadı.");
    }
};

// --- GÜNCELLENMİŞ POST FONKSİYONU ---
export async function POST(request: Request) {
    initializeAdmin();

    if (!admin.apps.length) {
        return NextResponse.json({ error: 'Firebase Admin başlatılamadı.' }, { status: 500 });
    }

    try {
        const { uid } = await request.json();

        if (!uid) {
            return NextResponse.json({ error: 'UID eksik' }, { status: 400 });
        }

        // 🛡️ PROFESYONEL ZIRH: Silinmek istenen kullanıcıyı önce bir sorgula
        const userToCheck = await admin.auth().getUser(uid);

        // Buraya kendi admin mailini yaz hocam
        if (userToCheck.email === "senin_email_adresin@gmail.com") {
            console.log("🚫 KRİTİK: Ana admin silme talebi reddedildi!");
            return NextResponse.json(
                { error: 'Sistem sahibi silinemez! Bu işlem güvenlik gereği engellenmiştir.' },
                { status: 403 }
            );
        }

        // --- HER ŞEY YOLUNDAYSA SİLME İŞLEMİ GERÇEKLEŞİR ---
        await admin.auth().deleteUser(uid);
        console.log(`✅ ${uid} UID'li kullanıcı sistemden kazındı.`);

        return NextResponse.json({ message: 'Başarıyla silindi' });

    } catch (error: any) {
        console.error("❌ API Hatası:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}