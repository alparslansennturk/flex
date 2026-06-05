import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import {
  validateRole,
  getTypeForRole,
  generateActivationCode,
  buildActivationEmail,
  type NewUserRole,
} from "@/app/lib/user-validation";
import { withAuth, Caller } from "@/app/lib/with-auth";

// Admin veya instructor çağırabilir (instructor sadece student oluşturur)
export const POST = withAuth(async (req: NextRequest, caller: Caller) => {
  try {
    const body = await req.json() as {
      email?:       unknown;
      name?:        unknown;
      surname?:     unknown;
      role?:        unknown;
      groupId?:     unknown;
      permissions?: unknown;
    };

    const { email, name, role, groupId, permissions } = body;
    const surname = typeof body.surname === "string" ? body.surname : "";

    // ── 2. Required fields ──────────────────────────────────────────────────
    if (!email || typeof email !== "string")
      return NextResponse.json({ error: "email zorunludur." }, { status: 400 });
    if (!name || typeof name !== "string")
      return NextResponse.json({ error: "name zorunludur." }, { status: 400 });
    if (!role || typeof role !== "string")
      return NextResponse.json({ error: "role zorunludur." }, { status: 400 });

    // ── 3. Role valid mi ────────────────────────────────────────────────────
    if (!validateRole(role))
      return NextResponse.json({ error: `Geçersiz rol: ${role}` }, { status: 400 });

    const newRole = role as NewUserRole;

    // ── 4. Caller yetki kontrolü ────────────────────────────────────────────
    if (newRole === "admin" && caller.role !== "admin")
      return NextResponse.json({ error: "Admin kullanıcı yalnızca admin oluşturabilir." }, { status: 403 });
    if (newRole === "instructor" && caller.role !== "admin")
      return NextResponse.json({ error: "Eğitmen yalnızca admin oluşturabilir." }, { status: 403 });
    if (newRole === "accountant" && caller.role !== "admin")
      return NextResponse.json({ error: "Muhasebe kullanıcısı yalnızca admin oluşturabilir." }, { status: 403 });

    // ── 5. Type otomatik set (client'tan asla alınmaz) ──────────────────────
    const type = getTypeForRole(newRole);

    // ── 6. Email unique mi ──────────────────────────────────────────────────
    const normalizedEmail = email.toLowerCase().trim();
    const existingSnap = await adminDb.collection("users")
      .where("email", "==", normalizedEmail).limit(1).get();
    if (!existingSnap.empty)
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanımda." }, { status: 409 });

    // ── 7. Student: groupId zorunlu ve grup var mı ──────────────────────────
    if (newRole === "student") {
      if (!groupId || typeof groupId !== "string")
        return NextResponse.json({ error: "Öğrenci için groupId zorunludur." }, { status: 400 });
      const groupSnap = await adminDb.collection("groups").doc(groupId).get();
      if (!groupSnap.exists)
        return NextResponse.json({ error: `Grup bulunamadı: ${groupId}` }, { status: 404 });
    }

    // ── 8. Permissions format kontrolü ─────────────────────────────────────
    if (permissions !== undefined && !Array.isArray(permissions))
      return NextResponse.json({ error: "permissions bir dizi olmalıdır." }, { status: 400 });
    const permissionsArray = Array.isArray(permissions) ? permissions as string[] : [];

    // ── Process ─────────────────────────────────────────────────────────────

    // 1. Aktivasyon kodu üret
    const code      = generateActivationCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 2. Firebase Auth kullanıcısı oluştur
    const auth     = getAuth();
    const authUser = await auth.createUser({
      email:         normalizedEmail,
      displayName:   `${name} ${surname}`.trim(),
      emailVerified: false,
    });
    const uid = authUser.uid;

    // 3. Firebase custom claims set (middleware ve token routing için)
    await auth.setCustomUserClaims(uid, { role: newRole, type });

    // 4. Firestore users doc
    await adminDb.collection("users").doc(uid).set({
      uid,
      email:        normalizedEmail,
      name,
      surname,
      roles:        [newRole],
      role:         newRole,
      type,
      permissions:  ["instructor", "accountant"].includes(newRole) ? permissionsArray : [],
      isInstructor: newRole === "instructor",
      status:       "pending_activation",
      isActivated:  false,
      createdAt:    FieldValue.serverTimestamp(),
      createdBy:    caller.uid,
    });

    // 5. codes collection
    const codeRef = adminDb.collection("codes").doc();
    await codeRef.set({
      code,
      userId:    uid,
      email:     normalizedEmail,
      role:      newRole,
      type,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      status:    "pending",
    });

    // 6. Student: membership oluştur
    if (newRole === "student" && typeof groupId === "string") {
      await adminDb.collection("memberships").add({
        userId:    uid,
        groupId,
        role:      "student",
        status:    "active",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // 7. Email template (gönderilmez, sadece hazırlanır)
    const emailTemplate = buildActivationEmail({ name, email: normalizedEmail, code, expiresAt });

    return NextResponse.json({
      userId:        uid,
      email:         normalizedEmail,
      name,
      role:          newRole,
      type,
      code,          // admin preview only
      emailTemplate, // admin "Send codes" butonuna kadar bekler
      status:        "created",
      message:       "Kullanıcı oluşturuldu. Aktivasyon kodunu göndermek için admin panelini kullanın.",
    }, { status: 201 });

  } catch (err: unknown) {
    console.error("[users/create] Hata:", err);
    const message = err instanceof Error ? err.message : "Sunucu hatası.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { roles: ["admin", "instructor"], allowAdminSecret: true });
