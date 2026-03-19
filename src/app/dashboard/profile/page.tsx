"use client";

export default function ProfilePage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-base-primary-50, #f4f7fb)" }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1rem",
          padding: "3rem 4rem",
          boxShadow: "0 2px 16px 0 rgba(58,123,213,0.08)",
          textAlign: "center",
          maxWidth: "480px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            color: "var(--color-base-primary-800, #183e72)",
            marginBottom: "1rem",
            letterSpacing: "-0.02em",
          }}
        >
          Profil Ayarları
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--color-base-secondary-400, #579599)",
            marginTop: "0.5rem",
          }}
        >
          Yakında gelecek...
        </p>
      </div>
    </div>
  );
}
