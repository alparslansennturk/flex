import * as React from "react";
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
  Row,
  Column,
} from "@react-email/components";

interface MonthlyWinnerTemplateProps {
  winnerName: string;
  firstName: string;
  score: number;
  monthLabel: string;
  groupCode?: string;
}

export function MonthlyWinnerTemplate({
  winnerName,
  firstName,
  score,
  monthLabel,
  groupCode,
}: MonthlyWinnerTemplateProps) {
  return (
    <Html lang="tr">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>🏆 Tebrikler {firstName}! {monthLabel} ayının birincisisin.</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Hero Görsel */}
          <Section style={styles.heroSection}>
            <Img
              src={`https://flex-one-iota.vercel.app/api/og/monthly-winner?firstName=${encodeURIComponent(firstName)}&score=${score}&month=${encodeURIComponent(monthLabel)}`}
              alt="Aylık Birinci"
              width="560"
              style={styles.heroImage}
            />
          </Section>

          {/* Rozet */}
          <Section style={styles.badgeSection}>
            <Text style={styles.badge}>🏆 {monthLabel} Birincisi</Text>
          </Section>

          {/* Ana İçerik */}
          <Section style={styles.content}>

            {/* Başlık */}
            <Text style={styles.title}>
              Tebrikler, {firstName}! 🎉
            </Text>

            <Text style={styles.description}>
              <strong>{monthLabel}</strong> ayında Tasarım Atölyesi'nin{" "}
              <span style={{ color: "#FF5C00" }}>en başarılı öğrencisi</span> sensin.
              Gösterdiğin çaba ve tutarlılık gerçekten takdire değer — bu başarı seni
              daha büyük hedeflere taşıyacak.
            </Text>

            {/* Puan Kutusu */}
            <Section style={styles.scoreCard}>
              <Row>
                <Column style={styles.scoreCol}>
                  <Text style={styles.scoreLabel}>Aylık Puan</Text>
                  <Text style={styles.scoreValue}>{score}</Text>
                  <Text style={styles.scoreUnit}>puan</Text>
                </Column>
                {groupCode && (
                  <Column style={styles.groupCol}>
                    <Text style={styles.scoreLabel}>Sınıf</Text>
                    <Text style={styles.groupValue}>{groupCode}</Text>
                  </Column>
                )}
              </Row>
            </Section>

            {/* İsim Şeridi */}
            <Section style={styles.nameStrip}>
              <Text style={styles.nameStripText}>{winnerName}</Text>
            </Section>

            {/* CTA Butonu */}
            <Button
              href="https://flex-one-iota.vercel.app/dashboard/league"
              style={styles.button}
            >
              Sıralamayı Gör →
            </Button>

            <Text style={styles.motivationText}>
              Böyle devam et — atölye seninle gurur duyuyor. ✨
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.brandName}>
              <span style={{ color: "#FF5C00" }}>tasarım</span>
              <span style={{ color: "#7C3AED" }}>atölyesi</span>
            </Text>
            <Text style={styles.footerText}>
              Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.
              Her ay en yüksek puanı alan öğrenciye ulaşır.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: "#F5F5F7",
    fontFamily: "Inter, Arial, sans-serif",
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: "#FFFFFF",
    margin: "40px auto",
    borderRadius: "16px",
    maxWidth: "560px",
    overflow: "hidden",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  heroSection: {
    padding: 0,
    margin: 0,
  },
  heroImage: {
    width: "100%",
    maxWidth: "560px",
    display: "block",
    borderRadius: "16px 16px 0 0",
    objectFit: "cover",
  },
  badgeSection: {
    padding: "20px 40px 0 40px",
    textAlign: "center" as const,
  },
  badge: {
    display: "inline-block",
    backgroundColor: "#FFF7ED",
    border: "1px solid #FDBA74",
    borderRadius: "100px",
    color: "#C2410C",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.3px",
    padding: "6px 16px",
    margin: 0,
  },
  content: {
    padding: "20px 40px 32px 40px",
  },
  title: {
    fontSize: "26px",
    fontWeight: 800,
    color: "#111111",
    letterSpacing: "-0.5px",
    margin: "0 0 12px 0",
    lineHeight: "1.2",
    textAlign: "center" as const,
  },
  description: {
    fontSize: "15px",
    color: "#555555",
    lineHeight: "1.7",
    margin: "0 0 28px 0",
    textAlign: "center" as const,
  },
  scoreCard: {
    backgroundColor: "#10294C",
    borderRadius: "12px",
    padding: "0",
    margin: "0 0 16px 0",
  },
  scoreCol: {
    textAlign: "center" as const,
    padding: "24px 24px",
    width: "50%",
  },
  groupCol: {
    textAlign: "center" as const,
    padding: "24px 24px",
    width: "50%",
    borderLeft: "1px solid rgba(255,255,255,0.1)",
  },
  scoreLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
    margin: "0 0 4px 0",
  },
  scoreValue: {
    fontSize: "40px",
    fontWeight: 800,
    color: "#FF5C00",
    letterSpacing: "-1px",
    margin: "0",
    lineHeight: "1",
  },
  scoreUnit: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.4)",
    margin: "2px 0 0 0",
  },
  groupValue: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#FFFFFF",
    letterSpacing: "-0.5px",
    margin: "0",
    lineHeight: "1",
  },
  nameStrip: {
    backgroundColor: "#F5F5F7",
    borderRadius: "8px",
    margin: "0 0 24px 0",
    padding: "0",
  },
  nameStripText: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#333333",
    textAlign: "center" as const,
    margin: 0,
    padding: "14px 20px",
    letterSpacing: "0.1px",
  },
  button: {
    backgroundColor: "#FF5C00",
    borderRadius: "10px",
    color: "#FFFFFF",
    display: "block",
    fontSize: "15px",
    fontWeight: 700,
    padding: "14px 0",
    textAlign: "center" as const,
    textDecoration: "none",
    width: "100%",
    marginBottom: "20px",
  },
  motivationText: {
    fontSize: "14px",
    color: "#888888",
    textAlign: "center" as const,
    margin: "0",
    lineHeight: "1.5",
  },
  divider: {
    borderColor: "#EEEEEE",
    margin: "0 40px",
  },
  footer: {
    padding: "20px 40px 28px 40px",
    textAlign: "center" as const,
  },
  brandName: {
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.5px",
    margin: "0 0 8px 0",
  },
  footerText: {
    fontSize: "12px",
    color: "#BBBBBB",
    margin: 0,
    lineHeight: "1.6",
  },
};

export default MonthlyWinnerTemplate;
