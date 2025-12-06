"use client";

import React, { useEffect, useState } from "react";
import { apiGet } from "@/lib/apiClient";

type UserRole = "superadmin" | "dosen" | "mahasiswa";

interface UserLike {
  role?: string | null;
}

interface CourseInstanceLike {
  semester?: string | null;
  status?: string | null;
}

interface DashboardStats {
  totalUsers: number;
  usersByRole: Record<UserRole, number>;
  totalCourseTemplates: number;
  totalCourseInstances: number;
  activeCourseInstances: number;
  semesters: { semester: string; count: number }[];
}

/**
 * Helper untuk ekstrak array dari response:
 * - Jika langsung array → pakai apa adanya
 * - Jika bentuk { data: [...] } → ambil data
 * - Selain itu → []
 */
function extractArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object" && "data" in value) {
    const obj = value as { data?: unknown };
    if (Array.isArray(obj.data)) {
      return obj.data as T[];
    }
  }

  return [];
}

const SuperadminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setError(null);
    setLoading(true);

    try {
      // Ambil data dari tiga endpoint admin
      const [usersRes, templatesRes, instancesRes] = await Promise.all([
        apiGet<unknown>(
          "/api/admin/users",
          { per_page: 1000 },
          { withAuth: true }
        ),
        apiGet<unknown>(
          "/api/admin/course-templates",
          { per_page: 1000 },
          { withAuth: true }
        ),
        apiGet<unknown>(
          "/api/admin/course-instances",
          { per_page: 1000 },
          { withAuth: true }
        ),
      ]);

      const users = extractArray<UserLike>(usersRes);
      const templates = extractArray<unknown>(templatesRes);
      const instances = extractArray<CourseInstanceLike>(instancesRes);

      const initialRoleCounts: Record<UserRole, number> = {
        superadmin: 0,
        dosen: 0,
        mahasiswa: 0,
      };

      const usersByRole = users.reduce(
        (acc, user) => {
          const role = user.role;
          if (
            role === "superadmin" ||
            role === "dosen" ||
            role === "mahasiswa"
          ) {
            acc[role] += 1;
          }
          return acc;
        },
        { ...initialRoleCounts }
      );

      const totalUsers = users.length;

      const totalCourseTemplates = templates.length;
      const totalCourseInstances = instances.length;

      const activeCourseInstances = instances.filter(
        (item) => item.status === "active"
      ).length;

      const semesterMap = new Map<string, number>();
      instances.forEach((item) => {
        const sem = (item.semester || "").trim();
        if (!sem) return;
        const current = semesterMap.get(sem) ?? 0;
        semesterMap.set(sem, current + 1);
      });

      const semesters: { semester: string; count: number }[] = Array.from(
        semesterMap.entries()
      )
        .map(([semester, count]) => ({ semester, count }))
        .sort((a, b) => a.semester.localeCompare(b.semester));

      const nextStats: DashboardStats = {
        totalUsers,
        usersByRole,
        totalCourseTemplates,
        totalCourseInstances,
        activeCourseInstances,
        semesters,
      };

      setStats(nextStats);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal memuat data dashboard.");
      } else {
        setError("Terjadi kesalahan saat memuat data dashboard.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const isBusy = loading && !stats;

  return (
    <div className="space-y-6">
      {/* Header dashboard */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Dashboard Superadmin
          </h1>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span
            className={`h-3 w-3 rounded-full border border-red-600 border-t-transparent ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isBusy && !error && (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="h-3 w-20 rounded-full bg-slate-100 mb-3" />
              <div className="h-5 w-12 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {stats && !isBusy && (
        <div className="space-y-6">
          {/* Row: global cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Total Pengguna</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {stats.totalUsers}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span>Superadmin: {stats.usersByRole.superadmin}</span>
                <span>•</span>
                <span>Dosen: {stats.usersByRole.dosen}</span>
                <span>•</span>
                <span>Mahasiswa: {stats.usersByRole.mahasiswa}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Template Mata Kuliah</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {stats.totalCourseTemplates}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Kelas Per Semester</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-semibold text-slate-900">
                  {stats.totalCourseInstances}
                </span>
                <span className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                  Aktif: {stats.activeCourseInstances}
                </span>
              </div>
            </div>
          </div>

          {/* Row: distribusi kelas per semester */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">
                Distribusi Kelas per Semester
              </p>
              <span className="text-[11px] text-slate-400">
                {stats.semesters.length} semester
              </span>
            </div>
            {stats.semesters.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada data kelas.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.semesters.map((item) => (
                  <div
                    key={item.semester}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-600">{item.semester}</span>
                    <span className="text-slate-900 font-medium">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperadminDashboardPage;
