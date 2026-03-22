"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { migrateAll } from "../../../lib/migration/assignmentDataMigration";
import type {
  MigrationResult,
  MigrationStatus,
} from "../../../types/assignmentMigration.types";
import Header from "../../../components/layout/Header";
import Sidebar from "../../../components/layout/Sidebar";
import Footer from "../../../components/layout/Footer";

type Phase = "collage" | "book" | "socialMedia";

const PHASES: { key: Phase; label: string; icon: string }[] = [
  { key: "collage", label: "Kolaj Bahcesi", icon: "1" },
  { key: "book", label: "Kitap Secimi", icon: "2" },
  { key: "socialMedia", label: "Sosyal Medya", icon: "3" },
];

function PhaseRow({
  icon,
  label,
  result,
  active,
}: {
  icon: string;
  label: string;
  result: MigrationResult | null;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
        active
          ? "border-blue-300 bg-blue-50"
          : result
          ? result.success
            ? "border-green-300 bg-green-50"
            : "border-red-300 bg-red-50"
          : "border-surface-200 bg-white"
      }`}
    >
      {/* Numara / Durum ikonu */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          active
            ? "bg-blue-500 text-white animate-pulse"
            : result
            ? result.success
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
            : "bg-surface-100 text-surface-400"
        }`}
      >
        {active ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        ) : result ? (
          result.success ? (
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )
        ) : (
          icon
        )}
      </div>

      {/* Label + mesaj */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-surface-800">{label}</p>
        {active && (
          <p className="text-sm text-blue-600">Veri aktariliyor...</p>
        )}
        {result && !active && (
          <p
            className={`text-sm ${
              result.success ? "text-green-700" : "text-red-700"
            }`}
          >
            {result.success
              ? `${result.count ?? ""} kayit aktarildi`
              : result.error ?? result.message}
          </p>
        )}
      </div>

      {/* Sag badge */}
      {result && !active && (
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            result.success
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {result.success ? "Basarili" : "Hata"}
        </span>
      )}
    </div>
  );
}

export default function MigratePage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [status, setStatus] = useState<MigrationStatus>({
    collage: null,
    book: null,
    socialMedia: null,
  });

  useEffect(() => {
    const check = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? snap.data() : null;
        const ok =
          data &&
          (data.role === "admin" ||
            (data.roles && data.roles.includes("admin")));
        if (ok) setIsAdmin(true);
        else router.push("/dashboard");
      } catch {
        router.push("/dashboard");
      }
    };
    check();
  }, [router]);

  async function handleMigrate() {
    setRunning(true);
    setDone(false);
    setStatus({ collage: null, book: null, socialMedia: null });

    await migrateAll((phase, result) => {
      setActivePhase(null);
      setStatus((prev) => ({ ...prev, [phase]: result }));

      // Bir sonraki fazin aktifini goster
      const idx = PHASES.findIndex((p) => p.key === phase);
      const next = PHASES[idx + 1];
      if (next) setActivePhase(next.key);
    });

    setRunning(false);
    setDone(true);
  }

  if (isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-base-primary-600" />
      </div>
    );
  }

  const allSuccess =
    done &&
    status.collage?.success &&
    status.book?.success &&
    status.socialMedia?.success;

  const hasError =
    done &&
    (status.collage?.success === false ||
      status.book?.success === false ||
      status.socialMedia?.success === false);

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel="Veri Migrasyonu" />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-2xl mx-auto px-6 py-10">
            {/* Baslik */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-surface-900">
                Odev Verisi Migrasyonu
              </h1>
              <p className="mt-1 text-sm text-surface-500">
                HTML Firebase Realtime Database'den Flex CRM Firestore'una tek
                hamle veri aktarimi.
              </p>
            </div>

            {/* Kaynak bilgi */}
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <span className="font-semibold">Kaynak:</span>{" "}
              grafik-tasarim-portali (Realtime Database) &nbsp;›&nbsp;
              <span className="font-semibold">Hedef:</span> Flex CRM — lottery_configs
            </div>

            {/* Fazlar */}
            <div className="flex flex-col gap-3 mb-8">
              {PHASES.map((p) => (
                <PhaseRow
                  key={p.key}
                  icon={p.icon}
                  label={p.label}
                  result={status[p.key]}
                  active={running && activePhase === p.key}
                />
              ))}
            </div>

            {/* Sonuc mesaji */}
            {allSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-300 text-green-800 font-medium text-sm">
                Tum odevler basariyla Firestore'a aktarildi.
              </div>
            )}
            {hasError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 font-medium text-sm">
                Bazi migrasyon adimlarinda hata olustu. Konsol loglarini kontrol edin.
              </div>
            )}

            {/* Buton */}
            <button
              onClick={handleMigrate}
              disabled={running}
              className={`w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all ${
                running
                  ? "bg-surface-200 text-surface-400 cursor-not-allowed"
                  : done
                  ? allSuccess
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-base-primary-600 hover:bg-base-primary-700 text-white"
                  : "bg-base-primary-600 hover:bg-base-primary-700 text-white"
              }`}
            >
              {running
                ? "Aktariliyor..."
                : done
                ? allSuccess
                  ? "Tekrar Calistir"
                  : "Tekrar Dene"
                : "Tum Odevleri Migrate Et"}
            </button>

            <p className="mt-4 text-xs text-surface-400 text-center">
              Bu islem mevcut Firestore verilerini uzerine yazar (setDoc).
            </p>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
