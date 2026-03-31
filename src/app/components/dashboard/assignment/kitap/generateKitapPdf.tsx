"use client";

import React from "react";
import {
  Document, Page, View, Text, StyleSheet, Font, pdf,
} from "@react-pdf/renderer";
import type { BookItem } from "../pool/poolTypes";

// ─── Font ─────────────────────────────────────────────────────────────────────

Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf",         fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmEU9vAw.ttf",     fontWeight: 400, fontStyle: "italic" },
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmWUlvAw.ttf",     fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOjCnqEu92Fr1Mu51TLABc9.ttf",   fontWeight: 700, fontStyle: "italic" },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface KitapPdfData {
  book: BookItem;
  deadline: string;
  paperWeight: number;
  paperThickness: string;
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingTop: 52,
    paddingBottom: 52,
    paddingLeft: 60,
    paddingRight: 60,
    fontFamily: "Roboto",
  },

  // Üst — numara
  bookId: {
    fontSize: 72,
    fontWeight: 700,
    color: "#111111",
    lineHeight: 1,
    marginBottom: 4,
  },

  // Başlık
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: "#111111",
    lineHeight: 1.15,
    marginBottom: 6,
  },

  // Yazar
  author: {
    fontSize: 13,
    fontWeight: 400,
    fontStyle: "italic",
    color: "#333333",
    marginBottom: 3,
  },

  // Yayınevi
  publisher: {
    fontSize: 11,
    fontWeight: 700,
    color: "#111111",
    marginBottom: 3,
  },

  // Tür
  genre: {
    fontSize: 10,
    fontStyle: "italic",
    color: "#666666",
    marginBottom: 20,
  },

  // Arka kapak paragrafı
  backCoverParagraph: {
    fontSize: 11,
    color: "#222222",
    lineHeight: 1.75,
    textAlign: "justify",
    marginBottom: 10,
  },

  // Yatay çizgi
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111111",
    marginTop: 24,
    marginBottom: 20,
  },

  // Teknik başlık
  specsHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: "#111111",
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Spec satırı
  specRow: {
    flexDirection: "row",
    marginBottom: 7,
  },
  specKey: {
    fontSize: 11,
    fontWeight: 700,
    color: "#111111",
    width: 120,
  },
  specColon: {
    fontSize: 11,
    color: "#111111",
    width: 18,
    textAlign: "center",
  },
  specVal: {
    fontSize: 11,
    color: "#111111",
    flex: 1,
  },

  // Teslim tarihi
  deadlineRow: {
    flexDirection: "row",
    marginTop: 20,
  },
  deadlineKey: {
    fontSize: 11,
    fontWeight: 700,
    color: "#111111",
  },
  deadlineVal: {
    fontSize: 11,
    color: "#111111",
  },
});

// ─── Yardımcı: metni satırlara böl ───────────────────────────────────────────

function splitParagraphs(text: string): string[] {
  return text.split(/\n+/).map(p => p.trim()).filter(Boolean);
}

// ─── PDF Bileşeni ─────────────────────────────────────────────────────────────

function KitapDocument({ data }: { data: KitapPdfData }) {
  const { book, deadline, paperWeight, paperThickness } = data;

  const genreText = [book.genre, book.subGenre].filter(Boolean).join(" / ");

  const specs: { key: string; val: string }[] = [
    ...(book.dimensions ? [{ key: "Kitap Ölçüsü",    val: book.dimensions }]              : []),
    ...(book.pageCount  ? [{ key: "Sayfa Sayısı",     val: `${book.pageCount} sayfa` }]   : []),
    { key: "Cilt Tipi",        val: "Amerikan Cilt" },
    { key: "Kağıt Gramajı",    val: `${paperWeight} gr.` },
    { key: "Yaprak Kalınlığı", val: paperThickness },
    ...(book.isbn       ? [{ key: "ISBN No",          val: book.isbn }]                   : []),
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Numara */}
        {book.bookId && <Text style={s.bookId}>{book.bookId}</Text>}

        {/* Başlık */}
        <Text style={s.title}>{book.title}</Text>

        {/* Yazar */}
        <Text style={s.author}>{book.author}</Text>

        {/* Yayınevi */}
        {book.publisher && <Text style={s.publisher}>{book.publisher}</Text>}

        {/* Tür */}
        {genreText ? <Text style={s.genre}>{genreText}</Text> : <View style={{ marginBottom: 20 }} />}

        {/* Arka kapak */}
        {splitParagraphs(book.backCover ?? "").map((para, i) => (
          <Text key={i} style={s.backCoverParagraph}>{para}</Text>
        ))}

        {/* Çizgi */}
        <View style={s.divider} />

        {/* Teknik Özellikler */}
        <Text style={s.specsHeader}>TEKNİK ÖZELLİKLER</Text>

        {specs.map(({ key, val }) => (
          <View key={key} style={s.specRow}>
            <Text style={s.specKey}>{key}</Text>
            <Text style={s.specColon}>:</Text>
            <Text style={s.specVal}>{val}</Text>
          </View>
        ))}

        {/* Teslim Tarihi */}
        <View style={s.deadlineRow}>
          <Text style={s.deadlineKey}>Teslim Tarihi: </Text>
          <Text style={s.deadlineVal}>{deadline}</Text>
        </View>

      </Page>
    </Document>
  );
}

// ─── Export: base64 string döndürür ──────────────────────────────────────────

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
