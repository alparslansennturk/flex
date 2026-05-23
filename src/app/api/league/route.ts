import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { DEFAULT_SCORING } from "@/app/lib/scoring";
import { verifyRequestToken } from "@/app/lib/submission-validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyRequestToken(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [studentsSnap, tasksSnap, groupsSnap, scoringSnap] = await Promise.all([
      adminDb.collection("students").where("status", "==", "active").get(),
      adminDb.collection("tasks").get(),
      adminDb.collection("groups").get(),
      adminDb.collection("settings").doc("scoring").get(),
    ]);

    const sd = scoringSnap.exists ? scoringSnap.data() : null;
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
    })) as Array<{ id: string; groupId?: string } & Record<string, unknown>>;

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
        id: d.id,
        code: data.code ?? null,
        instructor: data.instructor ?? null,
        instructorId: data.instructorId ?? null,
        branch: data.branch ?? null,
        status: data.status ?? null,
      };
    });

    // attendanceClosed grupları: kapandığı ay bittiyse öğrencileri ligden çıkar
    const now = new Date();
    const thisYearMonth = now.getFullYear() * 100 + (now.getMonth() + 1); // örn: 202606
    const excludedGroupIds = new Set<string>();
    groupsSnap.docs.forEach((d) => {
      const data = d.data();
      if (!data.attendanceClosed || !data.attendanceClosedAt) return;
      const closedDate: Date = data.attendanceClosedAt.toDate();
      const closedYearMonth = closedDate.getFullYear() * 100 + (closedDate.getMonth() + 1);
      if (closedYearMonth < thisYearMonth) excludedGroupIds.add(d.id);
    });

    const filteredStudents = excludedGroupIds.size > 0
      ? students.filter((s) => !excludedGroupIds.has(s.groupId ?? ""))
      : students;

    return NextResponse.json({ students: filteredStudents, tasks, groups, scoringSettings, activeSeasonId });
  } catch (err) {
    console.error("[api/league] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
