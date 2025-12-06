"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, initialized, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    // Belum login → lempar ke login
    if (!user) {
      router.replace(
        "/login?message=" +
          encodeURIComponent("Silakan login untuk mengakses halaman ini.")
      );
      return;
    }

    // Wajib ganti password dulu
    if (user.force_password_change) {
      router.replace(
        "/change-password?message=" +
          encodeURIComponent("Silakan ganti password sebelum mengakses LMS.")
      );
      return;
    }

    // Login tapi bukan superadmin → lempar ke unauthorized
    if (user.role !== "superadmin") {
      router.replace("/unauthorized");
    }
  }, [user, initialized, router]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  const isAllowed =
    initialized &&
    !loading &&
    user &&
    user.role === "superadmin" &&
    !user.force_password_change;

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">
            Memuat dashboard Superadmin...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-700 text-white text-xs font-semibold">
              BS
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">
                Bima Sakapenta
              </div>
              <div className="text-[11px] text-slate-500 leading-none mt-0.5">
                Superadmin
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              {user?.name ?? user?.username}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
