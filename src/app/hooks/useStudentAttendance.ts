"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface StudentAttendanceStats {
  attended: number;       // yoklamada saati > 0 olan ders sayısı
  totalSessions: number;  // grubun toplam kapatılmış/dolu yoklama sayısı
  totalHours: number;     // öğrencinin katıldığı toplam saat
  onlineSessions: number; // online katılınan ders sayısı
  rate: number;           // devam oranı 0–100
}

export function useStudentAttendance(
  studentId: string | null | undefined,
  groupId: string | null | undefined,
): { stats: StudentAttendanceStats | null; loading: boolean } {
  const [stats, setStats] = useState<StudentAttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId || !groupId) { setStats(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    getDocs(query(collection(db, "design_attendance"), where("groupId", "==", groupId)))
      .then(snap => {
        if (cancelled) return;

        // Kaydı olan (girdi veya kapatılmış) yoklamalar
        const activeDocs = snap.docs.filter(d => {
          const data = d.data();
          return Object.keys(data.entries ?? {}).length > 0 || (data.attendanceClosed ?? false);
        });

        let attended = 0;
        let totalHours = 0;
        let onlineSessions = 0;

        activeDocs.forEach(d => {
          const entry = (d.data().entries ?? {})[studentId!];
          if (entry && entry.hours > 0) {
            attended++;
            totalHours += entry.hours;
            if (entry.online) onlineSessions++;
          }
        });

        const totalSessions = activeDocs.length;
        const rate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

        setStats({ attended, totalSessions, totalHours, onlineSessions, rate });
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [studentId, groupId]);

  return { stats, loading };
}
