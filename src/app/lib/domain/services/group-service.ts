import { can } from "../access/can";
import type { Actor } from "../access/types";
import type { EntityId, ISODateTime } from "../base";
import type { Group, GroupSchedule, GroupStatus, GroupType } from "../core/group";
import { ForbiddenError, ValidationError } from "../errors";
import type { EducationRepo, TrackRepo } from "../repo/catalog-repo";
import type { GroupRepo } from "../repo/group-repo";

export interface CreateGroupInput {
  code: string;
  type: GroupType;
  schedule: GroupSchedule;
  trackId?: EntityId; // grubun işlediği Track (Temel Photoshop)
  educationId?: EntityId; // bağlı eğitim (Grafik-1)
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
  if (input.trackId && deps.tracks) {
    const track = await deps.tracks.getById(input.trackId, actor.tenantId);
    if (!track) throw new ValidationError("Seçilen track bulunamadı.");
    if (input.educationId && track.educationId !== input.educationId) {
      throw new ValidationError("Seçilen track, seçilen eğitime bağlı değil.");
    }
  }

  const ts = nowISO();
  const group: Group = {
    id: deps.groups.nextId(),
    tenantId: actor.tenantId,
    code,
    trackId: input.trackId,
    educationId: input.educationId,
    branch: input.branch,
    status: input.status ?? "planned",
    type: input.type,
    trainerId: input.trainerId ?? actor.uid,
    branchOfficeId: input.branchOfficeId,
    schedule: {
      startDate: s.startDate,
      days: s.days,
      sessionHours: s.sessionHours,
      endDate: s.endDate,
    },
    capacity: input.capacity,
    createdAt: ts,
    createdBy: actor.uid,
  };

  await deps.groups.save(group);
  return group;
}
