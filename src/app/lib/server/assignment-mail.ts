import { sendMail } from "@/app/lib/email";
import { saveMailLog } from "@/app/services/emailService";
import type { Assignment } from "@/app/lib/domain/core/assignment";
import { firestoreEnrollmentRepo } from "@/app/lib/server/enrollment-repo.firestore";
import { firestorePersonRepo } from "@/app/lib/server/person-repo.firestore";
import { firestoreGroupRepo } from "@/app/lib/server/group-repo.firestore";

/**
 * "Ödevi Başlat" (status:"published") ile oluşturulan bir ödevi, gruptaki (veya
 * `targetPersonIds` doluysa sadece o kişilere) aktif öğrencilere mail olarak duyurur.
 *
 * 2026-07-17: eski (pasif) canlı sistemde `api/task-assigned` bunu yapıyordu ama
 * FlexOS'a hiç taşınmamıştı — kullanıcı bulgusu: öğrenciler mail gelmeyince canları
 * sıkıldıkça giriş yapmıyor. Brevo altyapısı zaten FlexOS'ta canlı (şifre sıfırlama,
 * kullanıcı kodu) — burada AYNI `sendMail`/`saveMailLog` reuse edildi.
 *
 * Best-effort: tek bir öğrenciye gönderim başarısız olsa bile diğerleri etkilenmez,
 * ve bu fonksiyonun kendisi asla ödev oluşturmayı BAŞARISIZ KILMAZ — çağıran yer
 * (route) try/catch içinde çağırmalı.
 */
export async function notifyAssignmentPublished(assignment: Assignment): Promise<{ sent: number; total: number }> {
  const personIds = assignment.targetPersonIds?.length
    ? assignment.targetPersonIds
    : (await firestoreEnrollmentRepo.listByGroup(assignment.groupId, assignment.tenantId))
        .filter((e) => e.status === "active")
        .map((e) => e.personId);

  if (personIds.length === 0) return { sent: 0, total: 0 };

  const [persons, group] = await Promise.all([
    firestorePersonRepo.getByIds(personIds, assignment.tenantId),
    firestoreGroupRepo.getById(assignment.groupId, assignment.tenantId),
  ]);

  const recipients = persons.filter((p) => p.status === "active" && p.pii?.email);
  if (recipients.length === 0) return { sent: 0, total: 0 };

  const fmtDate = assignment.dueDate
    ? new Date(assignment.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://flex-one-iota.vercel.app";

  const results = await Promise.allSettled(
    recipients.map(async (person) => {
      const email = person.pii!.email!;
      const fullName = `${person.firstName} ${person.lastName}`.trim() || "Öğrenci";
      const subject = `Yeni Ödeviniz: ${assignment.title}`;
      const html = buildHtml({
        name: person.firstName || fullName,
        title: assignment.title,
        subtitle: assignment.subtitle ?? null,
        fmtDate,
        groupCode: group?.code ?? "",
        actionUrl: `${appUrl}/flexos/student/${person.id}/${assignment.id}`,
      });

      const result = await sendMail({ to: email, subject, html });
      await saveMailLog({
        to: email,
        subject,
        type: "flexos-assignment-published",
        result,
        name: fullName,
        groupCode: group?.code,
      });
      return result.success;
    }),
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
  return { sent, total: recipients.length };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildHtml(params: {
  name: string;
  title: string;
  subtitle: string | null;
  fmtDate: string | null;
  groupCode: string;
  actionUrl: string;
}) {
  const { name, title, subtitle, fmtDate, groupCode, actionUrl } = params;
  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:40px 32px;color:#111">
  <p style="font-size:20px;font-weight:900;margin:0 0 2px;color:#FF5C00">flex</p>
  <p style="font-size:12px;color:#9ca3af;margin:0 0 28px">Yeni Ödev Bildirimi${groupCode ? ` · ${escapeHtml(groupCode)}` : ""}</p>

  <p style="font-size:15px;font-weight:700;margin:0 0 6px">Merhaba ${escapeHtml(name)},</p>
  <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.65">
    Sana yeni bir ödev tanımlandı. Aşağıdaki butondan ödevi hemen inceleyebilirsin.
  </p>

  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:20px 24px;margin-bottom:24px">
    <p style="font-size:17px;font-weight:800;margin:0 0 ${subtitle ? "6px" : "0"}">${escapeHtml(title)}</p>
    ${subtitle ? `<p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5">${escapeHtml(subtitle)}</p>` : ""}
  </div>

  ${fmtDate ? `<p style="font-size:12px;color:#9ca3af;margin:0 0 24px">Son teslim tarihi: <strong style="color:#6b7280">${fmtDate}</strong></p>` : ""}

  <table cellpadding="0" cellspacing="0" style="margin:0 0 8px">
    <tr>
      <td align="left">
        <a href="${actionUrl}" style="display:inline-block;background:#FF5C00;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px">
          Ödevi Görüntüle →
        </a>
      </td>
    </tr>
  </table>
</div>`;
}
