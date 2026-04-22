"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import type { CommentAuthorType } from "@/app/types/submission";

interface Props {
  authorType: CommentAuthorType;
  onSend: (text: string) => Promise<void>;
}

export default function CommentInput({ authorType, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border border-surface-200 rounded-2xl bg-white overflow-hidden focus-within:border-base-primary-400 focus-within:ring-2 focus-within:ring-base-primary-100 transition-all">
      {/* Author badge */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold
          ${authorType === "teacher"
            ? "bg-base-primary-50 text-base-primary-600 border border-base-primary-100"
            : "bg-surface-100 text-surface-600 border border-surface-200"
          }`}>
          {authorType === "teacher" ? "Eğitmen" : "Öğrenci"}
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Yorum yaz... (Ctrl+Enter ile gönder)"
        rows={3}
        className="w-full px-4 py-3 text-[14px] text-text-primary placeholder:text-surface-400 resize-none outline-none bg-transparent"
      />

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <p className="text-[11px] text-surface-400">Ctrl+Enter ile gönder</p>
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex items-center gap-2 px-4 py-2 bg-base-primary-600 text-white rounded-xl text-[13px] font-bold
            hover:bg-base-primary-700 active:scale-95 transition-all cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Gönder
        </button>
      </div>
    </div>
  );
}
