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

export const firestoreBranchRepo: BranchRepo = makeRepo<Branch>("flexos_branches");
export const firestoreEducationRepo: EducationRepo = makeRepo<Education>("flexos_educations");
export const firestoreTrackRepo: TrackRepo = makeRepo<Track>("flexos_tracks");
