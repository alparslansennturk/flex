"use client";
import React, { useState } from "react";
import { Plus, Trash2, GitBranch, Users, Clock } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

interface Branch { id: string; name: string; slug: string; sessionHours?: number; }

export const BranchManagement = ({ branches, users }: { branches: Branch[]; users: { branches?: string[] }[] }) => {
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const slugify = (t: string) =>
        t.toLowerCase()
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const instructorCount = (id: string) =>
        users.filter(u => Array.isArray(u.branches) && u.branches.includes(id)).length;

    const handleAdd = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const slug = slugify(trimmed);
        if (branches.some(b => b.slug === slug)) { setError("Bu branş zaten mevcut."); return; }
        setLoading(true);
        try {
            await addDoc(collection(db, "branches"), { name: trimmed, slug, createdAt: serverTimestamp() });
            setName(""); setError("");
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleUpdateHours = async (b: Branch, hours: number) => {
        if (isNaN(hours) || hours < 1) return;
        await updateDoc(doc(db, "branches", b.id), { sessionHours: hours });
    };

    const handleDelete = async (b: Branch) => {
        const count = instructorCount(b.id);
        if (count > 0) { setError(`"${b.name}" branşına ${count} eğitmen bağlı. Önce eğitmenleri ayırın.`); return; }
        setError("");
        await deleteDoc(doc(db, "branches", b.id));
    };

    return (
        <div className="mt-6 space-y-6">

            {/* Add branch row */}
            <div className="flex gap-3 items-end">
                <div className="space-y-1.5 flex-1 max-w-sm">
                    <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide ml-0.5">Yeni Branş</label>
                    <input
                        value={name}
                        onChange={e => { setName(e.target.value); setError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleAdd()}
                        placeholder="Örn: Yazılım"
                        className="h-11 w-full border border-neutral-200 bg-white rounded-xl px-4 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 font-semibold text-[14px] text-[#10294C] placeholder:font-normal placeholder:text-neutral-400 transition-all"
                    />
                </div>
                <button
                    onClick={handleAdd}
                    disabled={loading || !name.trim()}
                    className="h-11 px-5 bg-orange-500 text-white rounded-xl font-bold text-[13px] flex items-center gap-2 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                    <Plus size={15} /><span>Ekle</span>
                </button>
            </div>

            {error && <p className="text-[12px] font-bold text-red-500">{error}</p>}

            {branches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-300">
                    <GitBranch size={44} strokeWidth={1} />
                    <p className="mt-4 font-bold text-[14px]">Henüz branş eklenmedi</p>
                    <p className="text-[12px] mt-1 text-neutral-400">Yukarıdan yeni bir branş ekleyebilirsiniz.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {branches.map(b => {
                        const count = instructorCount(b.id);
                        return (
                            <div key={b.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">

                                {/* Card header */}
                                <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-[16px] text-[#10294C] leading-tight truncate">{b.name}</p>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
                                                ${count > 0 ? "bg-indigo-50 text-indigo-600" : "bg-neutral-100 text-neutral-400"}`}>
                                                <Users size={10} />
                                                {count} eğitmen
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(b)}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Session hours */}
                                <div className="px-5 pb-5 border-t border-neutral-100 pt-4">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                        <Clock size={10} />
                                        Ders Süresi
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number" min={1} max={12}
                                            defaultValue={b.sessionHours ?? ""}
                                            placeholder="—"
                                            onBlur={e => handleUpdateHours(b, parseInt(e.target.value, 10))}
                                            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                            className="w-16 h-9 text-center text-[14px] font-bold text-[#10294C] border border-neutral-200 rounded-lg outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 transition-all bg-neutral-50 focus:bg-white"
                                        />
                                        <span className="text-[13px] font-medium text-neutral-500">saat / ders</span>
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
