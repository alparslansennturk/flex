"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  doc, getDoc, setDoc, addDoc, collection, serverTimestamp,
  getDocs, query, where, updateDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import type { BookPool, BookItem } from "../pool/poolTypes";
import type { Student, TaskData, StudentDraw } from "../shared/types";
import StudentPanel from "../shared/StudentPanel";
import { usePickingEngine } from "../shared/usePickingEngine";

// ─── Tipleri ─────────────────────────────────────────────────────────────────

interface BookStudentDraw {
  studentId: string;
  book: BookItem;
}

// ─── Kitap kartı ─────────────────────────────────────────────────────────────

function BookCard({ book }: { book: BookItem }) {
  return (
    <div style={{
      width: 360,
      background: "linear-gradient(145deg, #162544 0%, #1e3260 100%)",
      borderRadius: 22,
      padding: "36px 32px",
      border: "1px solid rgba(104,154,223,0.22)",
      boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      display: "flex",
      flexDirection: "column",
      gap: 22,
    }}>
      {/* İkon */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: "rgba(104,154,223,0.14)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28,
      }}>
        📚
      </div>

      {/* Başlık + Yazar */}
      <div>
        <p style={{
          color: "white", fontSize: 24, fontWeight: 900,
          lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0,
        }}>
          {book.title}
        </p>
        <p style={{
          color: "rgba(255,255,255,0.5)", fontSize: 14,
          marginTop: 8, fontWeight: 600,
        }}>
          {book.author}
        </p>
      </div>

      {/* Tür etiketleri */}
      {(book.genre || book.subGenre) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {book.genre && (
            <span style={{
              padding: "5px 14px", borderRadius: 50,
              background: "rgba(104,154,223,0.15)",
              color: "#689adf", fontSize: 12, fontWeight: 700,
            }}>
              {book.genre}
            </span>
          )}
          {book.subGenre && (
            <span style={{
              padding: "5px 14px", borderRadius: 50,
              background: "rgba(104,154,223,0.08)",
              color: "rgba(104,154,223,0.65)", fontSize: 12, fontWeight: 600,
            }}>
              {book.subGenre}
            </span>
          )}
        </div>
      )}

      {/* Alt bilgiler */}
      {(book.publisher || book.pageCount || book.dimensions) && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: 18,
          display: "flex", gap: 24,
        }}>
          {book.publisher && (
            <div>
              <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Yayınevi</p>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, marginTop: 4 }}>{book.publisher}</p>
            </div>
          )}
          {book.pageCount && (
            <div>
              <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Sayfa</p>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, marginTop: 4 }}>{book.pageCount}</p>
            </div>
          )}
          {book.dimensions && (
            <div>
              <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Boyut</p>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600, marginTop: 4 }}>{book.dimensions}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Kitap önizleme overlay (tamamlanan öğrenci kitabını görme) ───────────────

function BookPreviewOverlay({ draw, onClose }: { draw: BookStudentDraw; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(6,13,26,0.85)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()} style={{ animation: "bookCardIn 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <BookCard book={draw.book} />
      </div>
    </div>
  );
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export default function BookGameScreen({ task, students }: { task: TaskData; students: Student[] }) {
  const router = useRouter();

  const [pool,        setPool]        = useState<BookPool | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);

  const [bookDraws,    setBookDraws]    = useState<BookStudentDraw[]>([]);
  const [currentBook,  setCurrentBook]  = useState<BookItem | null>(null);
  const [bookRevealed, setBookRevealed] = useState(false);
  const [drawingStudentId, setDrawingStudentId] = useState<string | null>(null);
  const [previewDraw,  setPreviewDraw]  = useState<BookStudentDraw | null>(null);

  const [archived,  setArchived]  = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Havuzu yükle
  useEffect(() => {
    getDoc(doc(db, "lottery_configs", "book")).then(snap => {
      if (snap.exists()) setPool(snap.data() as BookPool);
      setPoolLoading(false);
    });
  }, []);

  // Mevcut ilerlemeyi yükle
  useEffect(() => {
    if (!pool) return;
    getDoc(doc(db, "lottery_results", task.id)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.draws) setBookDraws(data.draws);
      }
    });
  }, [pool, task.id]);

  // Kalan öğrenciler + kitaplar
  const drawnStudentIds  = bookDraws.map(d => d.studentId);
  const remainingStudents = students.filter(s => !drawnStudentIds.includes(s.id));
  const allDone = remainingStudents.length === 0 && students.length > 0;

  const usedBookIds    = bookDraws.map(d => d.book.id);
  const availableBooks = (pool?.items ?? []).filter(b => !usedBookIds.includes(b.id));

  // Öğrenci seçim motoru
  const { phase, pickHighlightId, selectedStudentId, nameVisible, beginPicking, resetToIdle } =
    usePickingEngine({
      remainingStudents,
      onStudentReady: (student) => setDrawingStudentId(student.id),
    });

  const selectedStudent = selectedStudentId
    ? students.find(s => s.id === selectedStudentId) ?? null
    : null;

  // Kitap çek
  const handleDrawBook = useCallback(() => {
    if (!selectedStudent || availableBooks.length === 0) return;
    const book = availableBooks[Math.floor(Math.random() * availableBooks.length)];
    setCurrentBook(book);
    const newDraw: BookStudentDraw = { studentId: selectedStudent.id, book };
    const updated = [...bookDraws, newDraw];
    setBookDraws(updated);
    setDoc(doc(db, "lottery_results", task.id), {
      draws: updated, groupId: task.groupId ?? "", lastUpdated: serverTimestamp(),
    });
    setTimeout(() => setBookRevealed(true), 80);
  }, [selectedStudent, availableBooks, bookDraws, task]);

  // Sonraki öğrenciye geç
  const handleAdvance = useCallback(() => {
    setCurrentBook(null);
    setBookRevealed(false);
    setDrawingStudentId(null);
    resetToIdle();
  }, [resetToIdle]);

  // StudentPanel için uyumlu format (catCount=1)
  const studentDraws: StudentDraw[] = bookDraws.map(d => ({
    studentId: d.studentId,
    draws: [{ category: "Kitap", item: { name: d.book.title, emoji: "📚" } }],
  }));

  // Arşive kaydet
  const handleArchive = useCallback(async () => {
    if (!task.groupId || archiving || archived) return;
    setArchiving(true);
    try {
      const existing = await getDocs(
        query(collection(db, "assignment_archive"), where("taskId", "==", task.id))
      );
      if (existing.empty) {
        await addDoc(collection(db, "assignment_archive"), {
          groupId:     task.groupId,
          taskId:      task.id,
          taskName:    task.name,
          type:        "kitap",
          completedAt: serverTimestamp(),
          draws:       studentDraws,
          students:    students.map(s => ({ id: s.id, name: s.name, lastName: s.lastName })),
        });
      }
      await updateDoc(doc(db, "tasks", task.id), { status: "completed", isActive: true });
      setArchived(true);
      setTimeout(() => router.push("/dashboard"), 2200);
    } finally {
      setArchiving(false);
    }
  }, [task, archiving, archived, students, studentDraws, router]);

  if (poolLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#060D1A" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "rgba(255,255,255,0.08)", borderTopColor: "#689adf" }} />
      </div>
    );
  }

  if (!pool || pool.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#060D1A" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Kitap havuzu boş veya yüklenmemiş.</p>
        <button onClick={() => router.push("/dashboard")}
          style={{ color: "#689adf", fontSize: 13, fontWeight: 700, cursor: "pointer", background: "none", border: "none" }}>
          Ana sayfaya dön
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#060D1A", overflow: "hidden" }}>

      {/* Sol: Öğrenci paneli */}
      <StudentPanel
        students={students}
        draws={studentDraws}
        catCount={1}
        taskLabel={task.name}
        onViewResult={id => {
          const d = bookDraws.find(x => x.studentId === id);
          if (d) setPreviewDraw(d);
        }}
        pickHighlightId={pickHighlightId}
        drawingStudentId={drawingStudentId}
      />

      {/* Sağ: Oyun alanı */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Başlık */}
        <div style={{
          padding: "20px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>📚</span>
            <div>
              <p style={{ color: "rgba(255,255,255,0.85)", fontWeight: 800, fontSize: 15, margin: 0 }}>
                Kitap Seçimi
              </p>
              <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 12, marginTop: 3 }}>
                {bookDraws.length} / {students.length} tamamlandı
              </p>
            </div>
          </div>
        </div>

        {/* Ana alan */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "40px 60px", gap: 32,
        }}>

          {/* Öğrenci isim alanı */}
          {(phase === "picking" || phase === "ready") && selectedStudentId && (
            <div style={{ textAlign: "center" }}>
              <p style={{
                color: "rgba(255,255,255,0.32)", fontSize: 15,
                fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 20,
              }}>
                Kitap Alacak Katılımcı
              </p>
              <p style={{
                fontSize: nameVisible ? 52 : 4,
                fontWeight: 900,
                color: "white",
                letterSpacing: "-0.02em",
                opacity: nameVisible ? 1 : 0,
                transition: "all 0.28s cubic-bezier(0.34,1.56,0.64,1)",
                transform: nameVisible ? "scale(1)" : "scale(0.04)",
                margin: 0,
              }}>
                {selectedStudent?.name} {selectedStudent?.lastName}
              </p>
            </div>
          )}

          {/* Idle: kaç kişi kaldı */}
          {phase === "idle" && !allDone && !currentBook && (
            <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 15, fontWeight: 600 }}>
              {remainingStudents.length} katılımcı kaldı
            </p>
          )}

          {/* Kitap kartı */}
          {currentBook && (
            <div style={{
              opacity: bookRevealed ? 1 : 0,
              transform: bookRevealed ? "scale(1) translateY(0)" : "scale(0.85) translateY(20px)",
              transition: "all 0.45s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              <BookCard book={currentBook} />
            </div>
          )}

          {/* Tamamlandı */}
          {allDone && !currentBook && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 48 }}>🎉</div>
              <p style={{ color: "white", fontSize: 20, fontWeight: 900, margin: 0 }}>
                Tüm katılımcılar tamamlandı!
              </p>
              <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>
                Kitap dağılımı başarıyla tamamlandı.
              </p>
              <button
                onClick={handleArchive}
                disabled={archiving || archived}
                style={{
                  marginTop: 8, padding: "13px 36px", borderRadius: 50,
                  background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)",
                  color: "white", fontWeight: 700, fontSize: 14,
                  border: "none", cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(58,123,213,0.25)",
                  opacity: archiving ? 0.6 : 1,
                }}
              >
                {archiving ? "Kaydediliyor..." : "Arşive Kaydet"}
              </button>
            </div>
          )}
        </div>

        {/* Alt buton */}
        <div style={{
          padding: "20px 40px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "center", alignItems: "center",
          minHeight: 88,
        }}>
          {phase === "idle" && !allDone && !currentBook && (
            <button
              onClick={beginPicking}
              style={{
                padding: "16px 56px", borderRadius: 50,
                background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)",
                color: "white", fontWeight: 900, fontSize: 16,
                border: "none", cursor: "pointer",
                boxShadow: "0 8px 28px rgba(58,123,213,0.28)",
              }}
            >
              Başlat
            </button>
          )}

          {phase === "ready" && !currentBook && (
            <button
              onClick={handleDrawBook}
              style={{
                padding: "16px 56px", borderRadius: 50,
                background: "linear-gradient(135deg, #205297 0%, #3a7bd5 100%)",
                color: "white", fontWeight: 900, fontSize: 16,
                border: "none", cursor: "pointer",
                boxShadow: "0 8px 28px rgba(58,123,213,0.28)",
                animation: "fadeIn 0.3s ease",
              }}
            >
              Kitap Çek
            </button>
          )}

          {currentBook && bookRevealed && !allDone && (
            <button
              onClick={handleAdvance}
              style={{
                padding: "15px 48px", borderRadius: 50,
                background: "rgba(104,154,223,0.12)",
                color: "#689adf", fontWeight: 800, fontSize: 15,
                border: "1px solid rgba(104,154,223,0.2)",
                cursor: "pointer",
                animation: "fadeIn 0.3s ease",
              }}
            >
              Devam →
            </button>
          )}
        </div>

        {/* Arşiv overlay */}
        {(archiving || archived) && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(6,13,26,0.82)", backdropFilter: "blur(12px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20,
            animation: "fadeIn 0.3s ease",
          }}>
            {archiving && !archived ? (
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.12)",
                borderTopColor: "#689adf",
                animation: "spin 0.8s linear infinite",
              }} />
            ) : (
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(56,161,105,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32, animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              }}>✓</div>
            )}
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>
                {archiving && !archived ? "Kaydediliyor..." : "Ödev Tamamlandı"}
              </p>
              {archived && (
                <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, marginTop: 8 }}>
                  Ana sayfaya dönülüyor...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Keyframes */}
        <style>{`
          @keyframes bookCardIn {
            0%   { opacity:0; transform:scale(0.85) translateY(20px); }
            100% { opacity:1; transform:scale(1) translateY(0); }
          }
          @keyframes spin    { to { transform:rotate(360deg); } }
          @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
          @keyframes popIn {
            0%   { transform:scale(0.04); opacity:0; }
            20%  { opacity:1; }
            55%  { transform:scale(1.08); }
            75%  { transform:scale(0.97); }
            100% { transform:scale(1); opacity:1; }
          }
        `}</style>
      </div>

      {/* Kitap önizleme */}
      {previewDraw && (
        <BookPreviewOverlay draw={previewDraw} onClose={() => setPreviewDraw(null)} />
      )}
    </div>
  );
}
