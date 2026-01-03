export default function Home() {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-base-primary-50 p-4">
      <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-xl border border-base-primary-100">
        <h1 className="text-2xl font-bold text-base-primary-900 text-center">
          EduCore OS
        </h1>
        <p className="mt-2 text-base-primary-800 text-center">
          Figma isimlendirme standartı başarıyla bağlandı.
        </p>
        
        <button className="mt-8 w-full rounded-xl bg-designstudio-primary-500 py-3 font-semibold text-white hover:bg-base-secondary-600 transition-all shadow-lg shadow-base-secondary-200">
          Base Secondary Testi
        </button>
      </div>
    </main>
  );
}