/**
 * GEÇİCİ TEŞHIS (2026-07-13, final test) — her HTTP isteğinin kaç Firestore dokümanı
 * OKUDUĞUNU ölçer. `adminDb`'nin GERÇEK prototip zincirinden (Turbopack modül
 * kopyalamasından etkilenmeden) `Query`/`CollectionReference`/`DocumentReference`/
 * `Firestore` sınıflarını sarmalar. Analiz bitince BU DOSYA + with-auth'taki 3 satır
 * SİLİNECEK. Sadece dev'de aktif.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync } from "node:fs";
import { adminDb } from "../firebase-admin";

interface AuditStore {
  reads: number;
  breakdown: Record<string, number>;
}

const LOG_FILE =
  "/private/tmp/claude-501/-Users-alparslansenturk-Desktop-Alp-Yaz-l-m-Proje-flex/dda771e2-6e80-4c69-be06-7a7cf4c577df/scratchpad/read-audit-final.log";

export const readAuditStore = new AsyncLocalStorage<AuditStore>();

function bump(collection: string, n: number): void {
  const store = readAuditStore.getStore();
  if (!store || n <= 0) return;
  store.reads += n;
  store.breakdown[collection] = (store.breakdown[collection] ?? 0) + n;
}

let installed = false;

export function installReadAudit(): void {
  if (installed) return;
  installed = true;
  try {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const probeCol = (adminDb as any).collection("_audit_probe");
    const CollectionProto = Object.getPrototypeOf(probeCol);
    const QueryProto = Object.getPrototypeOf(CollectionProto);
    const DocProto = Object.getPrototypeOf(probeCol.doc("_p"));
    const FirestoreProto = Object.getPrototypeOf(adminDb);

    for (const proto of [QueryProto, CollectionProto]) {
      if (proto && Object.prototype.hasOwnProperty.call(proto, "get") && !proto.__auditPatched) {
        const orig = proto.get;
        proto.get = async function patchedGet(this: any, ...args: any[]) {
          const snap = await orig.apply(this, args);
          const coll = this?._queryOptions?.collectionId ?? this?._queryOptions?.parentPath?.id ?? this?.id ?? "query";
          bump(String(coll), snap?.size ?? 0);
          return snap;
        };
        proto.__auditPatched = true;
      }
    }

    if (DocProto && !DocProto.__auditPatched) {
      const orig = DocProto.get;
      DocProto.get = async function patchedDocGet(this: any, ...args: any[]) {
        const snap = await orig.apply(this, args);
        bump(String(this?.parent?.id ?? "doc"), 1);
        return snap;
      };
      DocProto.__auditPatched = true;
    }

    if (FirestoreProto && !FirestoreProto.__auditPatched && typeof FirestoreProto.getAll === "function") {
      const orig = FirestoreProto.getAll;
      FirestoreProto.getAll = async function patchedGetAll(this: any, ...args: any[]) {
        const docs = await orig.apply(this, args);
        bump("getAll", Array.isArray(docs) ? docs.length : 0);
        return docs;
      };
      FirestoreProto.__auditPatched = true;
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    // patch başarısızsa sessiz
  }
}

export async function auditRequest<T>(method: string, path: string, fn: () => Promise<T>): Promise<T> {
  const store: AuditStore = { reads: 0, breakdown: {} };
  const started = Date.now();
  try {
    return await readAuditStore.run(store, fn);
  } finally {
    const ms = Date.now() - started;
    try {
      appendFileSync(
        LOG_FILE,
        `${new Date().toISOString()} ${method} ${path} reads=${store.reads} ${JSON.stringify(store.breakdown)} ${ms}ms\n`,
      );
    } catch {
      /* yut */
    }
  }
}
