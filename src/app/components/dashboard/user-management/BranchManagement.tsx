"use client";
import React, { useState } from "react";
import { Plus, Trash2, GitBranch, Users } from "lucide-react";
import { db } from "@/app/lib/firebase";
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

interface Branch { id: string; name: string; slug: string; }

export const BranchManagement = ({ branches, users }: { branches: Branch[]; users: any[] }) => {
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

    const handleDelete = async (b: Branch) => {
        const count = instructorCount(b.id);
        if (count > 0) { setError(`"${b.name}" branşına ${count} eğitmen bağlı. Önce eğitmenleri ayırın.`); return; }
        setError("");
        await deleteDoc(doc(db, "branches", b.id));
    };

    return (
        <div className="mt-8 space-y-6">
            <div className="flex gap-3 items-end">
                <div className="space-y-1 flex-1 max-w-xs">
                    <label className="text-[12px] font-bold text-neutral-500 ml-1">Yeni Branş</label>
                    <input
                        value={name}
                        onChange={e => { setName(e.target.value); setError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleAdd()}
                        placeholder="Örn: Yazılım"
                        className="h-12 w-full border border-neutral-200 bg-neutral-50 rounded-xl px-4 outline-none focus:border-orange-500 font-bold text-[#10294C] placeholder:font-normal placeholder:text-neutral-400 transition-all"
                    />
                </div>
                <button
                    onClick={handleAdd}
                    disabled={loading || !name.trim()}
                    className="h-12 px-6 bg-orange-500 text-white rounded-xl font-bold text-[14px] flex items-center gap-2 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                >
                    <Plus size={16} /><span>Ekle</span>
                </button>
            </div>

            {error && <p className="text-[13px] font-bold text-red-500">{error}</p>}

            {branches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-300">
                    <GitBranch size={52} strokeWidth={1} />
                    <p className="mt-4 font-bold text-[15px]">Henüz branş eklenmedi</p>
                    <p className="text-[13px] mt-1">Yukarıdan yeni bir branş ekleyebilirsiniz.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {branches.map(b => {
                        const count = instructorCount(b.id);
                        return (
                            <div key={b.id} className="bg-white border border-neutral-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group">
                                <div>
                                    <p className="font-bold text-[15px] text-[#10294C]">{b.name}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5 text-neutral-400">
                                        <Users size={12} />
                                        <span className="text-[12px] font-medium">{count} eğitmen</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(b)}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
