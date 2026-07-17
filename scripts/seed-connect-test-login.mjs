/**
 * seed-connect-test-login.mjs
 * Flex Connect'in gerçek presence (yazıyor) özelliğini test etmek için GERÇEK giriş
 * yapabilen ikinci bir test hesabı oluşturur — sahte seed personaları (Elif Kaya vb.)
 * gerçek login yapamıyor, bu yüzden bu ayrı, gerçek bir Firebase Auth hesabı.
 *
 * "Kurum Duyuruları" kanalına admin olarak eklenir (o kanal admin-only olduğu için
 * yazabilmesi lazım). Gizli pencerede bu hesapla giriş yapıp o kanalda yazarken,
 * ana hesabınla (admin) aynı kanalı açık tutarsan "X yazıyor…" gerçek olarak görünür.
 *
 * Kullanım:
 *   node scripts/seed-connect-test-login.mjs
 *   node scripts/seed-connect-test-login.mjs --clean
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const clean = process.argv.includes("--clean");
const TEST_EMAIL = "connect.test@flex.local";
const TEST_PASSWORD = "ConnectTest123!";
const SEED_TAG = "seed:connect-test-login";

async function detectTenant() {
  const snap = await db.collection("persons").limit(1).get();
  if (!snap.empty) return snap.docs[0].data().tenantId || "default";
  return "default";
}

async function main() {
  const tenantId = await detectTenant();

  if (clean) {
    const existing = await auth.getUserByEmail(TEST_EMAIL).catch(() => null);
    if (existing) {
      await auth.deleteUser(existing.uid);
      console.log(`Firebase Auth hesabı silindi: ${existing.uid}`);
    }
    const usersSnap = await db.collection("flexos_users").where("seedTag", "==", SEED_TAG).get();
    for (const d of usersSnap.docs) await d.ref.delete();
    console.log(`flexos_users silindi: ${usersSnap.size}`);
    if (existing) {
      const convSnap = await db.collection("connect_conversations").where("name", "==", "Kurum Duyuruları").get();
      for (const d of convSnap.docs) {
        await d.ref.collection("members").doc(existing.uid).delete().catch(() => {});
        const data = d.data();
        const admins = (data.admins ?? []).filter((a) => a !== existing.uid);
        await d.ref.update({ admins });
      }
      console.log("Kurum Duyuruları üyelik/admin kaydı temizlendi.");
    }
    return;
  }

  let user = await auth.getUserByEmail(TEST_EMAIL).catch(() => null);
  if (!user) {
    user = await auth.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD, displayName: "Connect Test" });
    console.log(`Firebase Auth hesabı oluşturuldu: ${user.uid}`);
  } else {
    await auth.updateUser(user.uid, { password: TEST_PASSWORD });
    console.log(`Firebase Auth hesabı zaten vardı, şifre sıfırlandı: ${user.uid}`);
  }

  const existingDoc = await db.collection("flexos_users").where("authUid", "==", user.uid).limit(1).get();
  if (existingDoc.empty) {
    const ref = db.collection("flexos_users").doc();
    await ref.set({
      id: ref.id, tenantId, seedTag: SEED_TAG,
      name: "Connect", surname: "Test", email: TEST_EMAIL, gender: "unspecified",
      roles: ["admin"], subes: [], status: "aktif", authUid: user.uid,
      createdAt: new Date().toISOString(), createdBy: "seed-script",
    });
  }

  const convSnap = await db.collection("connect_conversations").where("name", "==", "Kurum Duyuruları").get();
  for (const d of convSnap.docs) {
    const data = d.data();
    if (!(data.admins ?? []).includes(user.uid)) {
      await d.ref.update({ admins: [...(data.admins ?? []), user.uid] });
    }
    await d.ref.collection("members").doc(user.uid).set({
      uid: user.uid, realm: "trainer_student", role: "admin", joinedAt: new Date().toISOString(),
    });
  }

  console.log("\n✅ Test hesabı hazır:");
  console.log(`   E-posta: ${TEST_EMAIL}`);
  console.log(`   Şifre:   ${TEST_PASSWORD}`);
  console.log("   Gizli pencerede /flexos/giris üzerinden bu bilgilerle giriş yap,");
  console.log("   Kurum Duyuruları'nı aç ve yaz — ana hesabında gerçek 'yazıyor' göstergesini göreceksin.");
  console.log("   Silmek için: node scripts/seed-connect-test-login.mjs --clean\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
