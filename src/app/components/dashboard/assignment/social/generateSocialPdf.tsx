"use client";

import React from "react";
import { Document, Page, View, Text, StyleSheet, Font, pdf } from "@react-pdf/renderer";

// ─── Font ─────────────────────────────────────────────────────────────────────

Font.register({
  family: "Roboto",
  fonts: [
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf",       fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmEU9vAw.ttf",   fontWeight: 400, fontStyle: "italic" },
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmWUlvAw.ttf",   fontWeight: 700 },
    { src: "https://fonts.gstatic.com/s/roboto/v32/KFOjCnqEu92Fr1Mu51TLABc9.ttf", fontWeight: 700, fontStyle: "italic" },
  ],
});

Font.registerHyphenationCallback(word => [word]);

// ─── Veri tipi ────────────────────────────────────────────────────────────────

export interface SocialPdfData {
  studentName: string;   // "ALİ AYHAN"
  brandName: string;     // "Lassa"
  sektorDisplay: string; // "Otomotiv / Lastik ve Yedek Parça"
  brandRule: string;
  purpose: string;
  platform: string;
  contentType: string;   // "1080 x 1080 px (Kare Gönderi)"
  sharedRule: string;    // Yapılacaklar metni — satır satır
  date: string;          // "08.04.2026"
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const BLUE = "#1B5EBF";

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 56,
    paddingRight: 56,
    fontFamily: "Roboto",
  },

  // ── Başlık bloğu
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: BLUE,
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: 400,
    color: "#666666",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 28,
  },

  // ── Marka + sektör + öğrenci satırı
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  brandName: {
    fontSize: 20,
    fontWeight: 700,
    color: "#111111",
  },
  sektorText: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#555555",
    marginTop: 3,
  },
  studentLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111111",
    textAlign: "right",
  },

  // ── Tablo
  table: {
    borderWidth: 1,
    borderColor: "#cccccc",
    marginBottom: 24,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableCellKey: {
    width: 120,
    padding: "8 10",
    fontSize: 11,
    fontWeight: 700,
    color: "#111111",
    borderRightWidth: 1,
    borderRightColor: "#cccccc",
    backgroundColor: "#f9f9f9",
  },
  tableCellVal: {
    flex: 1,
    padding: "8 10",
    fontSize: 11,
    color: "#222222",
    lineHeight: 1.5,
  },

  // ── Yapılacaklar
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#111111",
    marginBottom: 8,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 5,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 11,
    color: "#333333",
    width: 14,
  },
  bulletText: {
    fontSize: 11,
    color: "#222222",
    flex: 1,
    lineHeight: 1.5,
  },

  // ── Divider + footer
  divider: {
    borderBottomWidth: 1.5,
    borderBottomColor: BLUE,
    marginTop: 24,
    marginBottom: 10,
  },
  footer: {
    fontSize: 10,
    color: "#888888",
    textAlign: "right",
  },
});

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function bulletLines(text: string): string[] {
  return text.split(/\n+/).map(l => l.trim()).filter(Boolean);
}

// ─── PDF bileşeni ─────────────────────────────────────────────────────────────

function SocialDocument({ d }: { d: SocialPdfData }) {
  const tableRows: { key: string; val: string }[] = [
    { key: "Marka Kuralı",  val: d.brandRule   || "—" },
    { key: "Amaç / Hedef",  val: d.purpose     || "—" },
    { key: "Platform",      val: d.platform    || "—" },
    { key: "İçerik Türü",   val: d.contentType || "—" },
  ];

  const lines = bulletLines(d.sharedRule);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Başlık */}
        <Text style={s.headerTitle}>SOSYAL MEDYA YÖNETİMİ</Text>
        <Text style={s.headerSub}>ÖDEV KARTI</Text>

        {/* Marka + öğrenci */}
        <View style={s.topRow}>
          <View>
            <Text style={s.brandName}>Marka: {d.brandName}</Text>
            <Text style={s.sektorText}>Sektör: {d.sektorDisplay}</Text>
          </View>
          <Text style={s.studentLabel}>Öğrenci: {d.studentName}</Text>
        </View>

        {/* Tablo */}
        <View style={s.table}>
          {tableRows.map((row, i) => (
            <View key={row.key} style={i < tableRows.length - 1 ? s.tableRow : s.tableRowLast}>
              <Text style={s.tableCellKey}>{row.key}</Text>
              <Text style={s.tableCellVal}>{row.val}</Text>
            </View>
          ))}
        </View>

        {/* Yapılacaklar */}
        {lines.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>✎ Yapılacaklar:</Text>
            {lines.map((line, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Divider + tarih */}
        <View style={s.divider} />
        <Text style={s.footer}>Oluşturulma Tarihi: {d.date}</Text>

      </Page>
    </Document>
  );
}

// ─── Export: base64 string döndürür ──────────────────────────────────────────

export async function generateSocialPdf(data: SocialPdfData): Promise<string> {
  const blob = await pdf(<SocialDocument d={data} />).toBlob();
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
