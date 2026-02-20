import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// 1. ADIM: Değişkeni dışarıda tanımlayalım
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// 2. ADIM: Admin SDK Başlatma (Build sırasında patlamaması için kontrol eklendi)
if (!admin.apps.length) {
    if (privateKey) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
        console.log("✅ Firebase Admin başarıyla başlatıldı.");
    } else {
        // Build sırasında terminalde bunu göreceksin, bu normaldir.
        console.warn("⚠️ Firebase Private Key bulunamadı. Build aşamasında bu hata vermez.");
    }
}

export async function POST(request: Request) {
    console.log("🚀 API: Silme operasyonu tetiklendi.");

    // Güvenlik kontrolü: Eğer anahtar yoksa işlem yapma
    if (!admin.apps.length) {
        return NextResponse.json({ error: 'Firebase Admin başlatılamadı.' }, { status: 500 });
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