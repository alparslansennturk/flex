// Firestore "in" sorgusu en fazla 30 değer kabul eder. Bu dosya, org-genelinde
// hedefli-join (persons pagination, 2026-08-05) için repo katmanında tekrarlanan
// 30'luk chunk + paralel-sorgu + tenantId filtreleme desenini tek yerde toplar
// (2026-08-05 /code-review bulgusu — 6 repo dosyasında birebir aynı kod tekrarlanıyordu).
import { adminDb } from "../firebase-admin";
import { FieldPath } from "firebase-admin/firestore";

const CHUNK_SIZE = 30;

function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** `__name__` (document id) üzerinden çoklu-id sorgusu — `getByIds` implementasyonları için. */
export async function getDocsByIds<T extends { tenantId: string }>(
  collection: string,
  ids: string[],
  tenantId: string,
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  const results = await Promise.all(
    chunk(uniqueIds).map((c) => adminDb.collection(collection).where(FieldPath.documentId(), "in", c).get()),
  );
  return results.flatMap((snap) => snap.docs.map((d) => d.data() as T)).filter((doc) => doc.tenantId === tenantId);
}

/** Belirli bir alan (ör. `personId`) üzerinden çoklu-değer sorgusu — `listByPersonIds` implementasyonları için. */
export async function listDocsByFieldIn<T>(
  collection: string,
  field: string,
  tenantId: string,
  values: string[],
): Promise<T[]> {
  const uniqueValues = [...new Set(values)];
  if (uniqueValues.length === 0) return [];
  const results = await Promise.all(
    chunk(uniqueValues).map((c) =>
      adminDb.collection(collection).where("tenantId", "==", tenantId).where(field, "in", c).get(),
    ),
  );
  return results.flatMap((snap) => snap.docs.map((d) => d.data() as T));
}
