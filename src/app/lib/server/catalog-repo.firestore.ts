// NOT: Sadece server-side (firebase-admin). Katalog yeni koleksiyonlar (flexos_*).
import { adminDb } from "../firebase-admin";
import type { Branch } from "../domain/eduos/branch";
import type { Education } from "../domain/eduos/education";
import type { Track } from "../domain/eduos/track";
import type { BranchRepo, EducationRepo, TrackRepo } from "../domain/repo/catalog-repo";

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
  return snap.docs.map((d) => d.data() as T);
}

const branchBase = makeRepo<Branch>("flexos_branches");
const eduBase = makeRepo<Education>("flexos_educations");
const trackBase = makeRepo<Track>("flexos_tracks");

export const firestoreBranchRepo: BranchRepo = {
  ...branchBase,
  list: (tenantId) => listColl<Branch>("flexos_branches", tenantId),
};
export const firestoreEducationRepo: EducationRepo = {
  ...eduBase,
  list: (tenantId, branchId) => listColl<Education>("flexos_educations", tenantId, "branchId", branchId),
};
export const firestoreTrackRepo: TrackRepo = {
  ...trackBase,
  list: (tenantId, educationId) => listColl<Track>("flexos_tracks", tenantId, "educationId", educationId),
};
