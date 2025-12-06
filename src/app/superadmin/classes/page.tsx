"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

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

interface CourseInstance {
  id: number;
  class_name: string;
  semester: string;
  status: CourseStatus;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  course_template_id?: number;
  lecturer_id?: number;
  // backend bisa kirim salah satu dari ini, jadi kita pegang dua2nya
  course_template?: CourseTemplateLite;
  template?: CourseTemplateLite;
  lecturer?: LecturerLite;
}

type StatusFilter = "all" | CourseStatus;

interface ClassFormState {
  id?: number;
  course_template_id: string;
  class_name: string;
  semester: string;
  lecturer_id: string;
  status: CourseStatus;
  start_date: string;
  end_date: string;
  notes: string;
}

const emptyForm: ClassFormState = {
  course_template_id: "",
  class_name: "",
  semester: "",
  lecturer_id: "",
  status: "draft",
  start_date: "",
  end_date: "",
  notes: "",
};

const ClassListPage: React.FC = () => {
  const router = useRouter();

  const [classes, setClasses] = useState<CourseInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [semesterFilter, setSemesterFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // data pendukung untuk form
  const [templates, setTemplates] = useState<CourseTemplateLite[]>([]);
  const [lecturers, setLecturers] = useState<LecturerLite[]>([]);
  const [metaLoading, setMetaLoading] = useState<boolean>(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // modal form
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<ClassFormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ---------- LOAD LIST KELAS ----------

  const loadClasses = async () => {
    setError(null);
    setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (semesterFilter.trim()) {
        params.semester = semesterFilter.trim();
      }
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const res = await apiGet<CourseInstance[]>(
        "/api/admin/course-instances",
        params,
        { withAuth: true }
      );

      setClasses(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal memuat daftar kelas.");
      } else {
        setError("Terjadi kesalahan saat memuat daftar kelas.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilter = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  // ---------- LOAD TEMPLATE & DOSEN ----------

  const loadMeta = async () => {
    setMetaError(null);
    setMetaLoading(true);
    try {
      const [tplRes, lecRes] = await Promise.all([
        apiGet<CourseTemplateLite[]>(
          "/api/admin/course-templates",
          { is_active: "1" },
          { withAuth: true }
        ),
        apiGet<
          {
            id: number;
            name: string;
            username: string;
            role: string;
          }[]
        >("/api/admin/users", { role: "dosen" }, { withAuth: true }),
      ]);

      setTemplates(tplRes);
      const mappedLecturers: LecturerLite[] = lecRes.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
      }));
      setLecturers(mappedLecturers);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMetaError(err.message || "Gagal memuat data pendukung.");
      } else {
        setMetaError("Terjadi kesalahan saat memuat data pendukung.");
      }
    } finally {
      setMetaLoading(false);
    }
  };

  // ---------- HELPERS ----------

  const getStatusLabel = (status: CourseStatus) => {
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

  const getStatusStyle = (status: CourseStatus) => {
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

  const getTemplateInfo = (ci: CourseInstance) => {
    const tpl = ci.course_template ?? ci.template;
    if (!tpl) {
      return {
        code: "",
        name: "-",
      };
    }
    return {
      code: tpl.code,
      name: tpl.name,
    };
  };

  const isLoadingList = loading && !refreshing;

  // ---------- FORM MODAL ----------

  const openCreateForm = async () => {
    setFormMode("create");
    setFormState({
      ...emptyForm,
      status: "draft",
    });
    setFormError(null);
    setFormOpen(true);
    if (templates.length === 0 || lecturers.length === 0) {
      await loadMeta();
    }
  };

  const openEditForm = async (ci: CourseInstance) => {
    setFormMode("edit");
    setFormError(null);

    const tpl = ci.course_template ?? ci.template;
    const templateId = ci.course_template_id ?? tpl?.id;
    const lecturerId = ci.lecturer_id ?? ci.lecturer?.id;

    setFormState({
      id: ci.id,
      course_template_id: templateId ? String(templateId) : "",
      class_name: ci.class_name ?? "",
      semester: ci.semester ?? "",
      lecturer_id: lecturerId ? String(lecturerId) : "",
      status: ci.status,
      start_date: ci.start_date ? ci.start_date.slice(0, 10) : "",
      end_date: ci.end_date ? ci.end_date.slice(0, 10) : "",
      notes: ci.notes ?? "",
    });

    setFormOpen(true);
    if (templates.length === 0 || lecturers.length === 0) {
      await loadMeta();
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormState(emptyForm);
    setFormError(null);
  };

  const handleFormChange = <K extends keyof ClassFormState>(
    field: K,
    value: ClassFormState[K]
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formState.course_template_id) {
      setFormError("Pilih mata kuliah.");
      return;
    }
    if (!formState.class_name.trim()) {
      setFormError("Nama kelas wajib diisi.");
      return;
    }
    if (!formState.semester.trim()) {
      setFormError("Semester wajib diisi.");
      return;
    }
    if (!formState.lecturer_id) {
      setFormError("Pilih dosen pengampu.");
      return;
    }

    const courseTemplateId = Number.parseInt(formState.course_template_id, 10);
    const lecturerId = Number.parseInt(formState.lecturer_id, 10);

    if (!Number.isFinite(courseTemplateId) || !Number.isFinite(lecturerId)) {
      setFormError("Data mata kuliah atau dosen tidak valid.");
      return;
    }

    const payload: Record<string, unknown> = {
      course_template_id: courseTemplateId,
      class_name: formState.class_name.trim(),
      semester: formState.semester.trim(),
      lecturer_id: lecturerId,
      status: formState.status,
      start_date: formState.start_date || null,
      end_date: formState.end_date || null,
      notes: formState.notes.trim() || null,
    };

    try {
      setFormSubmitting(true);

      if (formMode === "create") {
        await apiPost<unknown>("/api/admin/course-instances", payload, {
          withAuth: true,
        });
      } else {
        if (!formState.id) {
          throw new Error("ID kelas tidak valid.");
        }
        await apiPut<unknown>(
          `/api/admin/course-instances/${formState.id}`,
          payload,
          { withAuth: true }
        );
      }

      closeForm();
      await loadClasses();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message || "Gagal menyimpan kelas.");
      } else {
        setFormError("Terjadi kesalahan saat menyimpan kelas.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // ---------- DELETE KELAS ----------

  const handleDeleteClass = async (ci: CourseInstance) => {
    const tplInfo = getTemplateInfo(ci);
    const ok = window.confirm(
      `Hapus kelas ${tplInfo.code || ci.id} ${
        ci.class_name
      } (${ci.semester}) dari sistem?`
    );
    if (!ok) return;

    setDeleteId(ci.id);
    setError(null);

    try {
      await apiDelete<unknown>(
        `/api/admin/course-instances/${ci.id}`,
        undefined,
        { withAuth: true }
      );

      setClasses((prev) => prev.filter((c) => c.id !== ci.id));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal menghapus kelas.");
      } else {
        setError("Terjadi kesalahan saat menghapus kelas.");
      }
    } finally {
      setDeleteId(null);
    }
  };

  // ---------- RENDER ----------

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Kelas per Semester
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
              <span>Buat kelas baru</span>
            </button>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
              {classes.length} kelas
            </span>
          </div>
        </div>

        {/* Filter */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[11px]">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-slate-700">
                Semester
              </div>
              <input
                type="text"
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                placeholder="Contoh: 2025/2026 Ganjil"
                className="w-[220px] rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                statusFilter === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Semua status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                statusFilter === "draft"
                  ? "border-slate-500 bg-slate-100 text-slate-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                statusFilter === "active"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("finished")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                statusFilter === "finished"
                  ? "border-sky-600 bg-sky-50 text-sky-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Selesai
            </button>
          </div>

          <div className="flex-1 flex items-center justify-end">
            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={refreshing}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {refreshing ? "Memuat..." : "Terapkan"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Tabel */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Mata kuliah
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Kelas
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Semester
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Dosen
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
                {isLoadingList && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Memuat daftar kelas...
                    </td>
                  </tr>
                )}

                {!isLoadingList && classes.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Belum ada kelas untuk filter ini.
                    </td>
                  </tr>
                )}

                {!isLoadingList &&
                  classes.map((ci) => {
                    const tplInfo = getTemplateInfo(ci);
                    const lecturerLabel = ci.lecturer
                      ? `${ci.lecturer.name} (${ci.lecturer.username})`
                      : "-";

                    return (
                      <tr
                        key={ci.id}
                        className="border-t border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-2 align-middle">
                          <div className="flex flex-col">
                            {tplInfo.code && (
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {tplInfo.code}
                              </span>
                            )}
                            <span className="text-xs font-medium text-slate-900">
                              {tplInfo.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                            {ci.class_name || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <span className="text-[11px] text-slate-700">
                            {ci.semester}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <span className="text-[11px] text-slate-700">
                            {lecturerLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${getStatusStyle(
                              ci.status
                            )}`}
                          >
                            {getStatusLabel(ci.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditForm(ci)}
                              className="px-3 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/superadmin/classes/${encodeURIComponent(
                                    ci.id
                                  )}`
                                )
                              }
                              className="px-3 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                            >
                              Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(ci)}
                              disabled={deleteId === ci.id}
                              className="px-3 py-1 rounded-full border border-slate-300 bg-slate-100 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {deleteId === ci.id ? "Hapus..." : "Hapus"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal form create/edit kelas */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl px-5 py-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-xl bg-red-700 text-white text-xs font-semibold">
                  K
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formMode === "create" ? "Buat kelas baru" : "Edit kelas"}
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="text-[11px] px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            {metaLoading && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                Memuat daftar mata kuliah & dosen...
              </div>
            )}

            {metaError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
                {metaError}
              </div>
            )}

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Mata kuliah
                </label>
                <select
                  value={formState.course_template_id}
                  onChange={(e) =>
                    handleFormChange("course_template_id", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                >
                  <option value="">Pilih mata kuliah</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.code} — {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Kelas
                  </label>
                  <input
                    type="text"
                    value={formState.class_name}
                    onChange={(e) =>
                      handleFormChange("class_name", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                    placeholder="Contoh: A"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Semester
                  </label>
                  <input
                    type="text"
                    value={formState.semester}
                    onChange={(e) =>
                      handleFormChange("semester", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                    placeholder="2025/2026 Ganjil"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Dosen pengampu
                </label>
                <select
                  value={formState.lecturer_id}
                  onChange={(e) =>
                    handleFormChange("lecturer_id", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                >
                  <option value="">Pilih dosen</option>
                  {lecturers.map((lec) => (
                    <option key={lec.id} value={lec.id}>
                      {lec.name} ({lec.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Tanggal mulai
                  </label>
                  <input
                    type="date"
                    value={formState.start_date}
                    onChange={(e) =>
                      handleFormChange("start_date", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Tanggal selesai
                  </label>
                  <input
                    type="date"
                    value={formState.end_date}
                    onChange={(e) =>
                      handleFormChange("end_date", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Status kelas
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  {(["draft", "active", "finished"] as CourseStatus[]).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleFormChange("status", s)}
                        className={`px-3 py-1.5 rounded-full border text-xs ${
                          formState.status === s
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {getStatusLabel(s)}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Catatan (opsional)
                </label>
                <textarea
                  rows={3}
                  value={formState.notes}
                  onChange={(e) =>
                    handleFormChange("notes", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700 resize-none"
                  placeholder="Catatan internal untuk kelas ini"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-3 py-2 rounded-full border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-full bg-red-700 text-white text-[11px] font-medium hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {formSubmitting
                    ? "Menyimpan..."
                    : formMode === "create"
                    ? "Simpan kelas"
                    : "Update kelas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ClassListPage;
