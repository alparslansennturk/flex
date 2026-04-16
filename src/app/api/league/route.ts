import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { DEFAULT_SCORING } from "@/app/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [studentsSnap, tasksSnap, groupsSnap, scoringSnap] = await Promise.all([
      adminDb.collection("students").where("status", "==", "active").get(),
      adminDb.collection("tasks").get(),
      adminDb.collection("groups").get(),
      adminDb.collection("settings").doc("scoring").get(),
    ]);

    const sd = scoringSnap.exists ? (scoringSnap.data() as Record<string, any>) : null;
    const scoringSettings = {
      leaderboard:        { ...DEFAULT_SCORING.leaderboard,        ...(sd?.leaderboard        ?? {}) },
      certificateWeights: { ...DEFAULT_SCORING.certificateWeights, ...(sd?.certificateWeights ?? {}) },
      latePenalty:        { ...DEFAULT_SCORING.latePenalty,        ...(sd?.latePenalty        ?? {}) },
      difficultyXP:       { ...DEFAULT_SCORING.difficultyXP,       ...(sd?.difficultyXP       ?? {}) },
    };
    const activeSeasonId = sd?.activeSeasonId ?? "season_1";

    const students = studentsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const tasks = tasksSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        endDate:  data.endDate  ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        classId:  data.classId  ?? null,
        status:   data.status   ?? null,
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

    return NextResponse.json({ students, tasks, groups, scoringSettings, activeSeasonId });
  } catch (err) {
    console.error("[api/league] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
