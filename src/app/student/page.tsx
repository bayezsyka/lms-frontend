export default function StudentDashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">
        Dashboard Mahasiswa
      </h1>
      <p className="text-sm text-slate-500">
        Akses kelas dan progres belajar Anda.
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs text-slate-500">Kelas Aktif</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">—</p>
      </div>
    </div>
  );
}
