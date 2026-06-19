// NOT: Sadece server-side (firebase-admin). Katalog yeni koleksiyonlar (flexos_*).
import { adminDb } from "../firebase-admin";
import type { Branch } from "../domain/eduos/branch";
import type { Education } from "../domain/eduos/education";
import type { Section } from "../domain/eduos/section";
import type { Track } from "../domain/eduos/track";
import type { BranchRepo, EducationRepo, SectionRepo, TrackRepo } from "../domain/repo/catalog-repo";

const clean = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

function makeRepo<T extends { id: string; tenantId: string }>(collection: string) {
  return {
    nextId: () => adminDb.collection(collection).doc().id,
    async save(doc: T) {
      await adminDb.collection(collection).doc(doc.id).set(clean(doc));
    },
    async getById(id: string, tenantId: string): Promise<T | null> {
      const snap = await adminDb.collection(collection).doc(id).get();
      if (!snap.exists) return null;
      const data = snap.data() as T;
      return data.tenantId === tenantId ? data : null;
    },
  };
}

async function listColl<T>(collection: string, tenantId: string, field?: string, value?: string): Promise<T[]> {
  let q = adminDb.collection(collection).where("tenantId", "==", tenantId);
  if (field && value) q = q.where(field, "==", value);
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as T).sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
}

const branchBase = makeRepo<Branch>("flexos_branches");
const eduBase = makeRepo<Education>("flexos_educations");
const sectionBase = makeRepo<Section>("flexos_sections");
const trackBase = makeRepo<Track>("flexos_tracks");

export const firestoreBranchRepo: BranchRepo = {
  ...branchBase,
  list: (tenantId) => listColl<Branch>("flexos_branches", tenantId),
};
export const firestoreEducationRepo: EducationRepo = {
  ...eduBase,
  list: (tenantId, branchId) => listColl<Education>("flexos_educations", tenantId, "branchId", branchId),
  async delete(id, tenantId) {
    const snap = await adminDb.collection("flexos_educations").doc(id).get();
    if (!snap.exists) return false;
    const data = snap.data() as Education;
    if (data.tenantId !== tenantId) return false;
    await adminDb.collection("flexos_educations").doc(id).delete();
    return true;
  },
};
async function deleteColl(collection: string, tenantId: string, field: string, value: string): Promise<number> {
  const snap = await adminDb.collection(collection).where("tenantId", "==", tenantId).where(field, "==", value).get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export const firestoreSectionRepo: SectionRepo = {
  ...sectionBase,
  list: (tenantId, educationId) => listColl<Section>("flexos_sections", tenantId, "educationId", educationId),
  deleteByEducation: (educationId, tenantId) => deleteColl("flexos_sections", tenantId, "educationId", educationId),
};
export const firestoreTrackRepo: TrackRepo = {
  ...trackBase,
  list: (tenantId, educationId) => listColl<Track>("flexos_tracks", tenantId, "educationId", educationId),
  deleteByEducation: (educationId, tenantId) => deleteColl("flexos_tracks", tenantId, "educationId", educationId),
};
