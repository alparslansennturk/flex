import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function DELETE(req: NextRequest) {
  try {
    const { ids, type } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !type) {
      return NextResponse.json({ error: "ids[] ve type zorunludur." }, { status: 400 });
    }

    const collection = type === "mail" ? "mailLogs" : type === "score" ? "scoreLogs" : null;
    if (!collection) {
      return NextResponse.json({ error: "Geçersiz type. 'mail' veya 'score' olmalı." }, { status: 400 });
    }

    // Firestore batch max 500 işlem
    for (let i = 0; i < ids.length; i += 500) {
      const batch = adminDb.batch();
      ids.slice(i, i + 500).forEach((id: string) => {
        batch.delete(adminDb.collection(collection).doc(id));
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err) {
    console.error("[logs/delete-many] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
