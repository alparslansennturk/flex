"use client";

/**
 * FlexOS · Anket Gönder modalı — 2026-08-07 kullanıcı kararı: ayrı "Anket Yap" SAYFASI
 * kaldırıldı, gönderim artık kütüphane satırındaki/kartındaki "Anket Yap" butonundan
 * doğrudan bu modal açılır (anket zaten context'ten belli, "1. Anket Seç" adımına gerek
 * yok). İçerik `anketler/anket-yap/page.tsx`'in eski akışıyla AYNI: önce Grup/Tek Öğrenci
 * mod seçimi, sonra ilgili hedefleme adımı. Tekil gönderim `dispatchSurvey`'in
 * `onlyPersonIds` daraltmasını kullanır (o öğrencinin grubunun geri kalanı etkilenmez).
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Send, Users, GraduationCap, Check, Loader2, Search, User, UserRound } from "lucide-react";
import { authHeaders, authHeadersJson } from "@/app/lib/client/auth-headers";

type SurveyType = "classic" | "quick";
type Mode = "group" | "student";

interface CandidateGroup {
  id: string;
  code: string;
  branch?: string;
  status: string;
  studentCount: number;
}

interface CandidateStudent {
  personId: string;
  name: string;
  groupId: string;
  groupCode: string;
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toLocaleUpperCase("tr");
}

export default function SendSurveyModal({
  survey,
  onClose,
  onSent,
}: {
  survey: { id: string; type: SurveyType; title: string };
  onClose: () => void;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);

  // ── Grup modu ──
  const [candidates, setCandidates] = useState<CandidateGroup[] | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  // ── Tek Öğrenci modu ──
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<CandidateStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<CandidateStudent | null>(null);

  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mode !== "group") {
      setCandidates(null);
      setSelectedGroupIds(new Set());
      return;
    }
    setLoadingCandidates(true);
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/surveys/${survey.id}/candidate-groups`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error();
        const { items } = await res.json();
        setCandidates(items);
        if (items.length === 1) setSelectedGroupIds(new Set([items[0].id]));
      } catch {
        toast.error("Hedef sınıflar yüklenemedi.");
        setCandidates([]);
      } finally {
        setLoadingCandidates(false);
      }
    })();
  }, [mode, survey.id]);

  useEffect(() => {
    if (mode !== "student") {
      setStudentResults([]);
      return;
    }
    setLoadingStudents(true);
    const t = setTimeout(async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/flexos/surveys/${survey.id}/candidate-students?q=${encodeURIComponent(studentQuery)}`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error();
        setStudentResults((await res.json()).items ?? []);
      } catch {
        toast.error("Öğrenciler yüklenemedi.");
      } finally {
        setLoadingStudents(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [mode, survey.id, studentQuery]);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function backToModePicker() {
    setMode(null);
    setSelectedGroupIds(new Set());
    setSelectedStudent(null);
    setStudentQuery("");
  }

  async function handleSendGroup() {
    if (selectedGroupIds.size === 0) return;
    setSending(true);
    try {
      const headers = await authHeadersJson();
      const res = await fetch(`/api/flexos/surveys/${survey.id}/dispatch`, {
        method: "POST",
        headers,
        body: JSON.stringify({ groupIds: Array.from(selectedGroupIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gönderilemedi.");
      }
      toast.success(`Anket ${selectedGroupIds.size} sınıfa gönderildi.`);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendStudent() {
    if (!selectedStudent) return;
    setSending(true);
    try {
      const headers = await authHeadersJson();
      const res = await fetch(`/api/flexos/surveys/${survey.id}/dispatch`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          groupIds: [selectedStudent.groupId],
          onlyPersonIds: { [selectedStudent.groupId]: [selectedStudent.personId] },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gönderilemedi.");
      }
      toast.success(`Anket ${selectedStudent.name}'e gönderildi.`);
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  const reachCount = useMemo(
    () => (candidates ?? []).filter((c) => selectedGroupIds.has(c.id)).reduce((a, c) => a + c.studentCount, 0),
    [candidates, selectedGroupIds],
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,25,40,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, maxHeight: "calc(100vh - 48px)", overflowY: "auto", background: "#fff", borderRadius: 22, border: "1px solid #E2E5EA", boxShadow: "0 30px 80px -20px rgba(10,20,35,.55)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "22px 26px 0" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E222B", letterSpacing: "-.4px" }}>Anket Yap</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#5A616C", fontWeight: 500 }}>{survey.title}</p>
          </div>
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #E2E5EA", background: "#fff", color: "#5A616C", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "0 0 auto" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px 26px 26px" }}>
          {!mode && (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#5A616C", fontWeight: 500 }}>Anket normalde sınıfa gönderilir — tek bir öğrenciyi de seçebilirsin.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button type="button" onClick={() => setMode("group")} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, padding: 18, borderRadius: 16, border: "1.5px solid #E2E5EA", background: "#FBFCFD", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "#EAF1FB", color: "#2867bd" }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1E222B" }}>Grup</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "#5A616C", marginTop: 2 }}>Bir veya birden fazla sınıfa gönder</div>
                  </div>
                </button>
                <button type="button" onClick={() => setMode("student")} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, padding: 18, borderRadius: 16, border: "1.5px solid #E2E5EA", background: "#FBFCFD", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "#FDF1E0", color: "#B45309" }}>
                    <UserRound size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1E222B" }}>Tek Öğrenci</div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "#5A616C", marginTop: 2 }}>Ara, seç, sadece ona gönder</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {mode && (
            <button type="button" onClick={backToModePicker} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12.5, fontWeight: 700, color: "#2867bd", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              ← Gönderim türünü değiştir
            </button>
          )}

          {mode === "group" && (
            <>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 9 }}>
                Hedef Sınıf {survey.type === "classic" ? "(eğitim sonuna gelmiş)" : "(aktif)"} <span style={{ color: "#2867bd", textTransform: "none", letterSpacing: 0 }}>· {selectedGroupIds.size} seçili</span>
              </label>
              {loadingCandidates ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><Loader2 className="animate-spin" size={22} color="#8E95A3" /></div>
              ) : (candidates ?? []).length === 0 ? (
                <div style={{ padding: 20, borderRadius: 14, background: "#FBFCFD", border: "1px solid #E2E5EA", color: "#5A616C", fontSize: 13.5 }}>
                  {survey.type === "classic" ? "Şu anda eğitim sonuna gelmiş uygun bir sınıf yok." : "Şu anda aktif/devam eden bir sınıf yok."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(candidates ?? []).map((g) => {
                    const sel = selectedGroupIds.has(g.id);
                    return (
                      <button key={g.id} type="button" onClick={() => toggleGroup(g.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: `1.5px solid ${sel ? "#2867bd" : "#E2E5EA"}`, background: sel ? "#EAF1FB" : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#2867bd" : "#EEF1F5", color: sel ? "#fff" : "#5A616C" }}>
                          <GraduationCap size={19} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B" }}>{g.code}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: "#5A616C", marginTop: 1 }}>{g.branch || "Branşsız"} · {g.studentCount} öğrenci</div>
                        </div>
                        <span style={{ width: 22, height: 22, borderRadius: 7, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                          {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedGroupIds.size > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, padding: "13px 15px", borderRadius: 13, background: "#EAF1FB", border: "1px solid #DCE9FB", color: "#3B5876", fontSize: 13, fontWeight: 600 }}>
                  <Users size={16} />
                  <span>Toplam <strong>{reachCount} öğrenciye</strong> ulaşacak.</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button
                  type="button"
                  disabled={selectedGroupIds.size === 0 || sending}
                  onClick={handleSendGroup}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 22px", borderRadius: 12, border: "none", background: selectedGroupIds.size === 0 || sending ? "#DCE0E6" : "#2867bd", color: selectedGroupIds.size === 0 || sending ? "#8E95A3" : "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: selectedGroupIds.size === 0 || sending ? "default" : "pointer" }}
                >
                  <Send size={15} /> {sending ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </>
          )}

          {mode === "student" && (
            <>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#8E95A3", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 9 }}>
                Öğrenci Ara {survey.type === "classic" ? "(eğitim sonuna gelmiş sınıflardan)" : "(aktif sınıflardan)"}
              </label>
              <div style={{ position: "relative", marginBottom: 14 }}>
                <Search size={16} color="#8E95A3" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  value={studentQuery}
                  onChange={(e) => { setStudentQuery(e.target.value); setSelectedStudent(null); }}
                  placeholder="Öğrenci adı ara..."
                  style={{ width: "100%", height: 44, padding: "0 14px 0 38px", borderRadius: 11, border: "1px solid #E2E5EA", background: "#fff", fontSize: 13.5, fontWeight: 500, outline: "none" }}
                />
              </div>

              {loadingStudents ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><Loader2 className="animate-spin" size={22} color="#8E95A3" /></div>
              ) : studentResults.length === 0 ? (
                <div style={{ padding: 20, borderRadius: 14, background: "#FBFCFD", border: "1px solid #E2E5EA", color: "#5A616C", fontSize: 13.5 }}>
                  {studentQuery.trim() ? "Eşleşen öğrenci bulunamadı." : "Uygun sınıflarda kayıtlı öğrenci yok."}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 280, overflowY: "auto" }}>
                  {studentResults.map((st) => {
                    const sel = selectedStudent?.personId === st.personId;
                    return (
                      <button key={st.personId} type="button" onClick={() => setSelectedStudent(st)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 13, border: `1.5px solid ${sel ? "#2867bd" : "#E2E5EA"}`, background: sel ? "#EAF1FB" : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", background: sel ? "#2867bd" : "#8E95A3" }}>
                          {initials(st.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1E222B" }}>{st.name}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: "#5A616C", marginTop: 1 }}>{st.groupCode}</div>
                        </div>
                        <span style={{ width: 22, height: 22, borderRadius: 7, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: sel ? "#2867bd" : "transparent", border: sel ? "none" : "2px solid #CDD2DA" }}>
                          {sel && <Check size={12} strokeWidth={3.4} color="#fff" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedStudent && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, padding: "13px 15px", borderRadius: 13, background: "#EAF1FB", border: "1px solid #DCE9FB", color: "#3B5876", fontSize: 13, fontWeight: 600 }}>
                  <User size={16} />
                  <span><strong>{selectedStudent.name}</strong>&apos;e ({selectedStudent.groupCode}) gönderilecek — sınıfın geri kalanı etkilenmez.</span>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <button
                  type="button"
                  disabled={!selectedStudent || sending}
                  onClick={handleSendStudent}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 22px", borderRadius: 12, border: "none", background: !selectedStudent || sending ? "#DCE0E6" : "#2867bd", color: !selectedStudent || sending ? "#8E95A3" : "#fff", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: !selectedStudent || sending ? "default" : "pointer" }}
                >
                  <Send size={15} /> {sending ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
