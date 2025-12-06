"use client";

import React from "react";
import { useRouter } from "next/navigation";

const UnauthorizedPage: React.FC = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-6 space-y-4 text-center">
          <div className="mx-auto h-10 w-10 flex items-center justify-center rounded-full bg-red-50 text-red-700 text-lg">
            !
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold">
              Tidak berhak mengakses halaman ini
            </h1>
            <p className="text-xs text-slate-500">
              Silakan login dengan akun yang memiliki hak akses yang sesuai.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium bg-red-700 text-white hover:bg-red-800 transition-colors"
          >
            Kembali ke halaman login
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
