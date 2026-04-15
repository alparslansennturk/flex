"use client";

import { useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import type { Comment, CommentAuthorType } from "@/app/types/submission";

interface CommentSectionProps {
  comments:          Comment[];
  loading?:          boolean;
  currentAuthorId:   string;
  currentAuthorType: CommentAuthorType;
  currentAuthorName: string;
  onAddComment:      (body: string) => Promise<void>;
  disabled?:         boolean;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date));
}

export default function CommentSection({
  comments,
  loading,
  currentAuthorId,
  currentAuthorType,
  currentAuthorName,
  onAddComment,
  disabled,
}: CommentSectionProps) {
  const [body, setBody]       = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAddComment(body.trim());
      setBody("");
    } catch {
      setError("Yorum gönderilemedi. Tekrar dene.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Başlık */}
      <div className="flex items-center gap-2">
        <MessageCircle size={14} className="text-surface-400" />
        <span className="text-[12px] font-bold text-surface-500 uppercase tracking-wide">
          Yorumlar {comments.length > 0 && `(${comments.length})`}
        </span>
      </div>

      {/* Yorum listesi */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-surface-100 animate-pulse" />)}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-surface-400 text-center py-4">Henüz yorum yok</p>
      ) : (
        <div className="space-y-2">
          {comments.map(c => {
            const isOwn     = c.authorId === currentAuthorId;
            const isTeacher = c.authorType === "teacher";
            return (
              <div
                key={c.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar baş harfi */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black ${
                  isTeacher
                    ? "bg-accent-purple-100 text-accent-purple-700"
                    : "bg-base-primary-100 text-base-primary-700"
                }`}>
                  {c.authorName.charAt(0).toUpperCase()}
                </div>

                {/* Balon */}
                <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-surface-600">{c.authorName}</span>
                    {isTeacher && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-purple-100 text-accent-purple-700">
                        Eğitmen
                      </span>
                    )}
                    <span className="text-[10px] text-surface-400">{formatDate(c.createdAt)}</span>
                  </div>
                  <div className={`px-3 py-2 rounded-xl text-[13px] text-base-primary-900 ${
                    isOwn
                      ? "bg-base-primary-900 text-white rounded-tr-sm"
                      : "bg-surface-100 rounded-tl-sm"
                  }`}>
                    {c.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Yorum girişi */}
      {!disabled && (
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
            placeholder="Yorum yaz… (Enter ile gönder)"
            rows={2}
            className="flex-1 px-3 py-2.5 rounded-xl border border-surface-200 bg-surface-50 text-[13px] text-base-primary-900 placeholder:text-surface-300 outline-none focus:border-base-primary-400 focus:bg-white resize-none transition-all"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="w-9 h-9 rounded-xl bg-base-primary-900 text-white flex items-center justify-center hover:bg-base-primary-800 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {sending
              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send size={13} />
            }
          </button>
        </form>
      )}

      {error && <p className="text-[12px] text-status-danger-500">{error}</p>}
    </div>
  );
}
