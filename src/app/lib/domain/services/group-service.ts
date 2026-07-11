import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Group, GroupSchedule, GroupStatus, GroupType } from "../core/group";
import { ForbiddenError, ValidationError } from "../errors";
import type { EducationRepo, SectionRepo, TrackRepo } from "../repo/catalog-repo";
import type { GroupRepo } from "../repo/group-repo";
import type { EnrollmentRepo } from "../repo/enrollment-repo";

export interface CreateGroupInput {
  code: string;
  type: GroupType;
  schedule: GroupSchedule;
  sectionId?: EntityId; // grubun işlediği Bölüm (Grafik-1) — bölümlü teslim birimi
  trackId?: EntityId; // (ops.) yalnız tek Track teslimi (Temel Photoshop standalone)
  educationId?: EntityId; // bağlı eğitim (Grafik Tasarım Kursu)
  branch?: string; // branş (Grafik Tasarım)
  trainerId?: string; // verilmezse oluşturan aktör (standalone eğitmen kendi grubunu kurar)
  branchOfficeId?: EntityId;
  capacity?: number;
  status?: GroupStatus; // verilmezse "planned"
}

const VALID_TYPES: GroupType[] = ["standart", "ozel_ders", "kurumsal"];

/**
 * Grup oluşturma bağımlılıkları. `educations`/`tracks` verilmezse referans
 * kontrolü atlanır (standalone eğitmen akışı katalogsuz çalışabilir).
 */
export interface CreateGroupDeps {
  groups: GroupRepo;
  educations?: EducationRepo;
  sections?: SectionRepo;
  tracks?: TrackRepo;
}

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

/**
 * Grup oluşturma — gated (`group.create`).
 * Eğitmen (geniş paket) kendi grubunu kurabilir; trainerId verilmezse aktörün kendisi.
 * Referans bütünlüğü: verilen educationId/trackId katalogda gerçekten var mı,
 * ve track verilen eğitime mi bağlı (tutarlılık) — deps'te repo varsa doğrulanır.
 */
export async function createGroup(
  actor: Actor,
  input: CreateGroupInput,
  deps: CreateGroupDeps,
): Promise<Group> {
  if (!can(actor, "group.create")) {
    throw new ForbiddenError("group.create");
  }

  const code = input.code?.trim();
  if (!code) throw new ValidationError("Grup kodu zorunludur.");
  if (!VALID_TYPES.includes(input.type)) throw new ValidationError("Geçersiz grup tipi.");

  const s = input.schedule;
  if (!s || !s.startDate) throw new ValidationError("Başlangıç tarihi zorunludur.");
  if (!Array.isArray(s.days) || s.days.length === 0) {
    throw new ValidationError("En az bir ders günü seçilmelidir.");
  }
  if (!(s.sessionHours > 0)) throw new ValidationError("Seans saati 0'dan büyük olmalıdır.");

  // Referans bütünlüğü (katalog repo'ları verilmişse).
  if (input.educationId && deps.educations) {
    const edu = await deps.educations.getById(input.educationId, actor.tenantId);
    if (!edu) throw new ValidationError("Seçilen eğitim bulunamadı.");
  }
  if (input.sectionId && deps.sections) {
    const section = await deps.sections.getById(input.sectionId, actor.tenantId);
    if (!section) throw new ValidationError("Seçilen bölüm bulunamadı.");
    if (input.educationId && section.educationId !== input.educationId) {
      throw new ValidationError("Seçilen bölüm, seçilen eğitime bağlı değil.");
    }
  }
  if (input.trackId && deps.tracks) {
    const track = await deps.tracks.getById(input.trackId, actor.tenantId);
    if (!track) throw new ValidationError("Seçilen track bulunamadı.");
    if (input.educationId && track.educationId !== input.educationId) {
      throw new ValidationError("Seçilen track, seçilen eğitime bağlı değil.");
    }
    if (input.sectionId && track.sectionId && track.sectionId !== input.sectionId) {
      throw new ValidationError("Seçilen track, seçilen bölüme bağlı değil.");
    }
  }

  const ts = nowISO();
  const group: Group = {
    id: deps.groups.nextId(),
    tenantId: actor.tenantId,
    code,
    sectionId: input.sectionId,
    trackId: input.trackId,
    educationId: input.educationId,
    branch: input.branch,
    status: input.status ?? "planned",
    type: input.type,
    // trainerId eğitmen kadrosu docId'sidir (actor.uid DEĞİL) — bkz. Actor.trainerId
    // yorumu. Kadroya kaydı olmayan eğitmen (actor.trainerId undefined) için actor.uid'e
    // düşülür (eski davranış) — kendi can()/liste sorgularıyla tutarlı kalır (ikisi de
    // aynı fallback'i kullanır).
    trainerId: input.trainerId ?? actor.trainerId ?? actor.uid,
    branchOfficeId: input.branchOfficeId,
    schedule: {
      startDate: s.startDate,
      days: s.days,
      sessionHours: s.sessionHours,
      startTime: s.startTime,
      endTime: s.endTime,
      endDate: s.endDate,
    },
    capacity: input.capacity,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await deps.groups.save(group);
  return group;
}

const VALID_STATUSES: GroupStatus[] = ["planned", "enrolling", "active", "postponed", "completed", "archived"];

/**
 * Grup yaşam-döngüsü durumunu günceller (Başlat/Bitir/İptal/Geri Al) — gated `group.edit`.
 * Sadece `status` alanını değiştirir; diğer alanlara dokunmaz.
 * `active`'e geçiş (Başlat) — grupta en az 1 aktif kayıt yoksa reddedilir (2026-07-10 kullanıcı
 * kararı: "içinde öğrenci olmayan gruba başlat dersem önce gruba öğrenci ekleyiniz diye uyar ve
 * açma"). `deps.enrollments` opsiyonel — verilmezse bu kontrol atlanır (geriye uyumlu).
 */
export async function updateGroupStatus(
  actor: Actor,
  groupId: EntityId,
  status: GroupStatus,
  deps: { groups: GroupRepo; enrollments?: EnrollmentRepo },
): Promise<Group> {
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError("Geçersiz grup durumu.");
  }

  const group = await deps.groups.getById(groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  // ownerUid: `groupIds` claim altyapısı yokken standalone eğitmen kendi grubunu (Group.trainerId) düzenleyebilsin.
  if (!can(actor, "group.edit", { groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("group.edit");
  }

  if (status === "active" && group.status !== "active" && deps.enrollments) {
    const enrollments = await deps.enrollments.listByGroup(groupId, actor.tenantId);
    const hasActiveStudent = enrollments.some((e) => e.status === "active");
    if (!hasActiveStudent) {
      throw new ValidationError("Önce gruba öğrenci ekleyiniz.");
    }
  }

  // Grup "tamamlandı"ya alınınca içindeki aktif kayıtlar OTOMATİK mezun olur — insan
  // eylemi (Bitir butonu) tetikliyor, tarih/cron bazlı otomatik mezuniyet YOK (o karar
  // hâlâ geçerli). 2026-07-11: kullanıcı canlı testte "Grup 296/330 bitmiş ama içindeki
  // kayıtlar hâlâ active görünüyor" bulgusuyla istedi — önceden bu adım UNUTULMUŞTU,
  // sadece "Mezun Et" ile TEK tek elle yapılıyordu (bkz. GRP-550, kullanıcı elle yaptı).
  if (status === "completed" && group.status !== "completed" && deps.enrollments) {
    const enrollments = await deps.enrollments.listByGroup(groupId, actor.tenantId);
    const ts = nowISO();
    await Promise.all(
      enrollments
        .filter((e) => e.status === "active")
        .map((e) => deps.enrollments!.save({ ...e, status: "completed", updatedAt: ts, updatedBy: actor.uid })),
    );
  }

  const updated: Group = { ...group, status, updatedAt: nowISO(), updatedBy: actor.uid };
  await deps.groups.save(updated);
  return updated;
}

/**
 * Grup sil — gated `group.delete`.
 * Genelde grup silinmez ama satışı az olan bir grup açılmadan/az doluyken iptal
 * edilebilir. Gruba bağlı kayıtlar SİLİNMEZ — cascade olarak grupsuz duruma
 * düşürülür (`groupId` boşalır, kayıt/durum aynen kalır). Kayıtta hiçbir geçmiş-grup
 * izi bırakılmaz (kullanıcı kararı 2026-07-09: bu grupta henüz ders/kayıt yoksa
 * yazılacak anlamlı bir geçmiş de yok).
 */
export async function deleteGroup(
  actor: Actor,
  groupId: EntityId,
  deps: { groups: GroupRepo; enrollments: EnrollmentRepo },
): Promise<void> {
  const group = await deps.groups.getById(groupId, actor.tenantId);
  if (!group) throw new ValidationError("Grup bulunamadı.");

  if (!can(actor, "group.delete", { groupId, ownerUid: group.trainerId })) {
    throw new ForbiddenError("group.delete");
  }

  const enrollments = await deps.enrollments.listByGroup(groupId, actor.tenantId);
  for (const enrollment of enrollments) {
    if (!enrollment.groupId) continue;
    await deps.enrollments.save({ ...enrollment, groupId: undefined, updatedAt: nowISO(), updatedBy: actor.uid });
  }

  await deps.groups.delete(groupId, actor.tenantId);
}
