"use client";

// Canlıdaki `kitap/generateKitapPdf.tsx` ile birebir port — TEK fark: font Roboto
// yerine Inter (Kolaj Bahçesi portundaki 2026-07-07 kararıyla aynı gerekçe).
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font, pdf } from "@react-pdf/renderer";
import type { BookItem } from "./types";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrj72A.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrj72A.ttf", fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export interface KitapPdfData {
  book: BookItem;
  deadline: string;
  paperWeight: number;
  paperThickness: string;
}

const s = StyleSheet.create({
  page: { backgroundColor: "#ffffff", paddingTop: 52, paddingBottom: 52, paddingLeft: 60, paddingRight: 60, fontFamily: "Inter" },
  bookId: { fontSize: 72, fontFamily: "Inter", fontWeight: 700, color: "#111111", lineHeight: 1, marginBottom: 4 },
  title: { fontSize: 26, fontFamily: "Inter", fontWeight: 700, color: "#111111", lineHeight: 1.15, marginBottom: 6 },
  author: { fontSize: 13, fontFamily: "Inter", fontWeight: 400, color: "#333333", marginBottom: 3 },
  publisher: { fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: "#111111", marginBottom: 3 },
  genre: { fontSize: 10, fontFamily: "Inter", color: "#666666", marginBottom: 20 },
  backCoverParagraph: { fontSize: 11, fontFamily: "Inter", color: "#222222", lineHeight: 1.75, textAlign: "justify", marginBottom: 10 },
  divider: { borderBottomWidth: 1.5, borderBottomColor: "#111111", marginTop: 24, marginBottom: 20 },
  specsHeader: { fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: "#111111", letterSpacing: 0.5, marginBottom: 12 },
  specRow: { flexDirection: "row", marginBottom: 7 },
  specKey: { fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: "#111111", width: 120 },
  specColon: { fontSize: 11, fontFamily: "Inter", color: "#111111", width: 18, textAlign: "center" },
  specVal: { fontSize: 11, fontFamily: "Inter", color: "#111111", flex: 1 },
  deadlineRow: { flexDirection: "row", marginTop: 20 },
  deadlineKey: { fontSize: 11, fontFamily: "Inter", fontWeight: 700, color: "#111111" },
  deadlineVal: { fontSize: 11, fontFamily: "Inter", color: "#111111" },
});

function splitParagraphs(text: string): string[] {
  return text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
}

function KitapDocument({ data }: { data: KitapPdfData }) {
  const { book, deadline, paperWeight, paperThickness } = data;
  const genreText = [book.genre, book.subGenre].filter(Boolean).join(" / ");

  const specs: { key: string; val: string }[] = [
    ...(book.dimensions ? [{ key: "Kitap Ölçüsü", val: book.dimensions }] : []),
    ...(book.pageCount ? [{ key: "Sayfa Sayısı", val: `${book.pageCount} sayfa` }] : []),
    { key: "Cilt Tipi", val: "Amerikan Cilt" },
    { key: "Kağıt Gramajı", val: `${paperWeight} gr.` },
    { key: "Yaprak Kalınlığı", val: paperThickness },
    ...(book.isbn ? [{ key: "ISBN No", val: book.isbn }] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {book.bookId && <Text style={s.bookId}>{book.bookId}</Text>}
        <Text style={s.title}>{book.title}</Text>
        <Text style={s.author}>{book.author}</Text>
        {book.publisher && <Text style={s.publisher}>{book.publisher}</Text>}
        {genreText ? <Text style={s.genre}>{genreText}</Text> : <View style={{ marginBottom: 20 }} />}
        {splitParagraphs(book.backCover ?? "").map((para, i) => (
          <Text key={i} style={s.backCoverParagraph}>{para}</Text>
        ))}
        <View style={s.divider} />
        <Text style={s.specsHeader}>TEKNİK ÖZELLİKLER</Text>
        {specs.map(({ key, val }) => (
          <View key={key} style={s.specRow}>
            <Text style={s.specKey}>{key}</Text>
            <Text style={s.specColon}>:</Text>
            <Text style={s.specVal}>{val}</Text>
          </View>
        ))}
        <View style={s.deadlineRow}>
          <Text style={s.deadlineKey}>Teslim Tarihi: </Text>
          <Text style={s.deadlineVal}>{deadline}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateKitapPdf(data: KitapPdfData): Promise<string> {
  const blob = await pdf(<KitapDocument data={data} />).toBlob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
