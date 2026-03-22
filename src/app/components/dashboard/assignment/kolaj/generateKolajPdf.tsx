"use client";

import React from "react";
import {
  Document, Page, View, Text, StyleSheet, Font, pdf,
} from "@react-pdf/renderer";

// ─── Font (Türkçe karakter desteği) ───────────────────────────────────────────

Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmWUlvAw.ttf",
      fontWeight: 700,
    },
  ],
});

// Hecelemeyi kapat — kelime bölünmesini engeller
Font.registerHyphenationCallback((word) => [word]);

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface DrawResult {
  category: string;
  item: { name: string; emoji?: string; color?: string };
}

interface KolajPdfData {
  studentName: string;
  studentLastName: string;
  taskName: string;
  draws: DrawResult[];
  deadline: string;
}

const CARD_COLORS = ["#3a7bd5", "#689adf", "#5a9ed5", "#4a84c4"];
const CARD_LIGHT  = ["#e8f0fb", "#eaf1fc", "#e8f2fb", "#e6eff9"];

// ─── Stiller ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: "#f0f4f8",
  },

  // Sol koyu panel
  sidebar: {
    width: 210,
    backgroundColor: "#060D1A",
    padding: "36 28",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  sidebarTop: { flexDirection: "column" },
  eyebrow: {
    fontSize: 7,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#689adf",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  titleLine1: {
    fontSize: 26,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: -0.5,
    lineHeight: 1.05,
  },
  titleLine2: {
    fontSize: 26,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#689adf",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  taskName: {
    fontSize: 10,
    fontFamily: "Roboto",
    fontWeight: 400,
    color: "rgba(255,255,255,0.38)",
    marginBottom: 28,
  },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3a7bd5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarInitials: {
    fontSize: 16,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#ffffff",
  },
  studentName: {
    fontSize: 15,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: -0.3,
    lineHeight: 1.2,
  },
  studentLastName: {
    fontSize: 15,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#689adf",
    letterSpacing: -0.3,
  },
  sidebarBottom: { flexDirection: "column" },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 14,
    marginBottom: 14,
  },
  deadlineLabel: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  deadlineValue: {
    fontSize: 14,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#ffffff",
  },
  successBanner: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    padding: "10 12",
  },
  successText: {
    fontSize: 11,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#ffffff",
  },
  successSub: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: 400,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    lineHeight: 1.4,
  },

  // Sağ içerik
  content: {
    flex: 1,
    padding: "36 32",
    flexDirection: "column",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: "row",
  },

  // Kart wrapper — margin ile aralık
  cardWrapper: {
    flex: 1,
    marginRight: 12,
  },
  cardWrapperLast: {
    flex: 1,
  },
  cardNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  cardNumText: {
    fontSize: 10,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#ffffff",
  },
  cardInner: {
    borderRadius: 12,
    borderBottomWidth: 5,
    padding: "18 10 18",
    alignItems: "center",
    flexDirection: "column",
    minHeight: 155,
  },
  cardCat: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Roboto",
    fontWeight: 700,
    color: "#1e293b",
    textAlign: "center",
    lineHeight: 1.25,
  },
});

// ─── Bileşen ──────────────────────────────────────────────────────────────────

function KolajDocument({ data }: { data: KolajPdfData }) {
  const lastIdx = data.draws.length - 1;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Sol panel */}
        <View style={s.sidebar}>
          <View style={s.sidebarTop}>
            <Text style={s.eyebrow}>Tasarım Atölyesi</Text>
            <Text style={s.titleLine1}>Kolaj</Text>
            <Text style={s.titleLine2}>Bahçesi</Text>
            <Text style={s.taskName}>{data.taskName}</Text>

            <View style={s.avatarRow}>
              <View style={s.avatar}>
                <Text style={s.avatarInitials}>
                  {data.studentName[0]}{data.studentLastName[0]}
                </Text>
              </View>
              <View>
                <Text style={s.studentName}>{data.studentName}</Text>
                <Text style={s.studentLastName}>{data.studentLastName}</Text>
              </View>
            </View>
          </View>

          <View style={s.sidebarBottom}>
            <View style={s.divider}>
              <Text style={s.deadlineLabel}>Teslim Tarihi</Text>
              <Text style={s.deadlineValue}>{data.deadline}</Text>
            </View>
            <View style={s.successBanner}>
              <Text style={s.successText}>Başarılar!</Text>
              <Text style={s.successSub}>
                Materyallerini kullanarak{"\n"}kolajını oluştur ve teslim et.
              </Text>
            </View>
          </View>
        </View>

        {/* Sağ içerik */}
        <View style={s.content}>
          <Text style={s.sectionLabel}>Çekilen Materyaller</Text>

          <View style={s.cardsRow}>
            {data.draws.map((dr, i) => (
              <View key={i} style={i === lastIdx ? s.cardWrapperLast : s.cardWrapper}>
                <View style={[s.cardInner, {
                  backgroundColor: CARD_LIGHT[i % 4],
                  borderBottomColor: CARD_COLORS[i % 4],
                }]}>
                  {/* Numara balonu kartın içinde, normal flow */}
                  <View style={[s.cardNumCircle, { backgroundColor: CARD_COLORS[i % 4] }]}>
                    <Text style={s.cardNumText}>{i + 1}</Text>
                  </View>

                  <Text style={[s.cardCat, { color: CARD_COLORS[i % 4] }]}>
                    {dr.category}
                  </Text>
                  <Text style={s.cardName}>{dr.item.name}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </Page>
    </Document>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function generateKolajPdf(data: KolajPdfData): Promise<string> {
  const blob = await pdf(<KolajDocument data={data} />).toBlob();
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
