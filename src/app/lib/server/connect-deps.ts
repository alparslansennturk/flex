import { firestoreConnectRepo } from "./connect-repo.firestore";
import { firestorePersonRepo } from "./person-repo.firestore";
import { firestoreFlexosUserRepo } from "./flexos-user-repo.firestore";
import { firestoreConnectAuditRepo } from "./connect-audit-repo.firestore";
import { firestoreEnrollmentRepo } from "./enrollment-repo.firestore";
import { firestoreGroupRepo } from "./group-repo.firestore";
import { firestoreTrainerRepo } from "./trainer-repo.firestore";
import type { ConnectDeps } from "../domain/services/connect-service";

/** Tüm Connect route'larının paylaştığı servis bağımlılıkları — tek yerde. */
export const connectDeps: ConnectDeps = {
  conversations: firestoreConnectRepo,
  persons: firestorePersonRepo,
  flexosUsers: firestoreFlexosUserRepo,
  auditLog: firestoreConnectAuditRepo,
  enrollments: firestoreEnrollmentRepo,
  groups: firestoreGroupRepo,
  trainers: firestoreTrainerRepo,
};
