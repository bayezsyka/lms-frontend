"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiGet, apiPost, apiDelete } from "@/lib/apiClient";

type CourseStatus = "draft" | "active" | "finished";

interface TemplateLite {
  id: number;
  code: string;
  name: string;
}

interface LecturerLite {
  id: number;
  name: string;
  username: string;
}

interface ClassLite {
  id: number;
  course_template_id: number;
  class_name: string;
  semester: string;
  status: CourseStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  template?: TemplateLite | null;
  lecturer?: LecturerLite | null;
}

type EnrollmentStatus = "active" | "dropped";

interface StudentLite {
  id: number;
  name: string;
  username: string;
  nim: string | null;
  email: string | null;
  role: string;
  user_status: "active" | "inactive";
}

interface EnrollmentItem {
  enrollment_id: number;
  status: EnrollmentStatus;
  enrolled_at?: string | null;
  dropped_at?: string | null;
  student: StudentLite;
}

interface ClassStudentsResponse {
  class: ClassLite;
  students: EnrollmentItem[];
}

const statusLabel = (status: CourseStatus) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "Aktif";
    case "finished":
      return "Selesai";
    default:
      return status;
  }
};

const statusChipClass = (status: CourseStatus) => {
  switch (status) {
    case "draft":
      return "border-slate-400 bg-slate-100 text-slate-700";
    case "active":
      return "border-emerald-600 bg-emerald-50 text-emerald-700";
    case "finished":
      return "border-sky-600 bg-sky-50 text-sky-700";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
};

const enrollmentStatusChip = (status: EnrollmentStatus) => {
  switch (status) {
    case "active":
      return "border-emerald-600 bg-emerald-50 text-emerald-700";
    case "dropped":
      return "border-slate-400 bg-slate-100 text-slate-600";
    default:
      return "border-slate-300 bg-slate-100 text-slate-700";
  }
};

const ClassDetailPage: React.FC = () => {
  const router = useRouter();
  const params = useParams(); // <--- WAJIB DI NEXT 16
  const classId = (params?.id ?? "") as string;

  const [classInfo, setClassInfo] = useState<ClassLite | null>(null);
  const [students, setStudents] = useState<EnrollmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusUpdating, setStatusUpdating] = useState<CourseStatus | null>(
    null
  );

  const [nimOrUsername, setNimOrUsername] = useState<string>("");
  const [addingStudent, setAddingStudent] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removingStudentId, setRemovingStudentId] = useState<number | null>(
    null
  );

  const loadData = async (id: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiGet<ClassStudentsResponse>(
        `/api/admin/course-instances/${id}/students`,
        undefined,
        { withAuth: true }
      );
      setClassInfo(res.class);
      setStudents(res.students ?? []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal memuat detail kelas.");
      } else {
        setError("Terjadi kesalahan saat memuat detail kelas.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!classId) return;
    void loadData(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const handleChangeStatus = async (status: CourseStatus) => {
    if (!classInfo || !classId || classInfo.status === status) return;
    setStatusUpdating(status);
    setError(null);
    try {
      await apiPost<unknown>(
        `/api/admin/course-instances/${classId}/status`,
        { status },
        { withAuth: true }
      );
      setClassInfo({ ...classInfo, status });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal mengubah status kelas.");
      } else {
        setError("Terjadi kesalahan saat mengubah status kelas.");
      }
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleAddStudent = async () => {
    if (!classId || !nimOrUsername.trim()) return;
    setAddingStudent(true);
    setAddError(null);

    try {
      const body = { nim: nimOrUsername.trim() }; // backend: nim ATAU username
      const res = await apiPost<
        { enrollment: EnrollmentItem; message?: string } | EnrollmentItem
      >(
        `/api/admin/course-instances/${classId}/students`,
        body,
        { withAuth: true }
      );

      const enrollment =
        "enrollment" in res ? res.enrollment : (res as EnrollmentItem);

      setStudents((prev) => {
        const exists = prev.find(
          (s) => s.enrollment_id === enrollment.enrollment_id
        );
        if (exists) {
          return prev.map((s) =>
            s.enrollment_id === enrollment.enrollment_id ? enrollment : s
          );
        }
        return [...prev, enrollment];
      });

      setNimOrUsername("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAddError(err.message || "Gagal menambahkan mahasiswa.");
      } else {
        setAddError("Terjadi kesalahan saat menambahkan mahasiswa.");
      }
    } finally {
      setAddingStudent(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!classId) return;
    const ok = window.confirm("Hapus mahasiswa ini dari kelas?");
    if (!ok) return;

    setRemovingStudentId(studentId);
    setError(null);

    try {
      await apiDelete<unknown>(
        `/api/admin/course-instances/${classId}/students/${studentId}`,
        undefined,
        { withAuth: true }
      );

      setStudents((prev) =>
        prev.map((s) =>
          s.student.id === studentId
            ? { ...s, status: "dropped" as EnrollmentStatus }
            : s
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal menghapus mahasiswa dari kelas.");
      } else {
        setError("Terjadi kesalahan saat menghapus mahasiswa dari kelas.");
      }
    } finally {
      setRemovingStudentId(null);
    }
  };

  const participantsCount = students.length;

  const renderContent = () => {
    if (loading && !classInfo) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-xs text-slate-500">
          Memuat detail kelas...
        </div>
      );
    }

    if (!classInfo) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-xs text-red-800">
          Detail kelas tidak ditemukan.
        </div>
      );
    }

    const tpl = classInfo.template;
    const lecturer = classInfo.lecturer;

    return (
      <>
        {/* Info atas */}
        <div className="grid gap-4 md:grid-cols-[2fr,minmax(220px,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Mata Kuliah
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {tpl ? (
                    <>
                      <span className="mr-1 text-[11px] font-semibold uppercase text-slate-500">
                        {tpl.code}
                      </span>
                      <span>— {tpl.name}</span>
                    </>
                  ) : (
                    "-"
                  )}
                </div>
                <div className="mt-2 grid gap-2 text-[11px] text-slate-700 md:grid-cols-2">
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-600">Semester</div>
                    <div>{classInfo.semester}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-600">Kelas</div>
                    <div>{classInfo.class_name}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-600">
                      Dosen pengampu
                    </div>
                    <div>
                      {lecturer ? (
                        <>
                          {lecturer.name}{" "}
                          <span className="text-slate-500 text-[11px]">
                            ({lecturer.username})
                          </span>
                        </>
                      ) : (
                        "-"
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-600">
                      Tanggal mulai
                    </div>
                    <div className="flex items-center gap-4">
                      <span>
                        {classInfo.start_date
                          ? classInfo.start_date
                          : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-medium text-slate-600">
                      Tanggal selesai
                    </div>
                    <div>
                      {classInfo.end_date ? classInfo.end_date : "-"}
                    </div>
                  </div>
                  {classInfo.notes && (
                    <div className="space-y-0.5 md:col-span-2">
                      <div className="font-medium text-slate-600">
                        Catatan
                      </div>
                      <div>{classInfo.notes}</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${statusChipClass(
                    classInfo.status
                  )}`}
                >
                  {statusLabel(classInfo.status)}
                </span>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
                  <button
                    type="button"
                    onClick={() => handleChangeStatus("draft")}
                    className={`px-2 py-0.5 rounded-full border text-[10px] ${
                      classInfo.status === "draft"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    disabled={statusUpdating === "draft"}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeStatus("active")}
                    className={`px-2 py-0.5 rounded-full border text-[10px] ${
                      classInfo.status === "active"
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    disabled={statusUpdating === "active"}
                  >
                    Aktif
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeStatus("finished")}
                    className={`px-2 py-0.5 rounded-full border text-[10px] ${
                      classInfo.status === "finished"
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    disabled={statusUpdating === "finished"}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Ringkasan peserta */}
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Ringkasan peserta
              </div>
              <div className="text-2xl font-semibold text-slate-900">
                {participantsCount}
              </div>
              <div className="text-[11px] text-slate-600">mahasiswa</div>
            </div>
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => classId && loadData(classId)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
              >
                Refresh daftar
              </button>
            </div>
          </div>
        </div>

        {/* Mahasiswa di kelas ini */}
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">
              Mahasiswa di kelas ini
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nimOrUsername}
                onChange={(e) => setNimOrUsername(e.target.value)}
                placeholder="NIM atau username"
                className="w-[220px] rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
              />
              <button
                type="button"
                onClick={handleAddStudent}
                disabled={addingStudent || !nimOrUsername.trim()}
                className="rounded-full bg-red-700 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addingStudent ? "Menambah..." : "Tambah mahasiswa"}
              </button>
            </div>
          </div>

          {addError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              {addError}
            </div>
          )}

          <div className="mt-2 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="min-w-full overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">
                      Mahasiswa
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">
                      NIM
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-5 text-center text-slate-400"
                      >
                        Belum ada mahasiswa di kelas ini.
                      </td>
                    </tr>
                  )}

                  {students.map((item) => (
                    <tr
                      key={item.enrollment_id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 align-middle">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-900">
                            {item.student?.name ?? "-"}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {item.student?.username ?? ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <span className="text-[11px] text-slate-800">
                          {item.student?.nim ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${enrollmentStatusChip(
                            item.status
                          )}`}
                        >
                          {item.status === "active" ? "Aktif" : "Dropped"}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveStudent(item.student.id)
                            }
                            disabled={
                              removingStudentId === item.student.id ||
                              item.status === "dropped"
                            }
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {item.status === "dropped"
                              ? "Sudah di-drop"
                              : removingStudentId === item.student.id
                              ? "Menghapus..."
                              : "Hapus dari kelas"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb + back */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/superadmin/classes")}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
          >
            Kembali
          </button>
          {classInfo && classInfo.template && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>{classInfo.template.code}</span>
              <span>•</span>
              <span>Kelas {classInfo.class_name}</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {error}
        </div>
      )}

      {renderContent()}
    </div>
  );
};

export default ClassDetailPage;
