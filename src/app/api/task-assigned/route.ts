import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/app/lib/firebase-admin";
import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";

interface RequestBody {
  groupId:      string;
  taskName:     string;
  taskSubtitle?: string | null;
  endDate?:     string | null;
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim() ?? "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { groupId, taskName, taskSubtitle, endDate } = body;
  if (!groupId || !taskName) {
    return NextResponse.json({ error: "groupId ve taskName zorunludur." }, { status: 400 });
  }

  // ── Aktif öğrencileri çek (passive/mezun ve disabled hariç) ───────────────
  const snap = await adminDb.collection("students").where("groupId", "==", groupId).get();
  const students = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>))
    .filter(s => s.status !== "passive" && s.accountStatus !== "disabled" && !!s.email);

  if (!students.length) {
    return NextResponse.json({ success: true, sent: 0, skipped: snap.size });
  }

  // ── Grup kodu (mail log için) ─────────────────────────────────────────────
  const groupDoc  = await adminDb.collection("groups").doc(groupId).get();
  const groupCode = (groupDoc.data()?.code as string | undefined) ?? "";

  // ── Tarih formatla ────────────────────────────────────────────────────────
  const fmtDate = endDate
    ? new Date(endDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // ── Her öğrenciye mail at ─────────────────────────────────────────────────
  let sent = 0;
  for (const student of students) {
    const email    = student.email as string;
    const name     = (student.name  as string | undefined) ?? "";
    const lastName = (student.lastName as string | undefined) ?? (student.surname as string | undefined) ?? "";
    const fullName = `${name} ${lastName}`.trim() || "Öğrenci";

    const subject = `Yeni Ödeviniz: ${taskName}`;
    const html    = buildHtml({ name, taskName, taskSubtitle: taskSubtitle ?? null, fmtDate });

    const result = await sendMail({ to: email, subject, html });

    await saveMailLog({
      to: email,
      subject,
      type: "task-assigned",
      result,
      name: fullName,
      groupCode,
    });

    if (result.success) sent++;
  }

  console.log(`[task-assigned] ${groupId}: ${sent}/${students.length} mail gönderildi`);
  return NextResponse.json({ success: true, sent, total: students.length });
}

// ── HTML şablonu ──────────────────────────────────────────────────────────────
function buildHtml({ name, taskName, taskSubtitle, fmtDate }: {
  name: string;
  taskName: string;
  taskSubtitle: string | null | undefined;
  fmtDate: string | null;
}) {
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
  <h2 style="font-size:20px;font-weight:900;margin:0 0 2px">Flex</h2>
  <p style="font-size:12px;color:#9ca3af;margin:0 0 28px">Yeni Ödev Bildirimi</p>

  <p style="font-size:15px;font-weight:700;margin:0 0 6px">Merhaba ${name},</p>
  <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.65">
    Sana yeni bir ödev tanımlandı. Aşağıda ödev bilgilerini bulabilirsin.
  </p>

  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:20px 24px;margin-bottom:24px">
    <p style="font-size:17px;font-weight:800;margin:0 0 ${taskSubtitle ? "6px" : "0"}">${taskName}</p>
    ${taskSubtitle ? `<p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5">${taskSubtitle}</p>` : ""}
  </div>

  ${fmtDate ? `<p style="font-size:12px;color:#9ca3af;margin:0">Son teslim tarihi: <strong style="color:#6b7280">${fmtDate}</strong></p>` : ""}
</div>`;
}
