import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Admin SDK Singleton Yapısı
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

// DİKKAT: Başına sakın 'default' ekleme! Sadece 'export' olacak.
export async function POST(request: Request) {
    console.log("🚀 API: Silme operasyonu tetiklendi.");
    
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