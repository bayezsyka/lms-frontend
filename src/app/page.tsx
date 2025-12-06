"use client";

import { FormEvent, useState } from "react";
import { fetchPing, type PingResponse } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  const {
    user,
    loading: authLoading,
    initialized,
    login,
    logout,
    token,
  } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password123");
  const [authError, setAuthError] = useState<string | null>(null);

  const handleTestApi = async () => {
    setPingLoading(true);
    setPingError(null);
    setPingResult(null);

    try {
      const res = await fetchPing();
      setPingResult(res);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan yang tidak diketahui";
      setPingError(message);
    } finally {
      setPingLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);

    try {
      await login(username, password);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Login gagal karena kesalahan yang tidak diketahui";
      setAuthError(message);
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    await logout();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl grid gap-6 md:grid-cols-2">
        {/* Card: Ping Backend */}
        <section className="col-span-1 rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
          <header className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-900">
              LMS Backend Connectivity Test
            </h1>
            <p className="text-sm text-slate-600">
              Pastikan frontend Next.js sudah bisa berkomunikasi dengan backend
              Laravel yang ada di server.
            </p>
          </header>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleTestApi}
              disabled={pingLoading}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium
                         bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60
                         disabled:cursor-not-allowed transition-colors"
            >
              {pingLoading ? "Menguji koneksi..." : "Test /api/ping"}
            </button>

            {pingResult && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="font-semibold mb-1">Berhasil terhubung!</div>
                <pre className="whitespace-pre-wrap break-words">
                  {JSON.stringify(pingResult, null, 2)}
                </pre>
              </div>
            )}

            {pingError && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="font-semibold mb-1">Gagal menghubungi API</div>
                <p>{pingError}</p>
              </div>
            )}
          </div>

          <footer className="pt-3 border-t border-slate-200 space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Status Konfigurasi
            </p>
            <p className="text-sm text-slate-600">
              Base URL API:{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                {process.env.NEXT_PUBLIC_API_BASE_URL ??
                  "TIDAK DITEMUKAN (.env.local belum dibuat)"}
              </code>
            </p>
          </footer>
        </section>

        {/* Card: Auth Debug */}
        <section className="col-span-1 rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold text-slate-900">
              Auth Debug Panel
            </h2>
            <p className="text-sm text-slate-600">
              Panel sementara untuk menguji context auth (login, logout, dan
              data user) sebelum bikin halaman produksi.
            </p>
          </header>

          <div className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="username"
                  className="text-xs font-medium text-slate-700 uppercase tracking-wide"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-slate-700 uppercase tracking-wide"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  autoComplete="current-password"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium
                             bg-emerald-600 text-white hover:bg-emerald-700
                             disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {authLoading ? "Memproses..." : "Login"}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={authLoading || !user}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium
                             bg-slate-200 text-slate-800 hover:bg-slate-300
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Logout
                </button>
              </div>
            </form>

            {authError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <div className="font-semibold mb-1">Error Auth</div>
                <p>{authError}</p>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold">State:</span>
                <span>
                  {initialized ? "Initialized" : "Initializing..."} •{" "}
                  {authLoading ? "Loading" : "Idle"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold">Token:</span>
                <span className="truncate max-w-[200px]">
                  {token ? `${token.slice(0, 12)}…` : "No token"}
                </span>
              </div>
              <div className="pt-1 border-t border-slate-200">
                <span className="font-semibold">User:</span>
                {user ? (
                  <pre className="mt-1 whitespace-pre-wrap break-words">
                    {JSON.stringify(
                      {
                        id: user.id,
                        name: user.name,
                        username: user.username,
                        role: user.role,
                        nim: user.nim,
                        status: user.status,
                      },
                      null,
                      2
                    )}
                  </pre>
                ) : (
                  <p className="mt-1 text-slate-600">Belum ada user login.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
