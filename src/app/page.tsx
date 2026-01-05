export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-900">
      {/* max-w-100 kullanımı: Senin ölçü birimine tam sadık */}
      <div 
        className="w-full max-w-100 border border-surface-800 bg-surface-800 p-space-40 shadow-2xl"
        style={{ borderRadius: 'var(--radius-radius-12)' }}
      >
        {/* Logo Bölümü */}
        <div className="mb-space-40 text-center">
          <h2 className="h2 tracking-xxs text-text-inverse">
            flex<span className="text-designstudio-primary-600">.</span>
          </h2>
          <p className="ui-label-small mt-space-8 text-text-tertiary uppercase tracking-lg">
            Giriş Yap
          </p>
        </div>

        {/* Form Alanı */}
        <form className="space-y-space-24">
          <div>
            <label className="ui-label-small mb-space-8 block text-text-secondary">E-posta</label>
            <input 
              type="email" 
              className="w-full bg-surface-900 border border-surface-700 p-space-12 text-text-inverse focus:border-designstudio-primary-500 outline-none transition-all"
              style={{ borderRadius: 'var(--radius-radius-8)' }}
              placeholder="alp@flex.com"
            />
          </div>

          <div>
            <label className="ui-label-small mb-space-8 block text-text-secondary">Şifre</label>
            <input 
              type="password" 
              className="w-full bg-surface-900 border border-surface-700 p-space-12 text-text-inverse focus:border-designstudio-primary-500 outline-none transition-all"
              style={{ borderRadius: 'var(--radius-radius-8)' }}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-designstudio-primary-600 py-space-16 text-text-inverse ui-label-default hover:bg-designstudio-primary-700 transition-colors border-none cursor-pointer"
            style={{ borderRadius: 'var(--radius-radius-8)' }}
          >
            Sisteme Gir
          </button>
        </form>

        <div className="mt-space-32 text-center">
          <a href="#" className="ui-link-sm text-text-tertiary hover:text-designstudio-primary-400">
            Şifremi unuttum
          </a>
        </div>
      </div>
    </main>
  );
}