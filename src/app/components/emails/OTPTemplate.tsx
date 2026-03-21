import * as React from "react";
import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface OTPTemplateProps {
  otp: string;
  /** Kullanıcıya gösterilecek isim. Opsiyonel. */
  name?: string;
}

export function OTPTemplate({ otp, name }: OTPTemplateProps) {
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
      <Preview>Giriş kodunuz: {otp}</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Marka Başlığı */}
          <Section style={styles.header}>
            <Text style={styles.brandName}>
              <span style={{ color: "#FF5C00" }}>tasarım</span>
              <span style={{ color: "#7C3AED" }}>atölyesi</span>
            </Text>
          </Section>

          {/* Ana İçerik */}
          <Section style={styles.content}>
            <Text style={styles.greeting}>
              {name ? `Merhaba ${name},` : "Merhaba,"}
            </Text>
            <Text style={styles.description}>
              Sisteme giriş yapmak için aşağıdaki tek kullanımlık kodu kullanın.
              Bu kod <strong>10 dakika</strong> geçerlidir.
            </Text>

            {/* OTP Kodu Kutusu */}
            <Section style={styles.otpWrapper}>
              <Text style={styles.otpCode}>{otp}</Text>
            </Section>

            {/* Giriş Yap Butonu */}
            {/* TODO: Yarın buraya login sayfasına yönlendiren link eklenecek */}
            <Button href="https://flex-one-iota.vercel.app/login" style={styles.button}>
              Giriş Yap
            </Button>

            <Text style={styles.warning}>
              Bu kodu kimseyle paylaşmayın. Eğer bu isteği siz yapmadıysanız,
              bu mesajı görmezden gelebilirsiniz.
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Bu mail Tasarım Atölyesi sistemi tarafından otomatik gönderilmiştir.
            </Text>
            {/* TODO: Yarın buraya ödev PDF eki ekleme altyapısı kurulacak */}
            {/* TODO: İleride sertifika eki buraya eklenecek */}
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// Apple ve Linear ilhamı: beyaz zemin, sade tipografi, güçlü kontrast
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
  header: {
    padding: "32px 40px 0 40px",
  },
  brandName: {
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "-0.5px",
    margin: 0,
  },
  content: {
    padding: "24px 40px 32px 40px",
  },
  greeting: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#111111",
    margin: "0 0 8px 0",
  },
  description: {
    fontSize: "15px",
    color: "#555555",
    lineHeight: "1.6",
    margin: "0 0 28px 0",
  },
  otpWrapper: {
    backgroundColor: "#111111",
    borderRadius: "12px",
    margin: "0 0 28px 0",
    padding: "0",
    textAlign: "center" as const,
  },
  otpCode: {
    fontSize: "40px",
    fontWeight: 700,
    letterSpacing: "10px",
    color: "#FFFFFF",
    margin: 0,
    padding: "24px 0",
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: "#FF5C00",
    borderRadius: "8px",
    color: "#FFFFFF",
    display: "block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "14px 0",
    textAlign: "center" as const,
    textDecoration: "none",
    width: "100%",
    marginBottom: "24px",
  },
  warning: {
    fontSize: "13px",
    color: "#999999",
    lineHeight: "1.5",
    margin: 0,
  },
  divider: {
    borderColor: "#EEEEEE",
    margin: "0 40px",
  },
  footer: {
    padding: "20px 40px 28px 40px",
  },
  footerText: {
    fontSize: "12px",
    color: "#BBBBBB",
    margin: 0,
    lineHeight: "1.5",
  },
};

export default OTPTemplate;
