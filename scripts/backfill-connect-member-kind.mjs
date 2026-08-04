/**
 * backfill-connect-member-kind.mjs
 *
 * Flex Connect `connect_conversations/{id}/members/{uid}` dokümanlarına `kind`
 * alanını ("staff" | "student") ekler — rol bazlı okundu-tiki güvenliği için
 * (2026-08-04 kullanıcı kararı, bkz. `firestore.rules::isConnectStaffMember` +
 * `domain/core/connect.ts::ConnectMember.kind`). Firestore Security Rules bu
 * alan set edilmeden kısıtlamayı UYGULAMAZ (eski davranış korunur) — bu script
 * ÇALIŞMADAN yeni kural pratikte hiçbir şeyi engellemez, sadece ileriye dönük
 * bir güvenlik ağı kurar.
 *
 * GÜVENLİ / GERİ ALINABİLİR:
 *  - SADECE EKLER: her üye dokümanına TEK bir alan (`kind`) `update()` eder,
 *    başka hiçbir alana dokunmaz, hiçbir dokümanı SİLMEZ/değiştirmez.
 *  - İDEMPOTENT: `kind` zaten set edilmiş dokümanlar atlanır — tekrar tekrar
 *    çalıştırmak güvenli (ör. yeni bir konuşma bu script'ten SONRA ama kod
 *    deploy'undan ÖNCE oluşmuşsa, tekrar çalıştırmak onu da yakalar).
 *  - GERİ ALMA: `node scripts/backfill-connect-member-kind.mjs --revert` her
 *    dokümandan SADECE `kind` alanını siler (FieldValue.delete()), başka bir şey
 *    değişmez — rules otomatik olarak eski (kısıtlamasız) haline döner.
 *  - Çözülemeyen (ne `persons` ne `flexos_users`'ta authUid eşleşmesi olan,
 *    muhtemelen silinmiş/orphan hesap) uid'ler ATLANIR, TAHMİN EDİLMEZ — script
 *    sonunda ayrıca listelenir, manuel incelemeye bırakılır.
 *
 * Kullanım:
 *   node scripts/backfill-connect-member-kind.mjs --dry-run   # sadece sayaç/log, yazma yok (ÖNCE BUNU ÇALIŞTIR)
 *   node scripts/backfill-connect-member-kind.mjs             # gerçek yazma
 *   node scripts/backfill-connect-member-kind.mjs --revert    # `kind` alanını geri siler (acil durum)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DRY_RUN = process.argv.includes("--dry-run");
const REVERT = process.argv.includes("--revert");
const TENANT_ID = "default";
const CHUNK_SIZE = 20;

async function chunkedWrite(items, fn) {
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    await Promise.all(items.slice(i, i + CHUNK_SIZE).map(fn));
  }
}

async function main() {
  console.log(REVERT ? "=== GERİ ALMA (kind alanı siliniyor) ===" : DRY_RUN ? "=== DRY RUN (yazma yok) ===" : "=== GERÇEK ÇALIŞTIRMA ===");

  // `resolveUidKind` (connect-helpers.ts) ile AYNI öncelik: önce `persons`
  // (student), sonra `flexos_users` (staff). N tekil sorgu yerine iki koleksiyon
  // TEK seferde belleğe alınıyor — institution ölçeğinde ucuz, N+1'den çok daha hızlı.
  const [personsSnap, usersSnap] = await Promise.all([
    db.collection("persons").where("tenantId", "==", TENANT_ID).get(),
    db.collection("flexos_users").where("tenantId", "==", TENANT_ID).get(),
  ]);
  const studentAuthUids = new Set(personsSnap.docs.map((d) => d.data().authUid).filter(Boolean));
  const staffAuthUids = new Set(usersSnap.docs.map((d) => d.data().authUid).filter(Boolean));
  console.log(`persons (authUid'li): ${studentAuthUids.size} | flexos_users (authUid'li): ${staffAuthUids.size}`);

  function resolveKind(uid) {
    if (studentAuthUids.has(uid)) return "student";
    if (staffAuthUids.has(uid)) return "staff";
    return "unknown";
  }

  const conversationRefs = await db.collection("connect_conversations").listDocuments();
  console.log(`Toplam konuşma: ${conversationRefs.length}\n`);

  let totalMembers = 0;
  let alreadySet = 0;
  let newlyStaff = 0;
  let newlyStudent = 0;
  let reverted = 0;
  const unresolved = [];

  for (const convRef of conversationRefs) {
    const membersSnap = await convRef.collection("members").get();
    const toWrite = [];

    for (const memberDoc of membersSnap.docs) {
      totalMembers++;
      const data = memberDoc.data();

      if (REVERT) {
        if (data.kind !== undefined) toWrite.push({ ref: memberDoc.ref, patch: { kind: FieldValue.delete() } });
        continue;
      }

      if (data.kind === "staff" || data.kind === "student") {
        alreadySet++;
        continue;
      }
      const uid = memberDoc.id;
      const kind = resolveKind(uid);
      if (kind === "unknown") {
        unresolved.push({ conversationId: convRef.id, uid });
        continue;
      }
      if (kind === "staff") newlyStaff++; else newlyStudent++;
      toWrite.push({ ref: memberDoc.ref, patch: { kind } });
    }

    if (!DRY_RUN && toWrite.length > 0) {
      await chunkedWrite(toWrite, ({ ref, patch }) => ref.update(patch));
    }
    if (REVERT) reverted += toWrite.length;
  }

  console.log(`Taranan üye dokümanı: ${totalMembers}`);
  if (REVERT) {
    console.log(`${DRY_RUN ? "Silinecek" : "Silinen"} kind alanı: ${reverted}`);
  } else {
    console.log(`Zaten set edilmişti (atlandı): ${alreadySet}`);
    console.log(`${DRY_RUN ? "Set edilecek" : "Set edildi"} → staff: ${newlyStaff}`);
    console.log(`${DRY_RUN ? "Set edilecek" : "Set edildi"} → student: ${newlyStudent}`);
    if (unresolved.length > 0) {
      console.log(`\n⚠️  Çözülemeyen (persons/flexos_users'ta authUid eşleşmesi yok) — ${unresolved.length} adet, kind SET EDİLMEDİ:`);
      unresolved.forEach((u) => console.log(`   conversationId=${u.conversationId} uid=${u.uid}`));
    }
  }
  console.log(DRY_RUN ? "\nDry-run bitti, hiçbir şey yazılmadı." : "\nTamamlandı.");
}

main().catch((e) => {
  console.error("Hata:", e);
  process.exit(1);
});
