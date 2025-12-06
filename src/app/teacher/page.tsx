"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, type ApiError } from "@/lib/apiClient";

type CourseStatus = "draft" | "active" | "finished";

interface CourseTemplateLite {
  id: number;
  code: string;
  name: string;
}

interface LecturerLite {
  id: number;
  name: string;
  username: string;
}

interface TeacherCourseInstance {
  id: number;
  course_template_id: number;
  class_name: string;
  semester: string;
  lecturer_id: number;
  status: CourseStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  template: CourseTemplateLite;
  lecturer: LecturerLite;
}

type StatusFilter = "all" | CourseStatus;

const STATUS_LABELS: Record<CourseStatus, string> = {
  draft: "Draft",
  active: "Aktif",
  finished: "Selesai",
};

const STATUS_BADGE_CLASSES: Record<CourseStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  finished: "border-amber-200 bg-amber-50 text-amber-700",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "data" in error) {
    const apiError = error as ApiError;
    if (apiError.data && typeof apiError.data === "object") {
      const body = apiError.data as { message?: unknown };
      if (typeof body.message === "string" && body.message.length > 0) {
        return body.message;
      }
    }
  }

  return fallback;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TeacherMyCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<TeacherCourseInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;

    const fetchCourses = async () => {
      setLoading(true);
      setError(null);

      try {
        const query =
          statusFilter === "all" ? undefined : { status: statusFilter };
        const data = await apiGet<TeacherCourseInstance[]>(
          "/api/teacher/course-instances",
          query
        );

        if (isActive) {
          setCourses(data);
        }
      } catch (err: unknown) {
        if (!isActive) return;
        const message = getErrorMessage(err, "Gagal memuat daftar kelas.");
        setError(message);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchCourses();

    return () => {
      isActive = false;
    };
  }, [statusFilter]);

  const filteredCourses =
    statusFilter === "all"
      ? courses
      : courses.filter((c) => c.status === statusFilter);

  const handleToggleStatus = async (course: TeacherCourseInstance) => {
    if (course.status === "finished") {
      setError("Kelas yang sudah selesai tidak dapat diubah statusnya.");
      return;
    }

    const nextStatus: CourseStatus =
      course.status === "draft" ? "active" : "draft";

    setUpdatingId(course.id);
    setError(null);

    try {
      const updated = await apiPost<TeacherCourseInstance>(
        `/api/teacher/course-instances/${course.id}/status`,
        { status: nextStatus }
      );

      setCourses((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "Gagal mengubah status kelas. Silakan coba lagi."
      );
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Kelas yang Diampu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lihat dan kelola kelas per semester yang Anda ampu.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1 text-xs">
          {[
            { key: "all", label: "Semua" },
            { key: "draft", label: "Draft" },
            { key: "active", label: "Aktif" },
            { key: "finished", label: "Selesai" },
          ].map((item) => {
            const key = item.key as StatusFilter;
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={[
                  "rounded-full px-3 py-1.5 transition-colors",
                  isActive
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded-full bg-slate-100" />
                  <div className="h-3 w-28 rounded-full bg-slate-100" />
                  <div className="h-3 w-32 rounded-full bg-slate-100" />
                </div>
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 h-7 w-28 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Belum ada kelas untuk filter ini.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kelas akan muncul di sini setelah Superadmin menugaskan Anda sebagai
            dosen pengampu.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                      {course.template.code}
                    </p>
                    <h2 className="mt-0.5 text-sm font-semibold text-slate-900">
                      {course.template.name}
                    </h2>
                  </div>
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      STATUS_BADGE_CLASSES[course.status],
                    ].join(" ")}
                  >
                    {STATUS_LABELS[course.status]}
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  Kelas{" "}
                  <span className="font-medium text-slate-800">
                    {course.class_name}
                  </span>{" "}
                  • Semester{" "}
                  <span className="font-medium text-slate-800">
                    {course.semester}
                  </span>
                </p>

                <p className="text-[11px] text-slate-500">
                  Periode:{" "}
                  <span className="font-medium text-slate-700">
                    {formatDate(course.start_date)}
                  </span>{" "}
                  –{" "}
                  <span className="font-medium text-slate-700">
                    {formatDate(course.end_date)}
                  </span>
                </p>

                {course.notes && (
                  <p className="text-[11px] text-slate-500">
                    Catatan:{" "}
                    <span className="font-normal text-slate-700">
                      {course.notes}
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex flex-col text-[11px] text-slate-500">
                  <span>
                    Klik{" "}
                    <span className="font-semibold text-slate-800">
                      Lihat kelas
                    </span>{" "}
                    untuk masuk ke halaman detail.
                  </span>
                  <span>
                    Status hanya dapat diubah antara{" "}
                    <span className="font-semibold text-slate-800">Draft</span>{" "}
                    dan{" "}
                    <span className="font-semibold text-slate-800">Aktif</span>.
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link
                    href={`/teacher/courses/${course.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Lihat kelas →
                  </Link>
                  <button
                    type="button"
                    disabled={
                      course.status === "finished" || updatingId === course.id
                    }
                    onClick={() => handleToggleStatus(course)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingId === course.id && (
                      <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                    )}
                    {course.status === "draft"
                      ? "Aktifkan"
                      : course.status === "active"
                      ? "Set ke Draft"
                      : "Selesai"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherMyCoursesPage;
