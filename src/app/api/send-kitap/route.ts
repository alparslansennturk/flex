import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/app/lib/email";

interface BookItem {
  title: string;
  author: string;
  publisher?: string;
  genre?: string;
  subGenre?: string;
  dimensions?: string;
  pageCount?: number;
  isbn?: string;
  backCover?: string;
}

interface KitapMailRequest {
  to: string;
  studentName: string;
  studentLastName: string;
  taskName: string;
  book: BookItem;
  deadline: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: KitapMailRequest = await req.json();
    const { to, studentName, studentLastName, taskName, book, deadline } = body;

    if (!to || !book) {
      return NextResponse.json({ error: "Eksik parametre." }, { status: 400 });
    }

    const specsRows = [
      book.dimensions && `<tr><td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">Kitap Ölçüsü</td><td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111">${book.dimensions}</td></tr>`,
      book.pageCount  && `<tr><td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280">Sayfa Sayısı</td><td style="padding:8px 16px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:#111">${book.pageCount} sf</td></tr>`,
      book.isbn       && `<tr><td style="padding:8px 16px;font-size:13px;color:#6b7280">ISBN No</td><td style="padding:8px 16px;font-size:13px;font-weight:700;color:#111">${book.isbn}</td></tr>`,
    ].filter(Boolean).join("");

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:40px 32px">
        <h2 style="font-size:22px;font-weight:900;color:#111;margin:0 0 4px">Kitap Dünyası 📚</h2>
        <p style="font-size:13px;color:#9ca3af;margin:0 0 24px">${taskName} · Ödev Sonuçları</p>

        <p style="font-size:15px;font-weight:700;color:#111;margin:0 0 8px">
          Merhaba ${studentName} ${studentLastName},
        </p>
        <p style="font-size:14px;color:#374151;margin:0 0 24px;line-height:1.6">
          Kitap çekilişinde sana atanan kitap aşağıda yer alıyor. Kitap kapağı ödevini belirtilen tarihe kadar teslim etmeyi unutma!
        </p>

        <div style="background:#eff6ff;border-radius:14px;padding:24px;margin-bottom:20px;border:1px solid #bfdbfe">
          <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#93c5fd;margin:0 0 10px">Atanan Kitap</p>
          <p style="font-size:22px;font-weight:900;color:#1d4ed8;margin:0 0 5px;line-height:1.2">${book.title}</p>
          <p style="font-size:14px;font-style:italic;color:#475569;margin:0 0 2px">${book.author}</p>
          ${book.publisher ? `<p style="font-size:12px;color:#94a3b8;margin:0">${book.publisher}</p>` : ""}
          ${book.genre ? `<p style="font-size:12px;color:#3b82f6;font-weight:700;margin:8px 0 0">${book.genre}${book.subGenre ? ` · ${book.subGenre}` : ""}</p>` : ""}
        </div>

        ${book.backCover ? `
        <div style="margin-bottom:20px">
          <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin:0 0 10px">Arka Kapak</p>
          <p style="font-size:13px;color:#374151;line-height:1.8;white-space:pre-wrap">${book.backCover}</p>
        </div>` : ""}

        ${specsRows ? `
        <div style="margin-bottom:20px">
          <p style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin:0 0 10px">Teknik Özellikler</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
            <tbody>${specsRows}</tbody>
          </table>
        </div>` : ""}

        <p style="font-size:12px;color:#d1d5db;margin-top:28px">Teslim Tarihi: ${deadline}</p>
      </div>`;

    const result = await sendMail({
      to,
      subject: `Kitap Kapağı Ödevin — ${book.title}`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-kitap] Hata:", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
