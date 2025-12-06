"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, type ApiError } from "@/lib/apiClient";

interface AssignmentDetail {
  id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  type: "file" | "link";
  deadline: string | null;
  max_score: number | null;
  allow_late: boolean;
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

interface SubmissionStudent {
  id: number;
  name: string;
  username: string;
  nim: string | null;
  email: string | null;
}

interface AssignmentSubmissionItem {
  id: number;
  student: SubmissionStudent;
  submitted_at: string | null;
  file_url?: string | null;
  link_url?: string | null;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
}

interface TeacherAssignmentSubmissionsResponse {
  assignment: AssignmentDetail;
  submissions: AssignmentSubmissionItem[];
}

interface SubmissionEdit {
  score: string;
  feedback: string;
}

interface SubmissionEditMap {
  [submissionId: number]: SubmissionEdit;
}

interface SubmissionSubmittingMap {
  [submissionId: number]: boolean;
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

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

const TeacherAssignmentDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const assignmentId = (params?.id ?? "") as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(
    null
  );
  const [submissions, setSubmissions] = useState<
    AssignmentSubmissionItem[]
  >([]);

  const [edits, setEdits] = useState<SubmissionEditMap>({});
  const [submittingMap, setSubmittingMap] =
    useState<SubmissionSubmittingMap>({});
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId) return;

    let isActive = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setGlobalMessage(null);
      try {
        const data = await apiGet<TeacherAssignmentSubmissionsResponse>(
          `/api/teacher/assignments/${assignmentId}/submissions`
        );
        if (!isActive) return;

        setAssignment(data.assignment);
        setSubmissions(data.submissions);

        const initialEdits: SubmissionEditMap = {};
        data.submissions.forEach((submission) => {
          initialEdits[submission.id] = {
            score:
              submission.score !== null && submission.score !== undefined
                ? String(submission.score)
                : "",
            feedback: submission.feedback ?? "",
          };
        });
        setEdits(initialEdits);
      } catch (err: unknown) {
        if (!isActive) return;
        const message = extractErrorMessage(
          err,
          "Gagal memuat detail tugas dan submission."
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
  }, [assignmentId]);

  const handleBack = () => {
    if (
      assignment &&
      assignment.course_instance &&
      assignment.course_instance.id
    ) {
      router.push(
        `/teacher/courses/${assignment.course_instance.id.toString()}`
      );
    } else {
      router.push("/teacher");
    }
  };

  const handleChangeScore = (submissionId: number, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [submissionId]: {
        score: value,
        feedback: prev[submissionId]?.feedback ?? "",
      },
    }));
  };

  const handleChangeFeedback = (submissionId: number, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [submissionId]: {
        score: prev[submissionId]?.score ?? "",
        feedback: value,
      },
    }));
  };

  const handleSubmitGrade = async (submissionId: number) => {
    const edit = edits[submissionId];
    if (!edit) return;

    const scoreValue = parseNumberOrNull(edit.score);
    const feedbackValue = edit.feedback.trim();

    setSubmittingMap((prev) => ({
      ...prev,
      [submissionId]: true,
    }));
    setGlobalMessage(null);
    setError(null);

    try {
      await apiPost(
        `/api/teacher/assignment-submissions/${submissionId}/grade`,
        {
          score: scoreValue,
          feedback: feedbackValue.length > 0 ? feedbackValue : null,
        }
      );

      setSubmissions((prev) =>
        prev.map((submission) => {
          if (submission.id !== submissionId) return submission;
          return {
            ...submission,
            score: scoreValue,
            feedback: feedbackValue.length > 0 ? feedbackValue : null,
            graded_at: new Date().toISOString(),
          };
        })
      );

      setGlobalMessage("Nilai dan feedback berhasil disimpan.");
    } catch (err: unknown) {
      const message = extractErrorMessage(
        err,
        "Gagal menyimpan nilai tugas."
      );
      setError(message);
    } finally {
      setSubmittingMap((prev) => ({
        ...prev,
        [submissionId]: false,
      }));
    }
  };

  const totalSubmissions = submissions.length;
  const gradedCount = submissions.filter(
    (sub) => sub.score !== null && sub.score !== undefined
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
              Detail Tugas
            </h1>
            {assignment && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {assignment.course_instance?.template
                  ? `${assignment.course_instance.template.code} — ${assignment.course_instance.template.name}`
                  : "Tanpa template"}{" "}
                {assignment.course_instance
                  ? `• Kelas ${assignment.course_instance.class_name} • Semester ${assignment.course_instance.semester}`
                  : ""}
              </p>
            )}
          </div>
        </div>
        {assignment && (
          <div className="text-right text-[11px] text-slate-500">
            Dibuat pada {formatDate(assignment.created_at)}
          </div>
        )}
      </div>

      {/* Info Assignment */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-900">
            {assignment ? assignment.title : "Memuat judul tugas..."}
          </p>
          {assignment && assignment.description && (
            <p className="text-[11px] text-slate-600 whitespace-pre-wrap">
              {assignment.description}
            </p>
          )}
          {assignment && assignment.instructions && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
              <p className="mb-1 font-semibold text-slate-900">
                Instruksi untuk mahasiswa
              </p>
              <p className="whitespace-pre-wrap">
                {assignment.instructions}
              </p>
            </div>
          )}
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-[11px]">
          <p className="text-xs font-semibold text-slate-900">
            Ringkasan Tugas
          </p>
          {assignment ? (
            <>
              <p className="text-slate-600">
                Tipe jawaban:{" "}
                <span className="font-semibold text-slate-900">
                  {assignment.type === "file" ? "File upload" : "Link"}
                </span>
              </p>
              <p className="text-slate-600">
                Deadline:{" "}
                <span className="font-semibold text-slate-900">
                  {formatDateTime(assignment.deadline)}
                </span>
              </p>
              <p className="text-slate-600">
                Nilai maksimal:{" "}
                <span className="font-semibold text-slate-900">
                  {assignment.max_score ?? 100}
                </span>
              </p>
              <p className="text-slate-600">
                Telat:{" "}
                <span className="font-semibold text-slate-900">
                  {assignment.allow_late ? "Diizinkan" : "Tidak diizinkan"}
                </span>
              </p>
              <p className="mt-2 text-slate-600">
                Submission dinilai:{" "}
                <span className="font-semibold text-slate-900">
                  {gradedCount}/{totalSubmissions}
                </span>
              </p>
            </>
          ) : (
            <p className="text-slate-400">Memuat informasi tugas...</p>
          )}
        </div>
      </div>

      {/* Global messages */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}
      {globalMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {globalMessage}
        </div>
      )}

      {/* Submissions Table */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-900">
          Submission Mahasiswa
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
        ) : submissions.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            Belum ada submission dari mahasiswa.
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
                    Waktu submit
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Jawaban
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Nilai
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-700">
                    Feedback
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-700">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission, index) => {
                  const edit = edits[submission.id] ?? {
                    score: "",
                    feedback: "",
                  };
                  const isSubmitting =
                    submittingMap[submission.id] ?? false;
                  const hasSubmitted =
                    submission.submitted_at !== null &&
                    submission.submitted_at !== undefined;

                  const rowBg =
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/60";

                  const displayScore =
                    submission.score !== null &&
                    submission.score !== undefined;

                  const answerUrl =
                    submission.file_url && submission.file_url.length > 0
                      ? submission.file_url
                      : submission.link_url && submission.link_url.length > 0
                        ? submission.link_url
                        : null;

                  return (
                    <tr key={submission.id} className={rowBg}>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-[10px] font-semibold text-white">
                            {submission.student.name
                              .split(" ")
                              .map((part) => part.charAt(0))
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {submission.student.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {submission.student.username}
                              {submission.student.nim
                                ? ` • ${submission.student.nim}`
                                : ""}
                            </p>
                            {submission.student.email && (
                              <p className="text-[10px] text-slate-500">
                                {submission.student.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                        {hasSubmitted ? (
                          <>
                            <p>{formatDateTime(submission.submitted_at)}</p>
                            {submission.graded_at && (
                              <p className="mt-0.5 text-[10px] text-emerald-700">
                                Dinilai {formatDateTime(submission.graded_at)}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-slate-400">
                            Belum submit
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                        {answerUrl ? (
                          <a
                            href={answerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] text-red-600 hover:bg-slate-100 hover:underline"
                          >
                            Lihat jawaban
                          </a>
                        ) : hasSubmitted ? (
                          <span className="text-[10px] text-slate-400">
                            Jawaban tersedia, tapi link tidak disediakan.
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="space-y-1">
                          {displayScore && (
                            <p className="text-[10px] text-slate-500">
                              Nilai saat ini:{" "}
                              <span className="font-semibold text-slate-900">
                                {submission.score}
                              </span>
                            </p>
                          )}
                          <input
                            type="number"
                            min={0}
                            max={assignment?.max_score ?? 100}
                            value={edit.score}
                            onChange={(e) =>
                              handleChangeScore(
                                submission.id,
                                e.target.value
                              )
                            }
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-red-500"
                            placeholder="Nilai"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <textarea
                          value={edit.feedback}
                          onChange={(e) =>
                            handleChangeFeedback(
                              submission.id,
                              e.target.value
                            )
                          }
                          className="min-h-[60px] w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 outline-none focus:border-red-500"
                          placeholder="Feedback singkat untuk mahasiswa..."
                        />
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          disabled={isSubmitting || !hasSubmitted}
                          onClick={() => void handleSubmitGrade(submission.id)}
                          className="inline-flex items-center rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <>
                              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                              Menyimpan...
                            </>
                          ) : (
                            "Simpan nilai"
                          )}
                        </button>
                        {!hasSubmitted && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Mahasiswa belum mengumpulkan.
                          </p>
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

export default TeacherAssignmentDetailPage;
