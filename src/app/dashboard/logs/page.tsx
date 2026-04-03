"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Header from "../../components/layout/Header";
import Sidebar from "../../components/layout/Sidebar";
import Footer from "../../components/layout/Footer";
import { Trash2, CheckSquare, Square, Minus, ChevronDown, ChevronRight } from "lucide-react";

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface MailLog {
  id: string;
  to: string;
  name?: string | null;
  groupCode?: string | null;
  subject: string;
  type: string;
  status: "success" | "failed";
  messageId?: string | null;
  error?: string | null;
  createdAt: string | null;
}

interface ScoreLog {
  id: string;
  studentName: string;
  teacherName: string;
  taskName: string;
  points: number;
  createdAt: string | null;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABELS: Record<string, string> = {
  welcome: "Hoş Geldiniz",
  otp: "Giriş Kodu",
  notification: "Bildirim",
  "bulk-welcome": "Toplu Hoş Geldiniz",
  "deadline-reminder": "Son Tarih",
  "monthly-winner": "Aylık Kazanan",
};

// ─── Mail Logs Sekmesi ───────────────────────────────────────────────────────

function fmtDateKey(iso: string | null): string {
  if (!iso) return "Tarih yok";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function MailLogsTab() {
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [deletingMany, setDeletingMany] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/logs?type=mail");
      const data = await res.json();
      const fetched: MailLog[] = data.logs ?? [];
      setLogs(fetched);
      // İlk grubu otomatik aç
      if (fetched.length > 0) {
        const firstKey = fmtDateKey(fetched[0].createdAt);
        setOpenGroups(new Set([firstKey]));
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Tarihe göre grupla
  const groups = useMemo(() => {
    const map = new Map<string, MailLog[]>();
    for (const log of logs) {
      const key = fmtDateKey(log.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return map;
  }, [logs]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup_select = (groupLogs: MailLog[]) => {
    const ids = groupLogs.map(l => l.id);
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleDeleteMany = async () => {
    if (selected.size === 0) return;
    setDeletingMany(true);
    try {
      const ids = Array.from(selected);
      await fetch("/api/admin/logs/delete-many", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, type: "mail" }),
      });
      setLogs(prev => prev.filter(l => !selected.has(l.id)));
      setSelected(new Set());
    } finally {
      setDeletingMany(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-20 text-text-tertiary text-sm">
        Henüz mail log kaydı yok.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toplu silme toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-1">
          <span className="text-sm text-text-secondary">{selected.size} kayıt seçildi</span>
          <button onClick={handleDeleteMany} disabled={deletingMany} className="logs-delete-many-btn">
            {deletingMany ? (
              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Seçilenleri Sil
          </button>
        </div>
      )}

      {/* Tarih grupları */}
      {Array.from(groups.entries()).map(([dateKey, groupLogs]) => {
        const isOpen = openGroups.has(dateKey);
        const groupIds = groupLogs.map(l => l.id);
        const allGroupSelected = groupIds.every(id => selected.has(id));
        const someGroupSelected = groupIds.some(id => selected.has(id)) && !allGroupSelected;

        return (
          <div key={dateKey} className="border border-surface-200 rounded-xl overflow-hidden">
            {/* Grup başlığı */}
            <button
              onClick={() => toggleGroup(dateKey)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-surface-50 hover:bg-surface-100 transition-colors text-left"
            >
              <span className="text-text-tertiary">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <span className="text-sm font-semibold text-text-primary flex-1">{dateKey}</span>
              <span className="text-xs text-text-tertiary">{groupLogs.length} kayıt</span>
              {/* Grup tümünü seç */}
              <span
                onClick={e => { e.stopPropagation(); toggleGroup_select(groupLogs); }}
                className="flex items-center justify-center text-text-tertiary hover:text-base-primary-600 transition-colors ml-2"
              >
                {allGroupSelected ? (
                  <CheckSquare size={16} className="text-base-primary-500" />
                ) : someGroupSelected ? (
                  <Minus size={16} />
                ) : (
                  <Square size={16} />
                )}
              </span>
            </button>

            {/* Grup içeriği */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th className="w-8"></th>
                      <th>Saat</th>
                      <th>Ad Soyad</th>
                      <th>Grup</th>
                      <th>E-posta</th>
                      <th>Tür</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupLogs.map(log => (
                      <tr key={log.id} className={selected.has(log.id) ? "logs-row-selected" : ""}>
                        <td>
                          <button
                            onClick={() => toggleOne(log.id)}
                            className="flex items-center justify-center text-text-tertiary hover:text-base-primary-600 transition-colors"
                          >
                            {selected.has(log.id) ? (
                              <CheckSquare size={16} className="text-base-primary-500" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </td>
                        <td className="text-text-tertiary whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="font-medium text-base-primary-900">
                          {log.name?.trim() || "—"}
                        </td>
                        <td className="text-text-secondary">{log.groupCode || "—"}</td>
                        <td className="text-text-secondary">{log.to}</td>
                        <td>
                          <span className="logs-badge logs-badge-type">
                            {TYPE_LABELS[log.type] ?? log.type}
                          </span>
                        </td>
                        <td>
                          {log.status === "success" ? (
                            <span className="logs-badge logs-badge-success">Başarılı</span>
                          ) : (
                            <span className="logs-badge logs-badge-failed" title={log.error ?? ""}>Başarısız</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Puan Logları Sekmesi ────────────────────────────────────────────────────

function ScoreLogsTab() {
  const [logs, setLogs] = useState<ScoreLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingMany, setDeletingMany] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/logs?type=score");
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === logs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(logs.map(l => l.id)));
    }
  };

  const handleDeleteOne = async (id: string) => {
    setDeleting(id);
    try {
      await fetch("/api/admin/logs/delete-one", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "score" }),
      });
      setLogs(prev => prev.filter(l => l.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteMany = async () => {
    if (selected.size === 0) return;
    setDeletingMany(true);
    try {
      const ids = Array.from(selected);
      await fetch("/api/admin/logs/delete-many", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, type: "score" }),
      });
      setLogs(prev => prev.filter(l => !selected.has(l.id)));
      setSelected(new Set());
    } finally {
      setDeletingMany(false);
    }
  };

  const allSelected = logs.length > 0 && selected.size === logs.length;
  const someSelected = selected.size > 0 && !allSelected;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-surface-100 border-t-base-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-20 text-text-tertiary text-sm">
        Henüz puan log kaydı yok.
      </div>
    );
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-text-secondary">
            {selected.size} kayıt seçildi
          </span>
          <button
            onClick={handleDeleteMany}
            disabled={deletingMany}
            className="logs-delete-many-btn"
          >
            {deletingMany ? (
              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Seçilenleri Sil
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="logs-table">
          <thead>
            <tr>
              <th className="w-8">
                <button onClick={toggleAll} className="flex items-center justify-center text-text-tertiary hover:text-base-primary-600 transition-colors">
                  {allSelected ? (
                    <CheckSquare size={16} className="text-base-primary-500" />
                  ) : someSelected ? (
                    <Minus size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th>Tarih</th>
              <th>Öğrenci</th>
              <th>Eğitmen</th>
              <th>Ödev</th>
              <th>Puan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className={selected.has(log.id) ? "logs-row-selected" : ""}>
                <td>
                  <button
                    onClick={() => toggleOne(log.id)}
                    className="flex items-center justify-center text-text-tertiary hover:text-base-primary-600 transition-colors"
                  >
                    {selected.has(log.id) ? (
                      <CheckSquare size={16} className="text-base-primary-500" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </td>
                <td className="text-text-tertiary whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                <td className="font-medium text-base-primary-900">{log.studentName}</td>
                <td className="text-text-secondary">{log.teacherName}</td>
                <td className="text-text-secondary max-w-[200px] truncate">{log.taskName}</td>
                <td>
                  <span className="logs-badge logs-badge-points">{log.points} XP</span>
                </td>
                <td>
                  <button
                    onClick={() => handleDeleteOne(log.id)}
                    disabled={deleting === log.id}
                    className="logs-delete-btn"
                    title="Sil"
                  >
                    {deleting === log.id ? (
                      <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

type LogTab = "mail" | "score";

export default function LogsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<LogTab>("mail");
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        const hasAccess = data && (
          data.role === "admin" ||
          (data.roles && data.roles.includes("admin")) ||
          data.permissionOverrides?.MANAGEMENT_PANEL === true
        );
        if (hasAccess) {
          setIsAdmin(true);
        } else {
          router.push("/dashboard");
        }
      } catch {
        router.push("/dashboard");
      }
    };
    checkAdmin();
  }, [router]);

  if (isAdmin === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-base-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white font-inter overflow-hidden">
      <div className="h-full shrink-0"><Sidebar /></div>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header activeTabLabel="Logs" />
        <main className="flex-1 overflow-y-auto bg-surface-50/20 [scrollbar-gutter:stable]">
          <div className="w-full max-w-[1920px] mx-auto px-8 py-8">

            {/* Sekme Başlıkları */}
            <div className="border-b border-surface-200 mb-8">
              <nav className="flex items-center">
                {(["mail", "score"] as LogTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative h-12 flex items-center px-6 first:pl-0 cursor-pointer outline-none group transition-colors"
                  >
                    <span
                      className={`text-[15px] font-semibold tracking-tight whitespace-nowrap transition-colors ${
                        activeTab === tab
                          ? "text-base-primary-500"
                          : "text-text-tertiary hover:text-text-secondary"
                      }`}
                    >
                      {tab === "mail" ? "Mail Logs" : "Puan Logları"}
                    </span>
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-base-primary-500 rounded-t-full" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* İçerik */}
            <div className="logs-panel">
              {activeTab === "mail" && <MailLogsTab />}
              {activeTab === "score" && <ScoreLogsTab />}
            </div>

          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
