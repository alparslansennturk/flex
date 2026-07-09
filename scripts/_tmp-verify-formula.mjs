import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";
const serviceAccount = JSON.parse(readFileSync(resolve("service-account.json"), "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TARGET_GROUPS = {
  "541": "4Lib4kA3YvTIqNQ5M2VD",
  "550": "i6OxhplzHS3BBv9BwdDK",
  "598": "8Hisru9CH1rqpCI5zRA2",
};

for (const [code, gid] of Object.entries(TARGET_GROUPS)) {
  const snap = await db.collection("projectGrades").where("groupId", "==", gid).get();
  console.log(`\n=== Grup ${code} ===`);
  for (const d of snap.docs) {
    const g = d.data();
    let derived = null;
    if (typeof g.finalNote === "number" && typeof g.projectScore === "number") {
      derived = Math.round((g.finalNote - 0.7 * g.projectScore) / 0.3);
    }
    console.log(`  ${g.studentName} (${g.module}): odevPuani=${g.odevPuani}, projectScore=${g.projectScore}, finalNote=${g.finalNote} -> türetilen odev%=${derived}`);
  }
}
