import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type {
  RtdbCollageItems,
  RtdbBookCovers,
  RtdbSmBrand,
  RtdbSmSector,
  RtdbSmFormat,
  CollageItem,
  BookItem,
  SMBrand,
  SMSector,
  SMFormat,
  MigrationResult,
} from "../../types/assignmentMigration.types";

const RTDB_BASE =
  "https://grafik-tasarim-portali-default-rtdb.europe-west1.firebasedatabase.app";

async function fetchRtdb<T>(path: string): Promise<T> {
  const url = `${RTDB_BASE}/${path}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`RTDB fetch hatası [${res.status}]: ${path}`);
  }
  const data = await res.json();
  if (data === null) {
    throw new Error(`RTDB verisi bulunamadı: ${path}`);
  }
  return data as T;
}

// ─── 1. KOLAJ BAHÇESI ──────────────────────────────────────────────────────

function parseCollageItems(raw: RtdbCollageItems): CollageItem[] {
  const items: CollageItem[] = [];

  for (const [category, catValue] of Object.entries(raw)) {
    if (typeof catValue !== "object" || catValue === null) continue;

    const catObj = catValue as Record<string, unknown>;

    for (const [itemKey, itemValue] of Object.entries(catObj)) {
      if (typeof itemValue === "string") {
        // Yapı: { "Gök": { "-pushId": "İsim" } }
        items.push({ id: itemKey, name: itemValue, category, color: "", emoji: "" });
      } else if (typeof itemValue === "object" && itemValue !== null) {
        // Yapı: { "Gök": { "-pushId": { name, color, emoji } } }
        const item = itemValue as Record<string, unknown>;
        items.push({
          id: itemKey,
          name: String(item.name ?? ""),
          category,
          color: String(item.color ?? ""),
          emoji: String(item.emoji ?? ""),
        });
      }
    }
  }

  return items;
}

export async function migrateCollage(): Promise<MigrationResult> {
  try {
    const raw = await fetchRtdb<RtdbCollageItems>("assignments/collageItems");
    const items = parseCollageItems(raw);

    await setDoc(doc(db, "lottery_configs", "collage"), {
      id: "lottery_collage",
      assignmentId: "task_collage",
      assignmentName: "Kolaj Bahçesi",
      items,
      templateType: "wheel",
      createdAt: serverTimestamp(),
    });

    console.log(`✅ Kolaj (${items.length} item) migrated`);
    return { success: true, message: `Kolaj migrated`, count: items.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("❌ Kolaj migration hatası:", error);
    return { success: false, message: "Kolaj migration başarısız", error };
  }
}

// ─── 2. KİTAP ──────────────────────────────────────────────────────────────

function parseBookItems(raw: RtdbBookCovers): BookItem[] {
  return Object.entries(raw).map(([key, val]) => ({
    id: key,
    bookId: String(val.bookId ?? key),
    title: String(val.title ?? ""),
    author: String(val.author ?? ""),
    genre: String(val.genre ?? ""),
    subGenre: String(val.subGenre ?? ""),
    isbn: String(val.isbn ?? ""),
    publisher: String(val.publisher ?? ""),
    pageCount: String(val.pageCount ?? ""),
    dimensions: String(val.dimensions ?? ""),
    backCover: String(val.backCover ?? ""),
  }));
}

export async function migrateBook(): Promise<MigrationResult> {
  try {
    const raw = await fetchRtdb<RtdbBookCovers>("assignments/bookCovers");
    const items = parseBookItems(raw);

    await setDoc(doc(db, "lottery_configs", "book"), {
      id: "lottery_book",
      assignmentId: "task_book",
      assignmentName: "Kitap Seçimi",
      items,
      templateType: "deck",
      createdAt: serverTimestamp(),
    });

    console.log(`✅ Kitap (${items.length} item) migrated`);
    return { success: true, message: `Kitap migrated`, count: items.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("❌ Kitap migration hatası:", error);
    return { success: false, message: "Kitap migration başarısız", error };
  }
}

// ─── 3. SOSYAL MEDYA ───────────────────────────────────────────────────────

function parseBrands(raw: Record<string, RtdbSmBrand>): SMBrand[] {
  return Object.values(raw).map((val) => {
    let purposes: string[] = [];
    if (Array.isArray(val.purposes)) {
      purposes = val.purposes;
    } else if (val.purposes && typeof val.purposes === "object") {
      // { "custom_id": { name: "..." } } veya { "custom_id": "..." }
      purposes = Object.values(val.purposes as Record<string, unknown>)
        .map((p) => {
          if (typeof p === "string") return p;
          if (p && typeof p === "object" && "name" in (p as object))
            return String((p as { name?: string }).name ?? "");
          return "";
        })
        .filter(Boolean);
    }
    return {
      brandName: String(val.brandName ?? ""),
      brandRule: String(val.brandRule ?? ""),
      mainSector: String(val.mainSector ?? ""),
      subSector: String(val.subSector ?? ""),
      purposes,
    };
  });
}

function parseSectors(raw: Record<string, RtdbSmSector>): SMSector[] {
  return Object.values(raw)
    .filter((val) => val && typeof val === "object")
    .map((val) => ({
      name: String((val as Record<string, unknown>).name ?? val.mainSector ?? ""),
    }))
    .filter((s) => s.name);
}

function parseFormats(raw: Record<string, RtdbSmFormat>): SMFormat[] {
  return Object.values(raw).map((val) => ({
    dim: String(val.dim ?? ""),
    type: String(val.type ?? ""),
    platform: String(val.platform ?? ""),
  }));
}

export async function migrateSocialMedia(): Promise<MigrationResult> {
  try {
    const [brandsRaw, sectorsRaw, formatsRaw, sharedRuleRaw] =
      await Promise.all([
        fetchRtdb<Record<string, RtdbSmBrand>>("assignments/smBrands"),
        fetchRtdb<Record<string, RtdbSmSector>>("assignments/smSectorsNew"),
        fetchRtdb<Record<string, RtdbSmFormat>>("assignments/smFormats"),
        fetchRtdb<string | Record<string, string>>(
          "assignments/smSharedRule"
        ),
      ]);

    const brands = parseBrands(brandsRaw);
    const sectors = parseSectors(sectorsRaw);
    const formats = parseFormats(formatsRaw);

    let sharedRule = "";
    if (typeof sharedRuleRaw === "string") {
      sharedRule = sharedRuleRaw;
    } else if (sharedRuleRaw && typeof sharedRuleRaw === "object") {
      sharedRule =
        Object.values(sharedRuleRaw).join(" ") ||
        JSON.stringify(sharedRuleRaw);
    }

    await setDoc(doc(db, "lottery_configs", "socialMedia"), {
      id: "lottery_sm",
      assignmentId: "task_sm",
      assignmentName: "Sosyal Medya",
      brands,
      sectors,
      formats,
      sharedRule,
      templateType: "grid",
      createdAt: serverTimestamp(),
    });

    const total = brands.length + sectors.length + formats.length;
    console.log(
      `✅ Sosyal Medya migrated — ${brands.length} marka, ${sectors.length} sektör, ${formats.length} format`
    );
    return {
      success: true,
      message: `Sosyal Medya migrated`,
      count: total,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("❌ Sosyal Medya migration hatası:", error);
    return {
      success: false,
      message: "Sosyal Medya migration başarısız",
      error,
    };
  }
}

// ─── Hepsini çalıştır ──────────────────────────────────────────────────────

export async function migrateAll(
  onProgress?: (phase: string, result: MigrationResult) => void
) {
  const collage = await migrateCollage();
  onProgress?.("collage", collage);

  const book = await migrateBook();
  onProgress?.("book", book);

  const socialMedia = await migrateSocialMedia();
  onProgress?.("socialMedia", socialMedia);

  return { collage, book, socialMedia };
}
