"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, type ApiError } from "@/lib/apiClient";

type QuizTimeStatus =
  | "not_started"
  | "ongoing"
  | "finished"
  | {
      is_future: boolean;
      is_ongoing: boolean;
      is_finished: boolean;
      can_attempt_now: boolean;
    }
  | string
  | null;

interface QuizDetail {
  id: number;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  max_score: number | null;
  time_status?: QuizTimeStatus;
  created_at: string;
  updated_at: string;
  course_instance?: {
    id: number;
    class_name: string;
    semester: string;
    template?: {
      code: string;
      name: string;
    } | null;
  } | null;
}

interface QuizStudent {
  id: number;
  name: string;
  username: string;
  nim: string | null;
  email: string | null;
}

interface QuizAttemptItem {
  id: number;
  student: QuizStudent;
  started_at: string | null;
  submitted_at: string | null;
  score: number | null;
}

interface TeacherQuizAttemptsResponse {
  quiz: QuizDetail;
  attempts?: QuizAttemptItem[] | null;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "data" in error) {
    const apiError = error as ApiError;
    if (apiError.data && typeof apiError.data === "object") {
      const body = apiError.data as { message?: unknown; error?: unknown };
      if (typeof body.message === "string" && body.message.length > 0) {
        return body.message;
      }
      if (typeof body.error === "string" && body.error.length > 0) {
        return body.error;
      }
    }
  }

  return fallback;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatQuizStatus(status: QuizTimeStatus | undefined): string {
  if (status == null) return "—";

  if (typeof status === "string") {
    return status;
  }

  const flags = status as {
    is_future: boolean;
    is_ongoing: boolean;
    is_finished: boolean;
    can_attempt_now: boolean;
  };

  if (flags.is_ongoing) return "Sedang berlangsung";
  if (flags.is_future) return "Belum dimulai";
  if (flags.is_finished) return "Sudah berakhir";
  if (flags.can_attempt_now) return "Dapat dikerjakan";

  return "Status tidak diketahui";
}

const TeacherQuizDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const quizId = (params?.id ?? "") as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [attempts, setAttempts] = useState<QuizAttemptItem[]>([]);

  useEffect(() => {
    if (!quizId) return;

    let isActive = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<TeacherQuizAttemptsResponse>(
          `/api/teacher/quizzes/${quizId}/attempts`
        );
        if (!isActive) return;

        setQuiz(data.quiz);
        const safeAttempts = Array.isArray(data.attempts)
          ? data.attempts
          : [];
        setAttempts(safeAttempts);
      } catch (err: unknown) {
        if (!isActive) return;
        const message = extractErrorMessage(
          err,
          "Gagal memuat detail quiz dan attempt."
        );
        setError(message);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, [quizId]);

  const handleBack = () => {
    if (quiz && quiz.course_instance && quiz.course_instance.id) {
      router.push(
        `/teacher/courses/${quiz.course_instance.id.toString()}`
      );
    } else {
      router.push("/teacher");
    }
  };

  const attemptsArray = attempts ?? [];
  const totalAttempts = attemptsArray.length;
  const gradedCount = attemptsArray.filter(
    (attempt) => attempt.score !== null && attempt.score !== undefined
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
          >
            ← Kembali
          </button>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-900">
              Detail Quiz
            </h1>
            {quiz && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {quiz.course_instance?.template
                  ? `${quiz.course_instance.template.code} — ${quiz.course_instance.template.name}`
                  : "Tanpa template"}{" "}
                {quiz.course_instance
                  ? `• Kelas ${quiz.course_instance.class_name} • Semester ${quiz.course_instance.semester}`
                  : ""}
              </p>
            )}
          </div>
        </div>
        {quiz && (
          <div className="text-right text-[11px] text-slate-500">
            Dibuat pada {formatDate(quiz.created_at)}
          </div>
        )}
      </div>

      {/* Info Quiz */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-900">
            {quiz ? quiz.title : "Memuat judul quiz..."}
          </p>
          {quiz && quiz.description && (
            <p className="text-[11px] text-slate-600 whitespace-pre-wrap">
              {quiz.description}
            </p>
          )}
          {quiz && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
              <p className="mb-1 font-semibold text-slate-900">
                Jendela Waktu Quiz
              </p>
              <p>
                {formatDateTime(quiz.start_time)} –{" "}
                {formatDateTime(quiz.end_time)}
              </p>
              <p className="mt-1 text-slate-600">
                Durasi:{" "}
                <span className="font-semibold text-slate-900">
                  {quiz.duration_minutes ?? "—"} menit
                </span>
              </p>
              <p className="mt-1 text-slate-600">
                Nilai maksimal:{" "}
                <span className="font-semibold text-slate-900">
                  {quiz.max_score ?? 100}
                </span>
              </p>
              <p className="mt-1 text-slate-600">
                Status saat ini:{" "}
                <span className="font-semibold text-slate-900">
                  {formatQuizStatus(quiz.time_status)}
                </span>
              </p>
            </div>
          )}
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px]">
          <p className="text-xs font-semibold text-slate-900">
            Ringkasan Attempt
          </p>
          {quiz ? (
            <>
              <p className="text-slate-600">
                Total attempt:{" "}
                <span className="font-semibold text-slate-900">
                  {totalAttempts}
                </span>
              </p>
              <p className="text-slate-600">
                Attempt bernilai:{" "}
                <span className="font-semibold text-slate-900">
                  {gradedCount}/{totalAttempts}
                </span>
              </p>
              <p className="mt-2 text-slate-500">
                Detail jawaban per soal dapat ditambahkan di tahap
                pengembangan berikutnya jika dibutuhkan.
              </p>
            </>
          ) : (
            <p className="text-slate-400">Memuat data attempt...</p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Attempts Table */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-900">
          Attempt Mahasiswa
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100" />
                  <div className="space-y-1">
                    <div className="h-3 w-32 rounded-full bg-slate-100" />
                    <div className="h-3 w-24 rounded-full bg-slate-100" />
                  </div>
                </div>
                <div className="h-3 w-20 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ) : attemptsArray.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            Belum ada attempt quiz dari mahasiswa.
          </div>
        ) : (
          <div className="overflow-x-auto px-2 py-3 text-xs">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Mahasiswa
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Mulai
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Selesai
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Skor
                  </th>
                </tr>
              </thead>
              <tbody>
                {attemptsArray.map((attempt, index) => {
                  const rowBg =
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60";

                  const hasScore =
                    attempt.score !== null &&
                    attempt.score !== undefined;

                  return (
                    <tr key={attempt.id} className={rowBg}>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
                            {attempt.student.name
                              .split(" ")
                              .map((part) => part.charAt(0))
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {attempt.student.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {attempt.student.username}
                              {attempt.student.nim
                                ? ` • ${attempt.student.nim}`
                                : ""}
                            </p>
                            {attempt.student.email && (
                              <p className="text-[10px] text-slate-500">
                                {attempt.student.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                        {formatDateTime(attempt.started_at)}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                        {formatDateTime(attempt.submitted_at)}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-900">
                        {hasScore ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {attempt.score}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">
                            Belum dinilai
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherQuizDetailPage;
