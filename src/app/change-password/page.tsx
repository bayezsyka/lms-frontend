"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";

interface ChangePasswordResponse {
  message?: string;
}

const ChangePasswordPage: React.FC = () => {
  const router = useRouter();
  const { user, initialized, loading, refreshUser, logout } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Kalau belum init auth, tunggu dulu
  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      // belum login → lempar ke login
      router.replace("/login");
      return;
    }
  }, [initialized, user, router]);

  const redirectToDashboard = () => {
    if (!user) return;
    switch (user.role) {
      case "superadmin":
        router.replace("/superadmin");
        break;
      case "dosen":
        router.replace("/dosen");
        break;
      case "mahasiswa":
        router.replace("/mahasiswa");
        break;
      default:
        router.replace("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("Semua field wajib diisi.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }

    try {
      setSubmitting(true);

      // KIRIM DUA FIELD SEKALIGUS:
      // - old_password
      // - current_password
      // backend mana pun (yang minta old_password atau current_password)
      // akan dapat nilai yang benar.
      const payload = {
        old_password: oldPassword,
        current_password: oldPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      };

      const res = await apiPost<ChangePasswordResponse>(
        "/api/auth/change-password",
        payload,
        { withAuth: true }
      );

      setSuccess(res.message || "Password berhasil diubah.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // refresh data user (supaya force_password_change = false)
      await refreshUser();

      // redirect ke dashboard sesuai role
      redirectToDashboard();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal mengganti password.");
      } else {
        setError("Terjadi kesalahan saat mengganti password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  // Loading awal auth
  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="rounded-full border-2 border-slate-300 border-t-red-700 h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-700 text-xs font-semibold text-white">
              BS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900">
                Bima Sakapenta
              </span>
              <span className="text-[11px] text-slate-500">Ganti password</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="mb-4 space-y-1">
            <h1 className="text-base font-semibold text-slate-900">
              Ganti password
            </h1>
            <p className="text-[11px] text-slate-500">
              Silakan ganti password sebelum mengakses LMS.
            </p>
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-slate-700">
                Password sekarang
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                placeholder="Masukkan password saat ini"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-slate-700">
                Password baru
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-slate-700">
                Konfirmasi password baru
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                placeholder="Ulangi password baru"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-red-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Menyimpan..." : "Simpan password baru"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChangePasswordPage;
