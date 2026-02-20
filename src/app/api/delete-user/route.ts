import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Firebase Admin Başlatma Fonksiyonu (Daha temiz ve güvenli)
const initializeAdmin = () => {
    if (admin.apps.length > 0) return;

    const rawKey = process.env.FIREBASE_PRIVATE_KEY;

    if (rawKey) {
        try {
            // TEMİZLİK OPERASYONU: 
            // 1. trim() ile sağdaki soldaki boşlukları atar.
            // 2. replace(/^c/, '') ile o meşhur 'c' harfi başta varsa siler.
            // 3. replace(/^"|"$/g, '') ile varsa başındaki sonundaki tırnakları söker.
            // 4. replace(/\\n/g, '\n') ile alt satır işaretlerini düzeltir.
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
        console.warn("⚠️ FIREBASE_PRIVATE_KEY bulunamadı (Build aşamasında normaldir).");
    }
};

export async function POST(request: Request) {
    // Her istekte başlatmayı kontrol et
    initializeAdmin();

    if (!admin.apps.length) {
        return NextResponse.json({ error: 'Firebase Admin başlatılamadı. Anahtar hatası.' }, { status: 500 });
    }

    try {
        const { uid } = await request.json();

        if (!uid) {
            return NextResponse.json({ error: 'UID eksik' }, { status: 400 });
        }

        // Authentication'dan silme
        await admin.auth().deleteUser(uid);
        console.log(`✅ ${uid} UID'li kullanıcı sistemden kazındı.`);

        return NextResponse.json({ message: 'Başarıyla silindi' });

    } catch (error: any) {
        console.error("❌ API Hatası:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}