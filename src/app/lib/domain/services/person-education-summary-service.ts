import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId } from "../base";
import type { Enrollment } from "../core/enrollment";
import { officeName } from "../../branch-offices";
import { ForbiddenError } from "../errors";
import { getCertificateSettings } from "./certificate-settings-service";
import { computeOdevYuzdeleri, combineOdevYuzdesi } from "./submission-service";
import { calcEstimatedEndDate, expandHolidayDates } from "./schedule-calc";
import type { EnrollmentRepo } from "../repo/enrollment-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { EducationRepo, SectionRepo } from "../repo/catalog-repo";
import type { TrainerRepo } from "../repo/trainer-repo";
import type { AttendanceRepo } from "../repo/attendance-repo";
import type { GradeRepo } from "../repo/grade-repo";
import type { AssignmentRepo } from "../repo/assignment-repo";
import type { SubmissionRepo } from "../repo/submission-repo";
import type { CertificateSettingsRepo } from "../repo/certificate-settings-repo";
import type { HolidayRepo } from "../repo/holiday-repo";

export interface AttendanceSummary {
  pct: number | null; // toplam ders/katıldığı ders — grup için tutulan TÜM kayıtlar üzerinden
  totalSessions: number;
  attendedSessions: number;
  totalHours: number; // bölüm/eğitimin planlanan toplam saati (Section.hours ?? Education.totalHours)
  doneHours: number; // Yapılan Ders — öğrencinin GERÇEKTEN katıldığı saat
  faceHours: number;
  onlineHours: number;
  /** Devamsızlık — 2026-07-16 GERÇEK BUG düzeltmesi: eskiden `totalHours - doneHours`
   * (yani HENÜZ İŞLENMEMİŞ dersleri de "devamsızlık" sayıyordu, kullanıcı bulgusu: kursun
   * daha yeni başladığı bir öğrencide "87 saat devamsızlık" gibi saçma bir rakam çıkıyordu).
   * Doğrusu: SADECE gerçekten İŞLENMİŞ (attendance kaydı olan) derslerden katılmadığı saat. */
  absentHours: number;
  /** Yapılacak Ders — henüz hiç işlenmemiş (attendance kaydı açılmamış) saat. */
  upcomingHours: number;
}

export type CertificateStatus = "Başarı Sertifikası" | "Katılım Sertifikası" | "Kaldı" | "Bekliyor";

export interface CertificateSummary {
  sertifikaNotu: number | null; // Grade.projectGrade
  odevNotu: number | null; // combineOdevYuzdesi sonucu (0-100 yüzde)
  odevAktif: boolean;
  sertifikaPct: number;
  toplamNot: number | null;
  durum: CertificateStatus | null;
  locked: boolean;
}

export interface TrainingSummary {
  enrollmentId: EntityId;
  groupId: EntityId;
  groupCode: string;
  branchName: string | null; // Group.branch (denormalize)
  trainingName: string; // Education.name ?? Group.branch
  moduleName: string | null; // Section.name (bölümlü eğitimde)
  instructorName: string | null;
  courseStatus: string; // Devam Ediyor / Tamamlandı / Beklemede / Pasif / İptal Edildi
  startDate: string | null;
  /** GERÇEK ZAMANLI hesaplanır (`schedule-calc.ts::calcEstimatedEndDate`) — başlangıç +
   * haftalık ders günleri + toplam ders saati, tatil günleri ATLANARAK. Saklanmış bir
   * alan DEĞİL (`Group.schedule.endDate` KULLANILMAZ) — yeni tatil eklenince otomatik
   * yansır (2026-07-16, eski canlı sistemdeki davranışın FlexOS'a geri getirilmesi). */
  estimatedEndDate: string | null;
  attendance: AttendanceSummary | null;
  certificate: CertificateSummary | null;
}

export interface EducationSummaryResult {
  items: TrainingSummary[];
  /** `persons/route.ts::derivePoolStatus` ile AYNI mantık — burada da hesaplanır çünkü
   * o fonksiyon route dosyasına gömülü (domain katmanına taşınmadı), tekrar yazmak
   * import katmanı ihlalinden (domain → api route) daha basit/güvenli. */
  poolStatus: string;
  subeler: string[]; // branch office adları (grupların branchOfficeId'sinden), tekilleştirilmiş
}

/** `persons/route.ts::derivePoolStatus` ile BİREBİR aynı — bkz. oradaki yorum. */
function derivePoolStatus(enrollments: Enrollment[]): string {
  if (enrollments.length === 0) return "grupsuz";
  const active = enrollments.filter((e) => e.status === "active");
  if (active.some((e) => !e.groupId)) return "grupsuz";
  if (active.length > 0) return "aktif";
  if (enrollments.some((e) => e.status === "on_hold")) return "beklemede";
  if (enrollments.some((e) => e.status === "completed")) return "mezun";
  if (enrollments.some((e) => e.status === "passive")) return "pasif";
  if (enrollments.every((e) => e.status === "cancelled")) return "iptal";
  return "pasif";
}

function courseStatusFor(enrollmentStatus: string): string {
  switch (enrollmentStatus) {
    case "completed": return "Tamamlandı";
    case "on_hold": return "Beklemede";
    case "passive": return "Pasif";
    case "cancelled": return "İptal Edildi";
    default: return "Devam Ediyor"; // active
  }
}

function durumFor(toplamNot: number | null): CertificateStatus | null {
  if (toplamNot == null) return "Bekliyor";
  if (toplamNot >= 90) return "Başarı Sertifikası";
  if (toplamNot >= 50) return "Katılım Sertifikası";
  return "Kaldı";
}

export interface EducationSummaryDeps {
  enrollments: EnrollmentRepo;
  groups: GroupRepo;
  educations: EducationRepo;
  sections: SectionRepo;
  trainers: TrainerRepo;
  attendance: AttendanceRepo;
  grades: GradeRepo;
  assignments: AssignmentRepo;
  submissions: SubmissionRepo;
  certificateSettings: CertificateSettingsRepo;
  holidays: HolidayRepo;
}

/**
 * Bir kişinin TÜM eğitim geçmişi (her modül/branş = ayrı Enrollment) — Öğrenci Detay
 * (sayfa + modal) "Eğitim Bilgileri" sekmesi için. Kişi başına TEK istekle tüm
 * enrollment'lar + her biri için yoklama/sertifika özeti döner.
 *
 * Yoklama % hesabı `siniflar/[id]/page.tsx`'teki AYNI basitleştirmeyi kullanır: grup için
 * tutulan TÜM yoklama kayıtları üzerinden (kişinin kayıt tarihinden bağımsız) — bilinen
 * bir sınır, ileride enrollment penceresine göre daraltılabilir.
 *
 * Sertifika hesabı `sertifikasyon/not/page.tsx::computeTotal`/`odevYuzdesi` ile AYNI
 * formül (normal %30 + proje %70 ağırlıklı ödev notu, sertifikaPct ile sertifika notuyla
 * karıştırılır). Ağırlık ayarı BAKAN AKTÖRÜN kendi `certificate-settings`'inden okunur
 * (aynı `not/page.tsx`'in yaptığı gibi — grubun kendi eğitmeninin ayarı değil, bilinen bir
 * basitleştirme, standalone kişisel override nadiren farklılaştığı için kabul edilebilir).
 *
 * Bir enrollment'ın grubuna erişim yetkisi (attendance.read VEYA grade.read, assigned/org
 * scope) yoksa o modül SESSİZCE listeden atlanır (hata fırlatılmaz) — başka bir eğitmenin
 * grubundaki geçmiş modül, bu aktöre hiç gösterilmez.
 */
export async function getEducationSummaryForPerson(
  actor: Actor,
  personId: EntityId,
  deps: EducationSummaryDeps,
): Promise<EducationSummaryResult> {
  if (!can(actor, "person.read")) throw new ForbiddenError("person.read");

  const allEnrollments = await deps.enrollments.listByPerson(personId, actor.tenantId);
  const poolStatus = derivePoolStatus(allEnrollments);

  const enrollments = allEnrollments
    .filter((e) => !!e.groupId)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const results: TrainingSummary[] = [];
  const subeler = new Set<string>();
  const holidayDates = expandHolidayDates(await deps.holidays.list(actor.tenantId));

  for (const enr of enrollments) {
    const group = await deps.groups.getById(enr.groupId as string, actor.tenantId);
    if (!group) continue;
    if (group.branchOfficeId) subeler.add(officeName(group.branchOfficeId));

    const target = { groupId: group.id, ownerUid: group.trainerId };
    const canAttendance = can(actor, "attendance.read", target);
    const canGrade = can(actor, "grade.read", target);
    if (!canAttendance && !canGrade) continue; // başka eğitmenin grubu — bu modülü hiç gösterme

    const [education, section, trainer] = await Promise.all([
      enr.educationId ? deps.educations.getById(enr.educationId, actor.tenantId) : Promise.resolve(null),
      group.sectionId ? deps.sections.getById(group.sectionId, actor.tenantId) : Promise.resolve(null),
      group.trainerId ? deps.trainers.getById(group.trainerId, actor.tenantId) : Promise.resolve(null),
    ]);

    const totalHours = section?.hours ?? education?.totalHours ?? 0;

    let attendance: AttendanceSummary | null = null;
    if (canAttendance) {
      const records = await deps.attendance.listByGroup(group.id, actor.tenantId);
      const totalSessions = records.length;
      // `heldHours` — bu kayıtların GERÇEKTEN işlendiği (Dersi Başlat'ın açıldığı) toplam
      // saat, planlanan toplamdan (`totalHours`) FARKLI — kurs daha yeni başlamışsa çoğu
      // ders henüz hiç işlenmemiştir. Devamsızlık SADECE işlenmiş derslerden hesaplanır.
      let attendedSessions = 0, doneHours = 0, faceHours = 0, onlineHours = 0, heldHours = 0;
      for (const r of records) {
        heldHours += r.sessionHours;
        const entry = r.entries[personId];
        const earned = Math.min(entry?.hours ?? 0, r.sessionHours);
        if (earned > 0) {
          attendedSessions += 1;
          doneHours += earned;
          if (entry?.online) onlineHours += earned; else faceHours += earned;
        }
      }
      attendance = {
        pct: totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : null,
        totalSessions, attendedSessions, totalHours, doneHours, faceHours, onlineHours,
        absentHours: Math.max(0, heldHours - doneHours),
        upcomingHours: Math.max(0, totalHours - heldHours),
      };
    }

    let certificate: CertificateSummary | null = null;
    if (canGrade) {
      const [grade, odevResult, settings] = await Promise.all([
        deps.grades.getById(enr.id, actor.tenantId),
        computeOdevYuzdeleri(actor.tenantId, group.id, { assignments: deps.assignments, submissions: deps.submissions }),
        getCertificateSettings(actor, deps.certificateSettings),
      ]);
      const certType = education?.certType ?? "project";
      const weighting = settings[certType];
      const sertifikaNotu = grade?.projectGrade ?? null;
      const odevNotu = combineOdevYuzdesi(odevResult, personId);
      let toplamNot: number | null = null;
      if (weighting.odevAktif) {
        if (sertifikaNotu != null) {
          toplamNot = Math.round((sertifikaNotu * weighting.sertifikaPct + (odevNotu ?? 0) * (100 - weighting.sertifikaPct)) / 100);
        }
      } else if (sertifikaNotu != null) {
        toplamNot = Math.round(sertifikaNotu);
      }
      certificate = {
        sertifikaNotu, odevNotu, odevAktif: weighting.odevAktif, sertifikaPct: weighting.sertifikaPct,
        toplamNot, durum: durumFor(toplamNot), locked: grade?.locked ?? false,
      };
    }

    const sessionHours = group.schedule?.sessionHours ?? 0;
    const totalSessionsNeeded = totalHours > 0 && sessionHours > 0 ? Math.ceil(totalHours / sessionHours) : 0;
    const estimatedEndDate = calcEstimatedEndDate(
      group.schedule?.startDate, totalSessionsNeeded, group.schedule?.days ?? [], holidayDates,
    );

    results.push({
      enrollmentId: enr.id,
      groupId: group.id,
      groupCode: group.code,
      branchName: group.branch ?? null,
      trainingName: education?.name ?? group.branch ?? "Eğitim",
      moduleName: section?.name ?? null,
      instructorName: trainer?.name ?? null,
      courseStatus: courseStatusFor(enr.status),
      startDate: group.schedule?.startDate ?? null,
      estimatedEndDate,
      attendance, certificate,
    });
  }

  return { items: results, poolStatus, subeler: [...subeler] };
}
