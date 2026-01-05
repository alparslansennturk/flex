export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-designstudio-surface text-designstudio-text-main">
      <div 
        className="flex flex-col items-center justify-center border border-designstudio-border p-10"
        style={{ borderRadius: 'var(--radius-8)' }} 
      >
        <h1 className="text-4xl font-bold tracking-tighter">
          flex<span className="text-designstudio-primary">.</span>
        </h1>
        <p className="mt-4 text-designstudio-text-secondary">
          Sistem anayasaya uygun olarak başlatıldı.
        </p>
        
        {/* Bizim Değişkenlerin Test Alanı */}
        <div className="mt-8 flex gap-4">
          {/* Primary Renk ve Radius-8 Testi */}
          <div 
            className="h-12 w-12 bg-designstudio-primary"
            style={{ borderRadius: 'var(--radius-8)' }}
          ></div>
          
          {/* Success Renk Testi */}
          <div 
            className="h-12 w-12 bg-designstudio-success"
            style={{ borderRadius: 'var(--radius-8)' }}
          ></div>
        </div>
      </div>
    </main>
  );
}