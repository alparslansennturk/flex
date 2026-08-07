"use client";

/**
 * FlexOS · Öğrenci — Anketlerim. Claude Design taslağında YOKTU (2026-08-07 kullanıcı
 * kararı: "öğrenciye sunulacak bir sayfa yok henüz, onu da yaparız artık") — sıfırdan
 * tasarlandı, `[personId]/page.tsx`'teki ödev listesi kartı deseniyle tutarlı.
 * Anket gönderilince öğrenciye bildirim düşer (`NotificationBell`, type:"survey") —
 * bu liste bildirimden BAĞIMSIZ ikinci bir kaynak (bildirim arşivlense bile anket kaybolmasın).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Star, Zap, CheckCircle2, Clock, ListChecks, XCircle } from "lucide-react";
import StudentSidebar from "../../_components/StudentSidebar";
import FlexHeader, { FlexPageContent, FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS } from "../../../_components/FlexHeader";
import { authHeaders } from "@/app/lib/client/auth-headers";

type SurveyType = "classic" | "quick";

interface DispatchRow {
  dispatch: {
    id: string;
    surveyTitleSnapshot: string;
    surveyTypeSnapshot: SurveyType;
    groupCodeSnapshot: string;
    sentAt: string;
    dueAt: string;
    questionsSnapshot: { id: string }[];
  };
  answered: boolean;
}

const TYPE_META: Record<SurveyType, { label: string; color: string; bg: string; Icon: typeof Star }> = {
  classic: { label: "Klasik Anket", color: "#2867bd", bg: "#EAF1FB", Icon: Star },
  quick: { label: "Hızlı Anket", color: "#B45309", bg: "#FDF1E0", Icon: Zap },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export default function StudentAnketlerPage() {
  const { personId } = useParams<{ personId: string }>();
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; groupCode?: string } | null>(null);
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders();
        const [meRes, res] = await Promise.all([
          fetch(`/api/flexos/student/me?personId=${personId}`, { headers }),
          fetch(`/api/flexos/student/surveys?personId=${personId}`, { headers, cache: "no-store" }),
        ]);
        if (meRes.ok) {
          const data = await meRes.json() as { person: { firstName: string; lastName: string }; group: { code: string } | null };
          setMe({ name: `${data.person.firstName} ${data.person.lastName}`.trim(), groupCode: data.group?.code });
        }
        if (res.ok) setRows((await res.json()).items ?? []);
      } catch {
        toast.error("Anketler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [personId]);

  if (loading || !me) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 size={22} className="animate-spin text-surface-400" />
      </div>
    );
  }

  const now = new Date();
  const isExpired = (r: DispatchRow) => !r.answered && new Date(r.dispatch.dueAt) < now;
  const pending = rows.filter((r) => !r.answered && !isExpired(r)).sort((a, b) => (b.dispatch.sentAt ?? "").localeCompare(a.dispatch.sentAt ?? ""));
  const expired = rows.filter(isExpired).sort((a, b) => (b.dispatch.sentAt ?? "").localeCompare(a.dispatch.sentAt ?? ""));
  const done = rows.filter((r) => r.answered).sort((a, b) => (b.dispatch.sentAt ?? "").localeCompare(a.dispatch.sentAt ?? ""));

  return (
    <div className="flex h-screen overflow-hidden bg-white font-inter antialiased text-text-primary">
      <StudentSidebar personId={personId} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <FlexHeader
          title="Anketlerim"
          subtitle="Sana gönderilen anketleri buradan doldurabilirsin."
          roleLabel={me.groupCode ? `${me.groupCode} · Öğrenci` : "Öğrenci"}
          maxWidthClassName={FLEX_CONTENT_MAX_WIDTH_COMPACT_CLASS}
          displayNameOverride={me.name}
          connectPersonId={personId}
        />
        <main className="flex-1 overflow-y-auto overflow-x-clip [scrollbar-gutter:stable]">
          <FlexPageContent className="pt-7 pb-12">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-surface-400">
                <ListChecks size={36} strokeWidth={1.4} />
                <p className="mt-3 text-sm font-medium">Şu anda bekleyen bir anketin yok.</p>
              </div>
            ) : (
              <>
                {pending.length > 0 && (
                  <>
                    <h2 className="text-[13px] font-bold text-text-secondary uppercase tracking-wide mb-3">Bekleyen · {pending.length}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                      {pending.map((r) => {
                        const tm = TYPE_META[r.dispatch.surveyTypeSnapshot];
                        return (
                          <button
                            key={r.dispatch.id}
                            type="button"
                            onClick={() => router.push(`/flexos/student/${personId}/anketler/${r.dispatch.id}`)}
                            className="relative text-left p-[18px] rounded-[18px] bg-white border border-surface-200 hover:border-base-primary-300 hover:shadow-md transition-all cursor-pointer"
                          >
                            {/* Bekleyen kart pulse — `egitmen-anasayfa`'daki "not ver" göstergesiyle
                                AYNI desen (2026-08-07 kullanıcı isteği: "Daha Sonra" dedikten sonra
                                Anketlerim'de dikkat çeksin). */}
                            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-status-success-500 rounded-full animate-ping opacity-75" />
                            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-status-success-500 rounded-full" />
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: tm.bg, color: tm.color }}>
                                <tm.Icon size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full" style={{ color: tm.color, background: tm.bg }}>{tm.label}</span>
                                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-surface-100 text-surface-500">{r.dispatch.groupCodeSnapshot}</span>
                                </div>
                                <div className="text-[15px] font-bold text-text-primary mt-2 leading-tight">{r.dispatch.surveyTitleSnapshot}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100">
                              <span className="text-[11.5px] font-semibold text-surface-400 inline-flex items-center gap-1.5"><Clock size={12} />{fmtDate(r.dispatch.sentAt)}</span>
                              <span className="text-[12px] font-bold text-base-primary-600">Anketi Cevapla →</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {expired.length > 0 && (
                  <>
                    <h2 className="text-[13px] font-bold text-text-secondary uppercase tracking-wide mb-3">Süresi Doldu · {expired.length}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                      {expired.map((r) => {
                        const tm = TYPE_META[r.dispatch.surveyTypeSnapshot];
                        return (
                          <div key={r.dispatch.id} className="p-[18px] rounded-[18px] bg-surface-50 border border-surface-200 opacity-70">
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: tm.bg, color: tm.color }}>
                                <tm.Icon size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full" style={{ color: tm.color, background: tm.bg }}>{tm.label}</span>
                                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-surface-100 text-surface-500">{r.dispatch.groupCodeSnapshot}</span>
                                </div>
                                <div className="text-[15px] font-bold text-text-primary mt-2 leading-tight">{r.dispatch.surveyTitleSnapshot}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-surface-200 text-[12px] font-bold text-surface-400">
                              <XCircle size={14} /> Süresi Doldu
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {done.length > 0 && (
                  <>
                    <h2 className="text-[13px] font-bold text-text-secondary uppercase tracking-wide mb-3">Cevapladıklarım · {done.length}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {done.map((r) => {
                        const tm = TYPE_META[r.dispatch.surveyTypeSnapshot];
                        return (
                          <div key={r.dispatch.id} className="p-[18px] rounded-[18px] bg-surface-50 border border-surface-200 opacity-80">
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: tm.bg, color: tm.color }}>
                                <tm.Icon size={20} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full" style={{ color: tm.color, background: tm.bg }}>{tm.label}</span>
                                  <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full bg-surface-100 text-surface-500">{r.dispatch.groupCodeSnapshot}</span>
                                </div>
                                <div className="text-[15px] font-bold text-text-primary mt-2 leading-tight">{r.dispatch.surveyTitleSnapshot}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-surface-200 text-[12px] font-bold text-status-success-600">
                              <CheckCircle2 size={14} /> Cevaplandı
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </FlexPageContent>
        </main>
      </div>
    </div>
  );
}
