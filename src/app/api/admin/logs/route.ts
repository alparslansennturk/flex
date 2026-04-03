import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "mail" | "score"

  try {
    if (type === "mail") {
      const snap = await adminDb
        .collection("mailLogs")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      const logs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
      }));
      return NextResponse.json({ logs });
    }

    if (type === "score") {
      const snap = await adminDb
        .collection("scoreLogs")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      const logs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
      }));
      return NextResponse.json({ logs });
    }

    return NextResponse.json({ error: "type parametresi gerekli: mail veya score" }, { status: 400 });
  } catch (err) {
    console.error("[logs/route] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
