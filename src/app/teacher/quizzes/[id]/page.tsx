"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPut, type ApiError } from "@/lib/apiClient";

/**
 * -------------------------
 * Type definitions
 * -------------------------
 */

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

type QuestionType = "multiple_choice" | "short_answer";

interface QuizQuestionOption {
  id?: string; // client-side id (optional)
  text: string | null;
}

interface QuizQuestion {
  id?: number | string;
  type: QuestionType;
  text: string | null;
  points: number;
  options?: QuizQuestionOption[];
  correct_option_index?: number | null;
}

interface QuizDetail {
  id: number;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  max_score: number | null;
  time_status?: QuizTimeStatus;
  questions: QuizQuestion[] | null;

  // optional relasi untuk header
  section?: {
    id: number;
    title: string;
    course_instance?: {
      id: number;
      class_name: string;
      semester: string;
      template?: {
        code: string;
        name: string;
      };
    };
  };
}

interface StudentMini {
  id: number;
  name: string;
  username: string;
  nim: string | null;
  email: string | null;
}

interface QuizAttempt {
  id: number;
  student: StudentMini;
  score: number | null;
  started_at: string | null;
  submitted_at: string | null;
}

interface TeacherQuizAttemptsResponse {
  quiz: QuizDetail;
  attempts: QuizAttempt[];
}

/**
 * -------------------------
 * Helpers
 * -------------------------
 */

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof Error) {
    return error.message || fallback;
  }

  const maybeApi = error as ApiError & { data?: any };

  if (maybeApi?.data) {
    const data = maybeApi.data as any;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
  }

  if (typeof (maybeApi as any).message === "string") {
    return (maybeApi as any).message as string;
  }

  return fallback;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "-";
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

function formatQuizStatus(status: QuizTimeStatus): string {
  if (!status) return "-";

  if (typeof status === "string") {
    switch (status) {
      case "not_started":
        return "Belum dimulai";
      case "ongoing":
        return "Sedang berlangsung";
      case "finished":
        return "Sudah selesai";
      default:
        return status;
    }
  }

  if (typeof status === "object") {
    if (status.is_ongoing) return "Sedang berlangsung";
    if (status.is_future) return "Belum dimulai";
    if (status.is_finished) return "Sudah selesai";
  }

  return "-";
}

/**
 * -------------------------
 * Component
 * -------------------------
 */

const TeacherQuizDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();

  const quizIdParam = params?.id;
  const quizId =
    typeof quizIdParam === "string"
      ? quizIdParam
      : Array.isArray(quizIdParam)
      ? quizIdParam[0]
      : "";

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Question editor state
  const [questionsDraft, setQuestionsDraft] = useState<QuizQuestion[]>([]);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionMessage, setQuestionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;

    let isActive = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setQuestionMessage(null);

      try {
        const data = await apiGet<TeacherQuizAttemptsResponse>(
          `/api/teacher/quizzes/${quizId}/attempts`
        );
        if (!isActive) return;

        const incomingQuiz = data.quiz;
        setQuiz(incomingQuiz);
        setAttempts(Array.isArray(data.attempts) ? data.attempts : []);

        const incomingQuestions =
          (incomingQuiz.questions as QuizQuestion[] | null) ?? [];

        // Normalisasi biar tidak ada null yang nyangkut di value input
        const normalized = incomingQuestions.map((q) => ({
          ...q,
          text: q.text ?? "",
          points:
            typeof q.points === "number" && !Number.isNaN(q.points)
              ? q.points
              : 1,
          options: q.options
            ? q.options.map((opt) => ({
                ...opt,
                text: opt.text ?? "",
              }))
            : q.options,
        }));

        setQuestionsDraft(normalized);
      } catch (err: unknown) {
        if (!isActive) return;
        setError(
          extractErrorMessage(err, "Gagal memuat detail quiz dan attempts.")
        );
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

  /**
   * Question editor handlers
   */

  const handleAddQuestion = (type: QuestionType) => {
    setQuestionsDraft((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        text: "",
        points: 1,
        options:
          type === "multiple_choice"
            ? [
                { id: "opt-1", text: "" },
                { id: "opt-2", text: "" },
              ]
            : undefined,
        correct_option_index: type === "multiple_choice" ? 0 : null,
      },
    ]);
    setEditingQuestions(true);
    setQuestionMessage(null);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestionsDraft((prev) => prev.filter((_, i) => i !== index));
    setEditingQuestions(true);
    setQuestionMessage(null);
  };

  const handleQuestionFieldChange = <K extends keyof QuizQuestion>(
    index: number,
    field: K,
    value: QuizQuestion[K]
  ) => {
    setQuestionsDraft((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
    setEditingQuestions(true);
    setQuestionMessage(null);
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    setQuestionsDraft((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = q.options ? [...q.options] : [];
        options[optionIndex] = { ...options[optionIndex], text: value };
        return { ...q, options };
      })
    );
    setEditingQuestions(true);
    setQuestionMessage(null);
  };

  const handleAddOption = (questionIndex: number) => {
    setQuestionsDraft((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = q.options ? [...q.options] : [];
        options.push({
          id: `opt-${options.length + 1}-${Math.random()
            .toString(16)
            .slice(2)}`,
          text: "",
        });
        return { ...q, options };
      })
    );
    setEditingQuestions(true);
    setQuestionMessage(null);
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    setQuestionsDraft((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const options = q.options ? [...q.options] : [];
        options.splice(optionIndex, 1);

        let correctIndex = q.correct_option_index ?? null;
        if (correctIndex !== null) {
          if (optionIndex === correctIndex) {
            correctIndex = options.length > 0 ? 0 : null;
          } else if (optionIndex < correctIndex) {
            correctIndex = correctIndex - 1;
          }
        }

        return { ...q, options, correct_option_index: correctIndex };
      })
    );
    setEditingQuestions(true);
    setQuestionMessage(null);
  };

  const handleSaveQuestions = async () => {
    if (!quizId) return;

    setSavingQuestions(true);
    setQuestionMessage(null);

    try {
      // Simple validation
      for (const [idx, q] of questionsDraft.entries()) {
        if (!q.text || !q.text.trim()) {
          throw new Error(`Soal #${idx + 1} belum diisi teksnya.`);
        }
        if (!Number.isFinite(q.points) || q.points <= 0) {
          throw new Error(
            `Poin untuk soal #${idx + 1} harus angka lebih dari 0.`
          );
        }
        if (q.type === "multiple_choice") {
          const options = q.options ?? [];
          if (options.length < 2) {
            throw new Error(
              `Soal pilihan ganda #${idx + 1} minimal punya 2 opsi.`
            );
          }
          if (
            q.correct_option_index === null ||
            q.correct_option_index === undefined ||
            q.correct_option_index < 0 ||
            q.correct_option_index >= options.length
          ) {
            throw new Error(
              `Soal pilihan ganda #${idx + 1} belum memiliki jawaban benar yang valid.`
            );
          }
        }
      }

      // Kirim ke backend – asumsi backend update hanya field 'questions'
      await apiPut(`/api/quizzes/${quizId}`, {
        questions: questionsDraft,
      });

      // Sinkronkan ke state quiz
      setQuiz((prev) =>
        prev ? { ...prev, questions: [...questionsDraft] } : prev
      );

      setEditingQuestions(false);
      setQuestionMessage("Soal quiz berhasil disimpan.");
    } catch (err: unknown) {
      setQuestionMessage(
        extractErrorMessage(err, "Gagal menyimpan pengaturan soal.")
      );
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleResetQuestionsDraft = () => {
    if (!quiz) return;
    const original =
      (quiz.questions as QuizQuestion[] | null | undefined) ?? [];

    const normalized = original.map((q) => ({
      ...q,
      text: q.text ?? "",
      points:
        typeof q.points === "number" && !Number.isNaN(q.points)
          ? q.points
          : 1,
      options: q.options
        ? q.options.map((opt) => ({
            ...opt,
            text: opt.text ?? "",
          }))
        : q.options,
    }));

    setQuestionsDraft(normalized);
    setEditingQuestions(false);
    setQuestionMessage(null);
  };

  const handleBackToCourse = () => {
    const courseId =
      quiz?.section?.course_instance?.id ??
      quiz?.section?.course_instance?.id;

    if (courseId) {
      router.push(`/teacher/courses/${courseId}`);
    } else {
      router.back();
    }
  };

  /**
   * Render
   */

  if (!quizId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">
          ID Quiz tidak ditemukan di URL.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">
            Memuat detail quiz dan attempt mahasiswa...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold mb-1">Gagal memuat data</p>
          <p className="mb-3">{error}</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-full border border-red-600 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-600 hover:text-white transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">
          Data quiz tidak ditemukan.
        </div>
      </div>
    );
  }

  const courseInfo = quiz.section?.course_instance;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={handleBackToCourse}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-600 mb-1"
            >
              <span className="inline-block -translate-y-px">&larr;</span>
              <span>Kembali ke kelas</span>
            </button>
            <h1 className="text-lg font-semibold text-slate-900">
              {quiz.title}
            </h1>
            <p className="text-[11px] text-slate-500">
              {courseInfo
                ? `${courseInfo.template?.code ?? ""} ${
                    courseInfo.template?.name ?? ""
                  } • Kelas ${courseInfo.class_name} • ${
                    courseInfo.semester
                  }`
                : "Informasi kelas tidak tersedia"}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
              Status: {formatQuizStatus(quiz.time_status ?? null)}
            </span>
            <span className="text-[11px] text-slate-500">
              Max score: {quiz.max_score ?? "-"}
            </span>
          </div>
        </div>

        {/* Layout: left info+questions, right attempts */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1.4fr)] gap-4 items-start">
          <div className="flex flex-col gap-4">
            {/* Info card */}
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">
                Informasi Quiz
              </h2>
              {quiz.description && (
                <p className="text-[11px] text-slate-600 mb-2 whitespace-pre-line">
                  {quiz.description}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-600">
                <div>
                  <dt className="text-slate-400">Waktu mulai</dt>
                  <dd className="font-medium">
                    {formatDateTime(quiz.start_time)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Waktu selesai</dt>
                  <dd className="font-medium">
                    {formatDateTime(quiz.end_time)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Durasi</dt>
                  <dd className="font-medium">
                    {formatDuration(quiz.duration_minutes)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Max score</dt>
                  <dd className="font-medium">{quiz.max_score ?? "-"}</dd>
                </div>
              </dl>
            </div>

            {/* Question settings */}
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Pengaturan Soal
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Atur daftar soal untuk quiz ini (multiple choice / short
                    answer).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddQuestion("multiple_choice")}
                    className="inline-flex items-center rounded-full border border-red-600 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-600 hover:text-white transition"
                  >
                    + Soal Pilihan Ganda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuestion("short_answer")}
                    className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-900 hover:text-white transition"
                  >
                    + Soal Isian Singkat
                  </button>
                </div>
              </div>

              {questionMessage && (
                <div
                  className={`mb-3 rounded-xl border px-3 py-2 text-[11px] ${
                    questionMessage.toLowerCase().includes("gagal") ||
                    questionMessage.toLowerCase().includes("error")
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {questionMessage}
                </div>
              )}

              {questionsDraft.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Belum ada soal. Tambahkan soal baru menggunakan tombol di
                  atas.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {questionsDraft.map((q, qIndex) => (
                    <div
                      key={q.id ?? qIndex}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
                              {qIndex + 1}
                            </span>
                            <span className="text-[11px] font-medium text-slate-700">
                              {q.type === "multiple_choice"
                                ? "Pilihan Ganda"
                                : "Isian Singkat"}
                            </span>
                          </div>
                          <textarea
                            value={q.text ?? ""} // <= FIX: never null
                            onChange={(e) =>
                              handleQuestionFieldChange(
                                qIndex,
                                "text",
                                e.target.value
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-900 outline-none focus:border-red-500"
                            placeholder="Teks soal..."
                          />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <label className="flex items-center gap-1 text-[11px] text-slate-600">
                            <span>Poin</span>
                            <input
                              type="number"
                              min={1}
                              value={q.points ?? 1}
                              onChange={(e) =>
                                handleQuestionFieldChange(
                                  qIndex,
                                  "points",
                                  Number(e.target.value) || 1
                                )
                              }
                              className="w-16 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-right text-[11px] outline-none focus:border-red-500"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIndex)}
                            className="text-[10px] text-red-600 hover:underline"
                          >
                            Hapus soal
                          </button>
                        </div>
                      </div>

                      {q.type === "multiple_choice" && (
                        <div className="mt-2">
                          <p className="mb-1 text-[11px] font-medium text-slate-700">
                            Opsi jawaban
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {(q.options ?? []).map((opt, optIndex) => {
                              const isCorrect =
                                q.correct_option_index === optIndex;
                              return (
                                <div
                                  key={opt.id ?? optIndex}
                                  className="flex items-center gap-2"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuestionFieldChange(
                                        qIndex,
                                        "correct_option_index",
                                        optIndex
                                      )
                                    }
                                    className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                                      isCorrect
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-slate-300 bg-white text-slate-400"
                                    }`}
                                    title="Tandai sebagai jawaban benar"
                                  >
                                    ✓
                                  </button>
                                  <input
                                    type="text"
                                    value={opt.text ?? ""} // <= FIX: never null
                                    onChange={(e) =>
                                      handleOptionChange(
                                        qIndex,
                                        optIndex,
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-red-500"
                                    placeholder={`Opsi ${optIndex + 1}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveOption(qIndex, optIndex)
                                    }
                                    className="text-[10px] text-slate-400 hover:text-red-600"
                                    title="Hapus opsi"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIndex)}
                            className="mt-2 inline-flex items-center rounded-full border border-slate-300 px-3 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-900 hover:text-white transition"
                          >
                            + Tambah opsi
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Footer actions */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="text-[10px] text-slate-500">
                  Perubahan soal belum tersimpan akan hilang jika Anda
                  meninggalkan halaman.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!editingQuestions || savingQuestions}
                    onClick={handleResetQuestionsDraft}
                    className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={savingQuestions || questionsDraft.length === 0}
                    onClick={() => void handleSaveQuestions()}
                    className="inline-flex items-center rounded-full border border-red-600 bg-red-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {savingQuestions ? "Menyimpan..." : "Simpan Soal"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Attempts card */}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Attempt Mahasiswa
                </h2>
                <p className="text-[11px] text-slate-500">
                  Rekap mahasiswa yang sudah mengerjakan quiz ini.
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                Total attempt: {attempts.length}
              </span>
            </div>

            {attempts.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Belum ada mahasiswa yang mengerjakan quiz ini.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-3 py-2 text-left font-medium">
                        Mahasiswa
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        NIM / Username
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Mulai
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Selesai
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Skor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt, index) => (
                      <tr
                        key={attempt.id}
                        className={
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                        }
                      >
                        <td className="px-3 py-2 align-top text-slate-900">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {attempt.student.name}
                            </span>
                            {attempt.student.email && (
                              <span className="text-[10px] text-slate-500">
                                {attempt.student.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-900">
                          <div className="flex flex-col">
                            {attempt.student.nim && (
                              <span className="text-[11px] text-slate-700">
                                {attempt.student.nim}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500">
                              {attempt.student.username}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-900">
                          <span className="text-[11px]">
                            {attempt.started_at
                              ? formatDateTime(attempt.started_at)
                              : "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-900">
                          <span className="text-[11px]">
                            {attempt.submitted_at
                              ? formatDateTime(attempt.submitted_at)
                              : "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-right text-slate-900">
                          <span className="inline-flex items-center justify-end rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                            {attempt.score ?? "-"}
                            {quiz.max_score != null && " / "}
                            {quiz.max_score != null && quiz.max_score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherQuizDetailPage;
