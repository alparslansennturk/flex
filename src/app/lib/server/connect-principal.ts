// NOT: Sadece server-side import edilmeli (firebase-admin client'ta çalışmaz).
import { NextRequest } from "next/server";
import type { Caller } from "../with-auth";
import { actorFromCaller, DEFAULT_TENANT } from "./auth-actor";
import { firestorePersonRepo } from "./person-repo.firestore";
import type { ConnectPrincipal } from "../domain/services/connect-service";

/**
 * Personel çağıranı çözer — `/api/flexos/connect/*` (staff route ailesi).
 *
 * KRİTİK: `flexos_users` koleksiyonu personel VE öğrenci giriş hesaplarını AYNI
 * yerde tutuyor (`provisionStudentLogin`, `roles:["ogrenci"]`) — bir öğrencinin de
 * `actorFromCaller` çağırıp (grants=[] ile) "staff" gibi görünmesi mümkün. Bu yüzden
 * asıl kanıt `persons` koleksiyonunda bu uid'e ait bir kayıt OLMAMASI: varsa bu
 * kesin bir öğrencidir, staff route'una ASLA giremez (öğrenci `staff` realm'i hiçbir
 * koşulda görmemeli — FLEX_CONNECT.md §1).
 */
export async function staffPrincipalFromCaller(caller: Caller): Promise<ConnectPrincipal | null> {
  const person = await firestorePersonRepo.findByAuthUid(caller.uid, DEFAULT_TENANT);
  if (person) return null; // bu bir öğrenci — staff principal OLAMAZ
  const actor = await actorFromCaller(caller);
  return { tenantId: actor.tenantId, uid: actor.uid, kind: "staff", trainerId: actor.trainerId };
}

/**
 * Öğrenci çağıranı çözer — `/api/flexos/student/connect/*`. Diğer öğrenci
 * route'larıyla (`student/me/route.ts`) AYNI desen: `personId` query param'ı +
 * `Person.authUid === caller.uid` eşleşmesi. Actor/capability sistemi DEVREYE GİRMEZ.
 */
export async function studentPrincipalFromRequest(req: NextRequest, caller: Caller): Promise<ConnectPrincipal | null> {
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return null;
  const person = await firestorePersonRepo.getById(personId, DEFAULT_TENANT);
  if (!person || person.authUid !== caller.uid) return null;
  return { tenantId: DEFAULT_TENANT, uid: caller.uid, kind: "student", personId };
}
