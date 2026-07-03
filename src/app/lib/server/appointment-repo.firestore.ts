import { adminDb } from "../firebase-admin";
import type { Appointment } from "../domain/crm/appointment";
import type { AppointmentRepo } from "../domain/repo/appointment-repo";

const COLLECTION = "flexos_appointments";

function clean<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export const firestoreAppointmentRepo: AppointmentRepo = {
  nextId() {
    return adminDb.collection(COLLECTION).doc().id;
  },

  async save(a) {
    await adminDb.collection(COLLECTION).doc(a.id).set(clean(a));
  },

  async getById(id, tenantId) {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Appointment;
    if (data.tenantId !== tenantId) return null;
    return data;
  },

  async listByCase(caseId, tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("caseId", "==", caseId)
      .get();
    return snap.docs.map((d) => d.data() as Appointment);
  },

  async list(tenantId) {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();
    return snap.docs
      .map((d) => d.data() as Appointment)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  },
};
