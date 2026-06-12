'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, CalendarCheck, ClipboardList,
  ChevronRight, Command, Zap, Star, BarChart2, LayoutDashboard,
} from 'lucide-react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '@/app/context/UserContext';
import StudentDetailModal, { type ModalStudent } from '@/app/components/dashboard/student-management/StudentDetailModal';

// ─── Sabit Aksiyon Kataloğu ───────────────────────────────────────────────────

interface StaticAction {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  keywords: string[];
  icon: React.ReactNode;
}

const STATIC_ACTIONS: StaticAction[] = [
  {
    id: 'attend',
    title: 'Yoklama Al',
    subtitle: 'Yoklama sayfasını aç',
    path: '/attend',
    keywords: ['yoklama', 'al', 'devam', 'ders', 'derse'],
    icon: <CalendarCheck size={13} strokeWidth={2.2} />,
  },
  {
    id: 'assignment',
    title: 'Ödev Yönetimi',
    subtitle: 'Ödev ve teslim sayfası',
    path: '/dashboard/assignment',
    keywords: ['ödev', 'teslim', 'proje', 'assignment'],
    icon: <ClipboardList size={13} strokeWidth={2.2} />,
  },
  {
    id: 'grading',
    title: 'Not Gir',
    subtitle: 'Not girme ve değerlendirme',
    path: '/dashboard/grading',
    keywords: ['not', 'gir', 'değerlendir', 'puan', 'grade', 'sertifika'],
    icon: <Star size={13} strokeWidth={2.2} />,
  },
  {
    id: 'report',
    title: 'Yoklama Raporu',
    subtitle: 'Devam raporlarını görüntüle',
    path: '/dashboard/attendance-report',
    keywords: ['rapor', 'report', 'devam', 'istatistik'],
    icon: <BarChart2 size={13} strokeWidth={2.2} />,
  },
  {
    id: 'dashboard',
    title: 'Ana Sayfa',
    subtitle: 'Dashboard',
    path: '/dashboard',
    keywords: ['ana', 'anasayfa', 'dashboard', 'home', 'sayfa'],
    icon: <LayoutDashboard size={13} strokeWidth={2.2} />,
  },
];

// Grup + keyword → bağlamsal aksiyon
interface GroupAction {
  title: string;
  subtitle: string;
  path: string;
  keyword: string;      // hangi kelimeyle eşleşti
  groupCode: string;
}

function buildGroupActions(groupId: string, groupCode: string): Array<GroupAction & { id: string }> {
  const label = groupCode.toLowerCase().startsWith('grup') ? groupCode : `Grup ${groupCode}`;
  return [
    {
      id: `attend-${groupId}`,
      title: `${label} — Yoklama Al`,
      subtitle: 'Yoklama sayfasına git',
      path: `/attend?groupId=${groupId}`,
      keyword: 'yoklama',
      groupCode,
    },
    {
      id: `assignment-${groupId}`,
      title: `${label} — Ödev Teslim`,
      subtitle: 'Grubun ödev sayfasına git',
      path: `/dashboard/assignment/${groupId}`,
      keyword: 'ödev',
      groupCode,
    },
    {
      id: `grading-${groupId}`,
      title: `${label} — Not Gir`,
      subtitle: 'Not girme sayfasına git',
      path: `/dashboard/grading?groupId=${groupId}`,
      keyword: 'not',
      groupCode,
    },
    {
      id: `report-${groupId}`,
      title: `${label} — Rapor`,
      subtitle: 'Yoklama raporunu görüntüle',
      path: `/dashboard/attendance-report?groupId=${groupId}`,
      keyword: 'rapor',
      groupCode,
    },
  ];
}

// ─── Sonuç Tipleri ────────────────────────────────────────────────────────────

type ResultType = 'action' | 'group' | 'student';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  path?: string;
  raw?: Record<string, unknown>;
}

const TYPE_CONFIG: Record<ResultType, { label: string; color: string; bg: string }> = {
  action:  { label: 'Hızlı Aksiyon', color: 'text-[#059669]', bg: 'bg-[#ECFDF5]' },
  group:   { label: 'Gruplar',        color: 'text-[#10294C]', bg: 'bg-[#E8ECF2]' },
  student: { label: 'Öğrenciler',     color: 'text-[#3A7BD5]', bg: 'bg-[#EEF4FD]' },
};

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  action:  <Zap size={13} strokeWidth={2.2} />,
  group:   <CalendarCheck size={13} strokeWidth={2.2} />,
  student: <Users size={13} strokeWidth={2.2} />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuickSearch() {
  const [open, setOpen]               = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allGroups, setAllGroups]     = useState<{ id: string; code: string; branch: string }[]>([]);
  const [allStudents, setAllStudents] = useState<SearchResult[]>([]);
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openStudent, setOpenStudent] = useState<ModalStudent | null>(null);
  const [settled, setSettled]         = useState(false); // sonuç kesinleşti mi

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router   = useRouter();
  const { user, isAdmin } = useUser();

  // ── Ctrl+K / Cmd+K ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── ESC ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // ── Focus + veri çekme ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
      if (allGroups.length === 0) fetchData();
    } else {
      setSearchQuery('');
      setDebouncedQuery('');
      setResults([]);
      setSelectedIndex(0);
      setSettled(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Veri çekme ──────────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      // Gruplar
      const groupsSnap = await getDocs(
        isAdmin()
          ? query(collection(db, 'groups'), where('status', '!=', 'archived'))
          : query(collection(db, 'groups'),
              where('instructorId', '==', user.uid),
              where('status', '!=', 'archived'))
      );

      const groups: { id: string; code: string; branch: string }[] = [];
      const groupCodeMap: Record<string, string> = {};
      const groupIds: string[] = [];

      groupsSnap.forEach(d => {
        const g = d.data();
        const code = String(g.code ?? d.id);
        groups.push({ id: d.id, code, branch: g.branch ?? '' });
        groupCodeMap[d.id] = code;
        groupIds.push(d.id);
      });

      setAllGroups(groups);

      // Öğrenciler
      const students: SearchResult[] = [];
      for (let i = 0; i < groupIds.length; i += 10) {
        const chunk = groupIds.slice(i, i + 10);
        const snap = await getDocs(
          query(collection(db, 'students'), where('groupId', 'in', chunk))
        );
        snap.forEach(d => {
          const s = d.data();
          students.push({
            id:   d.id,
            type: 'student',
            title:    `${s.name ?? ''} ${s.lastName ?? ''}`.trim(),
            subtitle: `Grup ${groupCodeMap[s.groupId] ?? s.groupId ?? ''}`,
            raw: {
              name:      s.name,
              lastName:  s.lastName,
              branch:    s.branch,
              gender:    s.gender,
              avatarId:  s.avatarId,
              points:    s.points,
              groupCode: groupCodeMap[s.groupId],
            },
          });
        });
      }
      setAllStudents(students);
    } finally {
      setLoading(false);
    }
  };

  // ── Debounce: searchQuery → debouncedQuery (200ms) ──────────────────────────
  useEffect(() => {
    setSettled(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setSettled(true);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // ── Akıllı arama & sıralama ─────────────────────────────────────────────────
  useEffect(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) { setResults([]); setSelectedIndex(0); return; }

    const tokens = q.split(/\s+/);
    const hasNumber = /\d/.test(q);

    // 1 — Eşleşen gruplar
    const matchedGroups = allGroups.filter(g =>
      g.code.toLowerCase().includes(q) ||
      tokens.some(t => g.code.toLowerCase().includes(t)) ||
      g.branch.toLowerCase().includes(q)
    );

    // 2 — Bağlamsal aksiyonlar (grup + keyword)
    const contextualActions: SearchResult[] = [];
    if (matchedGroups.length > 0) {
      const primaryGroup = matchedGroups[0];
      const groupActions = buildGroupActions(primaryGroup.id, primaryGroup.code);
      groupActions.forEach(a => {
        if (tokens.some(t => a.keyword.includes(t) || a.title.toLowerCase().includes(t))) {
          contextualActions.push({
            id:       a.id,
            type:     'action',
            title:    a.title,
            subtitle: a.subtitle,
            path:     a.path,
          });
        }
      });
    }

    // 3 — Statik aksiyon eşleşmeleri
    const staticActions: SearchResult[] = STATIC_ACTIONS
      .filter(a =>
        tokens.some(t =>
          a.keywords.some(k => k.includes(t)) ||
          a.title.toLowerCase().includes(t)
        )
      )
      .map(a => ({
        id:       a.id,
        type:     'action' as ResultType,
        title:    a.title,
        subtitle: a.subtitle,
        path:     a.path,
      }));

    // Bağlamsal + statik birleştir, tekrar yok
    const seenActionIds = new Set(contextualActions.map(a => a.id));
    const allActions = [
      ...contextualActions,
      ...staticActions.filter(a => !seenActionIds.has(a.id)),
    ].slice(0, 3);

    // 4 — Grup sonuçları
    const groupResults: SearchResult[] = matchedGroups.slice(0, 3).map(g => ({
      id:       g.id,
      type:     'group' as ResultType,
      title:    g.code.toLowerCase().startsWith('grup') ? g.code : `Grup ${g.code}`,
      subtitle: g.branch,
      path:     `/dashboard/management?group=${g.id}`,
    }));

    // 5 — Öğrenci sonuçları
    const studentResults: SearchResult[] = allStudents
      .filter(s =>
        s.title.toLowerCase().includes(q) ||
        tokens.every(t => s.title.toLowerCase().includes(t))
      )
      .slice(0, 4);

    // 6 — Sıralama: sayı varsa grup önce, değilse aksiyon önce
    let ordered: SearchResult[];
    if (hasNumber && matchedGroups.length > 0 && allActions.length === 0) {
      // Sadece grup kodu yazıldı → grup, öğrenci, aksiyon
      ordered = [...groupResults, ...studentResults, ...allActions];
    } else {
      // Keyword var veya karma → aksiyon, grup, öğrenci
      ordered = [...allActions, ...groupResults, ...studentResults];
    }

    setResults(ordered.slice(0, 8));
    setSelectedIndex(0);
  }, [debouncedQuery, allGroups, allStudents]);

  // ── Klavye navigasyonu ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, selectedIndex]);

  // ── Seçim ───────────────────────────────────────────────────────────────────
  const handleSelect = (item: SearchResult) => {
    if (item.type === 'student') {
      const r = item.raw ?? {};
      setOpenStudent({
        id:        item.id,
        name:      (r.name as string)      ?? '',
        lastName:  (r.lastName as string)  ?? '',
        rank:      0,
        score:     (r.points as number)    ?? 0,
        branch:    (r.branch as string)    ?? '',
        gender:    (r.gender as string)    ?? 'erkek',
        avatarId:  (r.avatarId as number)  ?? 1,
        groupCode: (r.groupCode as string) ?? '',
      });
      setOpen(false);
    } else if (item.path) {
      setOpen(false);
      router.push(item.path);
    }
  };

  // Kategorilere göre grupla (başlık göstermek için)
  const DISPLAY_ORDER: ResultType[] = ['action', 'group', 'student'];
  const grouped = DISPLAY_ORDER
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="qs-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] flex items-start justify-center pt-[18vh]"
            style={{ background: 'rgba(0,0,0,0.44)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              key="qs-panel"
              initial={{ opacity: 0, scale: 0.97, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="w-[720px] shadow-2xl overflow-hidden rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Arama ── */}
              <div className="flex items-center gap-3 px-6 py-5">
                {loading
                  ? <div className="w-[18px] h-[18px] rounded-full border-2 border-[#E8ECF2] border-t-[#10294C] animate-spin shrink-0" />
                  : <Search size={18} className="text-[#9CA3AF] shrink-0" strokeWidth={2} />
                }
                <input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Flex Hızlı Arama"
                  className="flex-1 text-[18px] text-[#10294C] placeholder:text-[#8B95A5] outline-none bg-transparent font-medium"
                />
                <kbd className="flex items-center text-[10px] text-[#B0B8C4] bg-[#F4F6F9] px-2 py-1 rounded-md font-medium shrink-0">
                  ESC
                </kbd>
              </div>

              {/* ── Sonuçlar ── */}
              <AnimatePresence mode="wait">
                {results.length > 0 && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#F0F2F6] max-h-[400px] overflow-y-auto">
                      {grouped.map(({ type, items }) => {
                        const cfg = TYPE_CONFIG[type];
                        return (
                          <div key={type} className="pb-1">
                            <div className="px-5 pt-3 pb-1">
                              <span className="text-[10px] font-bold text-[#B0B8C4] tracking-widest uppercase">
                                {cfg.label}
                              </span>
                            </div>
                            {items.map(item => {
                              const idx = results.indexOf(item);
                              const isSelected = idx === selectedIndex;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => handleSelect(item)}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                  className={`w-full flex items-center gap-3 px-5 py-2.5 transition-colors cursor-pointer
                                    ${isSelected ? 'bg-[#F0F4FA]' : 'hover:bg-[#F9FAFB]'}`}
                                >
                                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}>
                                    {TYPE_ICON[type]}
                                  </div>
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-[13px] font-semibold text-[#10294C] truncate leading-snug">
                                      {item.title}
                                    </p>
                                    {item.subtitle && (
                                      <p className="text-[11px] text-[#9CA3AF] truncate leading-snug">
                                        {item.subtitle}
                                      </p>
                                    )}
                                  </div>
                                  <ChevronRight
                                    size={14}
                                    className={`shrink-0 transition-opacity ${isSelected ? 'text-[#9CA3AF] opacity-100' : 'opacity-0'}`}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Alt Çubuk ── */}
                    <div className="flex items-center gap-4 px-5 py-2.5 border-t border-[#F0F2F6] bg-[#FAFBFC]">
                      <Hint keys={['↵']} label="seç" />
                      <Hint keys={['↑', '↓']} label="gezin" />
                      <Hint keys={['esc']} label="kapat" />
                      <div className="ml-auto flex items-center gap-1 text-[10px] text-[#C4C9D4]">
                        <Command size={10} /><span>K</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Sonuç yok — sadece debounce kesinleştikten sonra göster */}
                {!loading && settled && debouncedQuery && results.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#F0F2F6] flex flex-col items-center justify-center py-10 gap-1.5">
                      <p className="text-[13px] text-[#9CA3AF] font-medium">Sonuç bulunamadı</p>
                      <p className="text-[11px] text-[#C4C9D4]">&ldquo;{debouncedQuery}&rdquo; için eşleşme yok</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Global Öğrenci Kartı ── */}
      <StudentDetailModal
        student={openStudent}
        isOpen={!!openStudent}
        onClose={() => setOpenStudent(null)}
        prefetchStudentId={openStudent?.id}
      />
    </>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-[#C4C9D4]">
      <span className="flex gap-0.5">
        {keys.map(k => (
          <kbd key={k} className="bg-white border border-[#E8ECF2] rounded px-1.5 py-0.5 text-[9px] font-semibold text-[#9CA3AF]">
            {k}
          </kbd>
        ))}
      </span>
      {label}
    </span>
  );
}
