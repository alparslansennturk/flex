"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { backfillStudentHistory } from "../../../lib/studentHistory";
import Header from "../../../components/layout/Header";
import Sidebar from "../../../components/layout/Sidebar";
import Footer from "../../../components/layout/Footer";
import { DatabaseZap, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface BackfillResult {
  processed: number;
  skipped: number;
  errors: number;
}

export default function MigrateHistoryPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin]       = useState<boolean | null>(null);
  const [running, setRunning]       = useState(false);
  const [result, setResult]         = useState<BackfillResult | null>(null);
  const [logs, setLogs]             = useState<string[]>([]);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : null;
        const ok = data && (
          data.role === "admin" ||
          (data.roles && data.roles.includes("admin"))
        );
        if (ok) setIsAdmin(true);
        else router.push("/dashboard");
      } catch { router.push("/dashboard"); }
    };
    check();
  }, [router]);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setLogs([]);
    setError(null);
    try {
      const res = await backfillStudentHistory((msg) =>
        setLogs(prev => [...prev, msg])
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
    setRunning(false);
  };

  if (isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="w-8 h-8 border-[3px] border-[#10294C]/20 border-t-[#10294C] rounded-full animate-spin" />
      </div>
    );
  }

  const isDone    = !!result;
  const hasErrors = result && result.errors > 0;

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <aside className="hidden lg:block h-full shrink-0 z-50 w-[280px] 2xl:w-[320px] bg-[#10294C]">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel="Geçmiş Migrasyon" />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-2xl mx-auto px-6 py-10">

            {/* Başlık */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#10294C] flex items-center justify-center shrink-0">
                <DatabaseZap size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-[22px] font-bold text-[#10294C]">Öğrenci Geçmiş Migrasyonu</h1>
                <p className="text-[13px] text-surface-500">group_history + student_snapshots backfill</p>
              </div>
            </div>

            {/* Uyarı */}
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-800 space-y-1">
              <p className="font-semibold">Bu işlem ne yapar?</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                <li>Tüm öğrenciler için <code>group_history</code> subcollection kaydı oluşturur</li>
                <li>Son 6 ay için aylık <code>student_snapshots</code> dökümanı yazar</li>
                <li>Zaten migrasyon yapılmış öğrencileri atlar (idempotent)</li>
                <li>Mevcut hiçbir veriyi silmez veya değiştirmez</li>
              </ul>
            </div>

            {/* İstatistikler (tamamlandıysa) */}
            {isDone && result && (
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-center">
                  <p className="text-[28px] font-bold text-green-700">{result.processed}</p>
                  <p className="text-[12px] text-green-600 font-medium mt-0.5">İşlendi</p>
                </div>
                <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 text-center">
                  <p className="text-[28px] font-bold text-surface-500">{result.skipped}</p>
                  <p className="text-[12px] text-surface-400 font-medium mt-0.5">Atlandı</p>
                </div>
                <div className={`p-4 rounded-xl border text-center ${hasErrors ? "border-red-200 bg-red-50" : "border-surface-200 bg-surface-50"}`}>
                  <p className={`text-[28px] font-bold ${hasErrors ? "text-red-600" : "text-surface-400"}`}>{result.errors}</p>
                  <p className={`text-[12px] font-medium mt-0.5 ${hasErrors ? "text-red-500" : "text-surface-400"}`}>Hata</p>
                </div>
              </div>
            )}

            {/* Sonuç banner */}
            {isDone && !hasErrors && (
              <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-300">
                <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                <p className="text-[13px] text-green-800 font-medium">
                  Migrasyon başarıyla tamamlandı. Artık tüm yeni işlemler otomatik kaydediliyor.
                </p>
              </div>
            )}
            {isDone && hasErrors && (
              <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-300">
                <AlertTriangle size={18} className="text-red-600 shrink-0" />
                <p className="text-[13px] text-red-800 font-medium">
                  {result!.errors} öğrencide hata oluştu. Konsol loglarını kontrol edin. Tekrar çalıştırabilirsiniz.
                </p>
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-300">
                <AlertTriangle size={18} className="text-red-600 shrink-0" />
                <p className="text-[13px] text-red-800 font-medium">{error}</p>
              </div>
            )}

            {/* Log alanı */}
            {logs.length > 0 && (
              <div className="mt-4 bg-[#0F1923] rounded-xl p-4 max-h-[200px] overflow-y-auto">
                {logs.map((l, i) => (
                  <p key={i} className="text-[12px] text-green-400 font-mono leading-relaxed"
                  >{`> ${l}`}</p>
                ))}
                {running && (
                  <p className="text-[12px] text-white/40 font-mono animate-pulse">{">"} çalışıyor...</p>
                )}
              </div>
            )}

            {/* Buton */}
            <button
              onClick={handleRun}
              disabled={running}
              className={`mt-6 w-full py-3 px-6 rounded-xl font-semibold text-[14px] transition-all flex items-center justify-center gap-2 ${
                running
                  ? "bg-surface-200 text-surface-400 cursor-not-allowed"
                  : "bg-[#10294C] hover:bg-[#0d2040] text-white active:scale-[0.99]"
              }`}
            >
              {running ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Çalışıyor...
                </>
              ) : isDone ? (
                <>
                  <Clock size={15} />
                  Tekrar Çalıştır
                </>
              ) : (
                <>
                  <DatabaseZap size={15} />
                  Migrasyonu Başlat
                </>
              )}
            </button>

            <p className="mt-3 text-[11px] text-surface-400 text-center">
              Sadece admin erişimi. Mevcut veriler değiştirilmez.
            </p>

          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
