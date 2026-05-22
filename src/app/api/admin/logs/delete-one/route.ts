import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { verifyRequestToken } from "@/app/lib/submission-validation";

export async function DELETE(req: NextRequest) {
  const caller = await verifyRequestToken(req);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  try {
    const { id, type } = await req.json();

    if (!id || !type) {
      return NextResponse.json({ error: "id ve type zorunludur." }, { status: 400 });
    }

    const collection = type === "mail" ? "mailLogs" : type === "score" ? "scoreLogs" : null;
    if (!collection) {
      return NextResponse.json({ error: "Geçersiz type. 'mail' veya 'score' olmalı." }, { status: 400 });
    }

    await adminDb.collection(collection).doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[logs/delete-one] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
