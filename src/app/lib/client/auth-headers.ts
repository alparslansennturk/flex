import { auth } from "@/app/lib/firebase";

/**
 * 56 dosyada birebir aynı şekilde kopyalanmış yardımcı — Firebase ID token'ını
 * Authorization header'ına çevirir. Client tarafı `fetch()` çağrılarının
 * neredeyse tamamı bunu kullanıyordu, her dosyada ayrı ayrı tanımlanmış hâldeydi.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : "";
  return { Authorization: `Bearer ${token}` };
}

/** Body gönderen (POST/PATCH) çağrılarda kullanılan, Content-Type'lı varyant —
 * en az 6 dosyada `authHeaders`'ın kendi içine gömülü olarak tekrarlanmıştı. */
export async function authHeadersJson(): Promise<Record<string, string>> {
  const headers = await authHeaders();
  return { ...headers, "Content-Type": "application/json" };
}
