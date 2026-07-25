import { can } from "../access/can";
import type { Actor } from "../access/types";
import { ForbiddenError, ValidationError } from "../errors";
import type { AttendanceRepo } from "../repo/attendance-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { SettingsRepo } from "../repo/settings-repo";
import type { TrainerRepo } from "../repo/trainer-repo";
import { getSettings } from "./settings-service";

export interface TrainerEarnings {
  trainerId: string;
  month: string; // "YYYY-MM"
  hourlyRate: number; // Trainer.hourlyRate — Full modda Eğitmenler CRUD'undan admin girer
  monthlyHours: number; // o ay GERÇEK (istisna-kaynaklı olmayan) derslerin sessionHours toplamı
  lessonTotal: number; // hourlyRate * monthlyHours
  mealDays: number; // aynı günde 2+ FARKLI grubu olduğu gün sayısı
  dailyMealAllowance: number; // Sistem Ayarları > Finansal Ayarlar (şeffaflık için dönüyor)
  mealTotal: number; // mealDays * dailyMealAllowance
  total: number; // lessonTotal + mealTotal
}

export interface GetMyTrainerEarningsDeps {
  trainers: TrainerRepo;
  groups: GroupRepo;
  attendance: AttendanceRepo;
  settings: SettingsRepo;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

/** Server saatinden "YYYY-MM" — sadece `month` parametresi verilmediğinde varsayılan. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Çağıranın KENDİ aylık hak edişi — Eğitmen Hakediş (2026-07-25 kararı, ÖNCE Full mod).
 * SADECE self scope: `trainerId` URL'den/parametreden GELMEZ, `actor.trainerId`'den
 * çözülür — bu fonksiyon yapı gereği asla başka bir eğitmenin verisini döndüremez, admin/
 * Finans dahil kimse (bu uçtan) başkasının hakedişini göremez ("asla ve asla" kararı).
 *
 * Hesap: (o ay GERÇEKTEN işlenmiş derslerin toplam saati × ders saati ücreti) + yemek
 * ücreti. Yemek kuralı: bir günde 2+ FARKLI grup varsa o güne bir kez `dailyMealAllowance`
 * eklenir (Sistem Ayarları > Finansal Ayarlar — sabit kod DEĞİL, her sene değişebilir).
 *
 * "Gerçekten işlenmiş" = `!createdByException` — sayfanın her yerinde ("Bu ay X saat
 * ders verildi" özet barları, `AttendanceDetailList.tsx`/`yoklama/rapor/page.tsx`) AYNI
 * tanım kullanılıyor. DÜZELTME (2026-07-25, kullanıcı bulgusu — "sayfada 18 saat yazıyor,
 * sen 15 nereden buldun"): İLK yazımda burada YANLIŞLIKLA `attendanceClosed:true` şartı
 * vardı ("Dersi Bitir" ile kapatılmamış dersler sayılmıyordu) — bu, sayfanın geri kalanının
 * kullandığı tanımdan FARKLIYDI, aynı ay için iki farklı "kaç saat ders verildi" rakamı
 * gösteriyordu. Artık aynı tanım: yoklaması alınmış (istisna-kaynaklı olmayan) HER ders
 * sayılır, "Dersi Bitir" ile kapatılıp kapatılmadığına bakılmaz.
 */
export async function getMyTrainerEarnings(
  actor: Actor,
  month: string | undefined,
  deps: GetMyTrainerEarningsDeps,
): Promise<TrainerEarnings> {
  if (!actor.trainerId) {
    throw new ValidationError("Bu hesap bir eğitmen kaydına bağlı değil.");
  }
  if (!can(actor, "trainer.earnings.read", { ownerUid: actor.trainerId })) {
    throw new ForbiddenError("trainer.earnings.read");
  }

  const targetMonth = month ?? currentMonth();
  if (!MONTH_RE.test(targetMonth)) {
    throw new ValidationError("Geçersiz ay formatı — \"YYYY-MM\" bekleniyor.");
  }

  const trainer = await deps.trainers.getById(actor.trainerId, actor.tenantId);
  if (!trainer) throw new ValidationError("Eğitmen kaydı bulunamadı.");

  const groups = await deps.groups.list(actor.tenantId, actor.trainerId);
  const recordsPerGroup = await Promise.all(
    groups.map((g) => deps.attendance.listByGroup(g.id, actor.tenantId, targetMonth)),
  );
  const realRecords = recordsPerGroup.flat().filter((r) => !r.createdByException);

  const monthlyHours = realRecords.reduce((sum, r) => sum + r.sessionHours, 0);

  const groupsByDate = new Map<string, Set<string>>();
  for (const r of realRecords) {
    const set = groupsByDate.get(r.date) ?? new Set<string>();
    set.add(r.groupId);
    groupsByDate.set(r.date, set);
  }
  const mealDays = [...groupsByDate.values()].filter((set) => set.size >= 2).length;

  const settings = await getSettings(actor, deps.settings);

  const hourlyRate = trainer.hourlyRate ?? 0;
  const lessonTotal = hourlyRate * monthlyHours;
  const mealTotal = mealDays * settings.dailyMealAllowance;

  return {
    trainerId: actor.trainerId,
    month: targetMonth,
    hourlyRate,
    monthlyHours,
    lessonTotal,
    mealDays,
    dailyMealAllowance: settings.dailyMealAllowance,
    mealTotal,
    total: lessonTotal + mealTotal,
  };
}
