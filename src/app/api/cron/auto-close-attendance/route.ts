import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

// Türkiye saati (UTC+3) ile offset gün sonrasının tarihini döndürür
function trDateString(offsetDays: number): string {
  const d = new Date();
  d.setTime(d.getTime() + (3 + offsetDays * 24) * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Gece 00:01 Türkiye saatinde çalışır → dün (biten günün) kayıtlarını kapatır
  const yesterdayTR = trDateString(-1);

  const snap = await adminDb
    .collection("design_attendance")
    .where("date", "==", yesterdayTR)
    .get();

  const toClose = snap.docs.filter(d => {
    const data = d.data();
    return !data.attendanceClosed && data.entries && Object.keys(data.entries).length > 0;
  });

  if (toClose.length === 0) {
    return NextResponse.json({ closed: 0, date: yesterdayTR });
  }

  const batch = adminDb.batch();
  const now = new Date();
  toClose.forEach(d => {
    batch.update(d.ref, { attendanceClosed: true, autoClosedAt: now });
  });
  await batch.commit();

  return NextResponse.json({ closed: toClose.length, date: yesterdayTR });
}
