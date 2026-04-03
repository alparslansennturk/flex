import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function GET() {
  try {
    const [studentsSnap, tasksSnap, groupsSnap] = await Promise.all([
      adminDb.collection("students").where("status", "==", "active").get(),
      adminDb.collection("tasks").get(),
      adminDb.collection("groups").get(),
    ]);

    const students = studentsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const tasks = tasksSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        endDate: data.endDate ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        classId: data.classId ?? null,
      };
    });

    const groups = groupsSnap.docs.map((d) => {
      const data = d.data();
      return {
        code: data.code ?? null,
        instructor: data.instructor ?? null,
        instructorId: data.instructorId ?? null,
        branch: data.branch ?? null,
        status: data.status ?? null,
      };
    });

    return NextResponse.json({ students, tasks, groups });
  } catch (err) {
    console.error("[api/league] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
