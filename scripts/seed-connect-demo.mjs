/**
 * seed-connect-demo.mjs
 * Flex Connect'i Claude Design çıktısındaki (`_design/flex-connect/Flex Connect.dc.html`)
 * AYNI dummy verilerle doldurur — kullanıcı UI'ı gerçek içerikle görsel olarak kontrol
 * edebilsin diye (2026-07-18 isteği). SADECE `connect_conversations` (kendi koleksiyonu,
 * ödeve dokunmaz) + birkaç SAHTE personel hesabı (`flexos_users`, açıkça `seedTag`'lı,
 * `--clean` ile geri alınabilir) yazar.
 *
 * NOT: Sahte hesaplar (Elif Kaya/Mert Yılmaz/Naz Erdem/İK Ekibi) gerçek `flexos_users`
 * koleksiyonuna yazıldığı için CANLI "Kullanıcılar" sayfasında da görünürler — demo
 * bitince `--clean` ile temizlemen önerilir.
 *
 * Kullanım:
 *   node scripts/seed-connect-demo.mjs                # oluştur
 *   node scripts/seed-connect-demo.mjs --clean        # seed'i geri al
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SEED_TAG = "seed:connect-demo";
const clean = process.argv.includes("--clean");
const ADMIN_EMAIL = "alparslan.sennturk@gmail.com"; // VIEW_TOGGLE_OWNER_EMAIL, bkz. auth-actor.ts

async function detectTenant() {
  const snap = await db.collection("persons").limit(1).get();
  if (!snap.empty) return snap.docs[0].data().tenantId || "default";
  return "default";
}

async function removeOldSeed() {
  const convSnap = await db.collection("connect_conversations").where("seedTag", "==", SEED_TAG).get();
  for (const d of convSnap.docs) {
    const membersSnap = await d.ref.collection("members").get();
    for (const m of membersSnap.docs) await m.ref.delete();
    const msgsSnap = await d.ref.collection("messages").get();
    for (const m of msgsSnap.docs) await m.ref.delete();
    await d.ref.delete();
  }
  console.log(`  silindi: connect_conversations (${convSnap.size})`);

  const usersSnap = await db.collection("flexos_users").where("seedTag", "==", SEED_TAG).get();
  for (const d of usersSnap.docs) await d.ref.delete();
  console.log(`  silindi: flexos_users (${usersSnap.size})`);
}

async function findRealAdminUid(tenantId) {
  const byEmail = await db.collection("flexos_users").where("tenantId", "==", tenantId).where("email", "==", ADMIN_EMAIL).limit(1).get();
  if (!byEmail.empty && byEmail.docs[0].data().authUid) return byEmail.docs[0].data().authUid;
  const anyAdmin = await db.collection("flexos_users").where("tenantId", "==", tenantId).where("roles", "array-contains", "admin").limit(5).get();
  const withAuth = anyAdmin.docs.find((d) => d.data().authUid);
  return withAuth?.data().authUid ?? null;
}

async function main() {
  const tenantId = await detectTenant();
  console.log(`Kiracı: ${tenantId}`);

  if (clean) { console.log("Eski seed temizleniyor…"); await removeOldSeed(); return; }

  const adminUid = await findRealAdminUid(tenantId);
  if (!adminUid) {
    console.error("HATA: authUid'i olan bir admin (flexos_users) bulunamadı — önce gerçek bir admin hesabı oluşturulmalı.");
    process.exit(1);
  }
  console.log(`Gerçek admin uid: ${adminUid} (mesajlarda "Sen" olarak görünecek)`);

  const now = new Date();
  const nowTs = now.toISOString();
  const base = { tenantId, seedTag: SEED_TAG, createdAt: nowTs, createdBy: "seed-script" };

  // ── Sahte personel personaları (sadece isim/renk için — gerçek giriş yapamazlar) ──
  const PERSONAS = [
    { key: "elif", authUid: "seed-connect-elif-kaya", name: "Elif", surname: "Kaya", title: "Öğrenci İşleri" },
    { key: "mert", authUid: "seed-connect-mert-yilmaz", name: "Mert", surname: "Yılmaz", title: "Eğitim Operasyonu" },
    { key: "naz", authUid: "seed-connect-naz-erdem", name: "Naz", surname: "Erdem", title: "Sertifikasyon" },
    { key: "ik", authUid: "seed-connect-ik-ekibi", name: "İK", surname: "Ekibi", title: "İnsan Kaynakları" },
  ];
  for (const p of PERSONAS) {
    const ref = db.collection("flexos_users").doc();
    await ref.set({
      id: ref.id, ...base,
      name: p.name, surname: p.surname, email: `${p.key}@seed.flex`, gender: "unspecified",
      title: p.title, roles: ["admin"], subes: [], status: "aktif", authUid: p.authUid,
    });
  }
  const uid = Object.fromEntries(PERSONAS.map((p) => [p.key, p.authUid]));

  async function addMembers(convRef, entries) {
    for (const [memberUid, role] of entries) {
      await convRef.collection("members").doc(memberUid).set({
        uid: memberUid, realm: "trainer_student", role, joinedAt: nowTs, lastReadAt: nowTs,
      });
    }
  }
  async function addMessage(convRef, authorUid, text, when) {
    const ref = convRef.collection("messages").doc();
    await ref.set({ id: ref.id, authorUid, text, createdAt: when.toISOString() });
    return { text, senderUid: authorUid, at: when.toISOString() };
  }

  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(9, 12, 0, 0);
  const y2 = new Date(yesterday.getTime() + 60 * 1000);
  const y3 = new Date(yesterday.getTime() + 29 * 60 * 1000);
  const t1 = new Date(now); t1.setHours(13, 5, 0, 0);
  const t2 = new Date(now); t2.setHours(14, 20, 0, 0);
  const t3 = new Date(now); t3.setHours(14, 32, 0, 0);

  // ── "Kurum Duyuruları" — tasarımdaki THREAD birebir (mockup: _design/flex-connect/Flex Connect.dc.html) ──
  {
    const ref = db.collection("connect_conversations").doc();
    await ref.set({
      id: ref.id, ...base,
      realm: "trainer_student", type: "channel", name: "Kurum Duyuruları",
      description: "Kurum genelinde resmi duyurular.",
      writePolicy: "admins", admins: [adminUid, uid.elif, uid.mert], audience: "all_students",
      lastMessage: null, messageCount: 0, ownerUid: adminUid,
    });
    await addMembers(ref, [[adminUid, "owner"], [uid.elif, "admin"], [uid.mert, "admin"]]);
    await addMessage(ref, uid.elif, "Merhaba arkadaşlar, bu hafta duyurulacak birkaç önemli konu var. Sırayla paylaşıyorum.", yesterday);
    await addMessage(ref, uid.elif, "Yarın laboratuvar B-201 olarak değişmiştir. Ders saatlerinde herhangi bir değişiklik yoktur.", y2);
    await addMessage(ref, uid.mert, "Bilgilendirme için teşekkürler. Eğitmen ekibine ilettim.", y3);
    await addMessage(ref, uid.elif, "Ödev teslim tarihi öğrencilerimizin talebi üzerine 18 Temmuz Cuma 23.59'a uzatılmıştır.", t1);
    await addMessage(ref, uid.naz ? uid.naz : uid.mert, "Grafik Tasarım Full Paket sertifikaları hazırdır. Öğrenci işlerinden teslim alınabilir.", t2);
    const last = await addMessage(ref, adminUid, "Teşekkürler, listeyi eğitmenlerle paylaşacağım. Sertifika töreni tarihini de bugün netleştireceğiz.", t3);
    await ref.update({ lastMessage: last, messageCount: 6 });
    await ref.collection("members").doc(adminUid).update({ readMessageCount: 6 });
  }

  // ── Diğer 5 kanal — tasarımdaki CHANNELS listesi (liste önizlemesi dolsun diye tek mesaj) ──
  const OTHER_CHANNELS = [
    { name: "Öğrenci İşleri", desc: "Kayıt, devamsızlık ve öğrenci işlemleri.", persona: "elif", text: "Ödev teslim tarihi 18 Temmuz'a uzatılmıştır." },
    { name: "Genel Duyurular", desc: "Genel işletme duyuruları.", persona: null, text: "Yarın laboratuvar B-201 olarak değişmiştir." },
    { name: "Eğitim Operasyonu", desc: "Ders programı ve operasyon.", persona: "mert", text: "Haftalık ders programı güncellendi, kontrol ediniz." },
    { name: "Sertifikasyon", desc: "Sertifika süreçleri.", persona: "naz", text: "Sertifikalar hazırdır, öğrenci işlerinden teslim alınabilir." },
    { name: "Kariyer & İK", desc: "Staj ve kariyer fırsatları.", persona: "ik", text: "Yeni staj ilanları yayınlandı." },
  ];
  for (const c of OTHER_CHANNELS) {
    const ref = db.collection("connect_conversations").doc();
    const authorUid = c.persona ? uid[c.persona] : adminUid;
    await ref.set({
      id: ref.id, ...base,
      realm: "trainer_student", type: "channel", name: c.name, description: c.desc,
      writePolicy: "admins", admins: [adminUid, ...(c.persona ? [uid[c.persona]] : [])], audience: "all_students",
      lastMessage: null, messageCount: 0, ownerUid: adminUid,
    });
    await addMembers(ref, [[adminUid, "owner"], ...(c.persona ? [[uid[c.persona], "admin"]] : [])]);
    const msg = await addMessage(ref, authorUid, c.text, yesterday);
    await ref.update({ lastMessage: msg, messageCount: 1 });
    await ref.collection("members").doc(adminUid).update({ readMessageCount: authorUid === adminUid ? 1 : 0 });
  }

  console.log("\n✅ Seed tamam: 6 kanal (Kurum Duyuruları dolu geçmişle) + 4 sahte personel hesabı.");
  console.log("   → /flexos/connect sayfasını (gerçek admin hesabınla) aç, Kanallar sekmesi dolu gelmeli.");
  console.log("   Öğrenci hesabıyla da aynı 6 kanal audience köprüsüyle görünmeli (yazamaz, sadece okur).");
  console.log("   Temizlemek için: node scripts/seed-connect-demo.mjs --clean\n");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
