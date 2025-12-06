"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";

interface CourseTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sks: number;
  semester_recommendation: string | null;
  is_active: boolean;
  created_at?: string;
}

type ActiveFilter = "all" | "active" | "inactive";

type FormMode = "create" | "edit";

interface TemplateFormState {
  id?: number;
  code: string;
  name: string;
  description: string;
  sks: string;
  semester_recommendation: string;
  is_active: boolean;
}

const emptyForm: TemplateFormState = {
  code: "",
  name: "",
  description: "",
  sks: "",
  semester_recommendation: "",
  is_active: true,
};

function extractArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "data" in value) {
    const obj = value as { data?: unknown };
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

const CourseTemplateListPage: React.FC = () => {
  const router = useRouter();

  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // modal form
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formState, setFormState] = useState<TemplateFormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // toggle active
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadTemplates = async () => {
    setError(null);
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (activeFilter === "active") params.is_active = "1";
      if (activeFilter === "inactive") params.is_active = "0";

      const res = await apiGet<unknown>("/api/admin/course-templates", params, {
        withAuth: true,
      });

      const list = extractArray<CourseTemplate>(res);
      setTemplates(list);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal memuat template mata kuliah.");
      } else {
        setError("Terjadi kesalahan saat memuat template mata kuliah.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleApplyFilter = async () => {
    setRefreshing(true);
    await loadTemplates();
    setRefreshing(false);
  };

  const openCreateForm = () => {
    setFormMode("create");
    setFormState(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (tpl: CourseTemplate) => {
    setFormMode("edit");
    setFormState({
      id: tpl.id,
      code: tpl.code,
      name: tpl.name,
      description: tpl.description ?? "",
      sks: tpl.sks.toString(),
      semester_recommendation: tpl.semester_recommendation ?? "",
      is_active: tpl.is_active,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormState(emptyForm);
    setFormError(null);
  };

  const handleFormChange = <K extends keyof TemplateFormState>(
    field: K,
    value: TemplateFormState[K]
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formState.code.trim() || !formState.name.trim()) {
      setFormError("Kode dan nama mata kuliah wajib diisi.");
      return;
    }

    const sksNumber = Number.parseInt(formState.sks || "0", 10);
    if (!Number.isFinite(sksNumber) || sksNumber <= 0) {
      setFormError("SKS harus berupa angka dan lebih dari 0.");
      return;
    }

    try {
      setFormSubmitting(true);

      const payload: Record<string, unknown> = {
        code: formState.code.trim(),
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        sks: sksNumber,
        semester_recommendation:
          formState.semester_recommendation.trim() || null,
        is_active: formState.is_active,
      };

      if (formMode === "create") {
        await apiPost<unknown>("/api/admin/course-templates", payload, {
          withAuth: true,
        });
      } else {
        if (!formState.id) {
          throw new Error("ID template tidak valid.");
        }
        await apiPut<unknown>(
          `/api/admin/course-templates/${formState.id}`,
          payload,
          { withAuth: true }
        );
      }

      closeForm();
      await loadTemplates();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message || "Gagal menyimpan template.");
      } else {
        setFormError("Terjadi kesalahan saat menyimpan template.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (tpl: CourseTemplate) => {
    setTogglingId(tpl.id);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        code: tpl.code,
        name: tpl.name,
        description: tpl.description,
        sks: tpl.sks,
        semester_recommendation: tpl.semester_recommendation,
        is_active: !tpl.is_active,
      };

      await apiPut<unknown>(`/api/admin/course-templates/${tpl.id}`, payload, {
        withAuth: true,
      });

      setTemplates((prev) =>
        prev.map((t) =>
          t.id === tpl.id ? { ...t, is_active: !tpl.is_active } : t
        )
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal mengubah status template.");
      } else {
        setError("Terjadi kesalahan saat mengubah status template.");
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (tpl: CourseTemplate) => {
    const ok = window.confirm(
      `Hapus template "${tpl.code} - ${tpl.name}" dari sistem?`
    );
    if (!ok) return;

    setDeleteId(tpl.id);
    setError(null);

    try {
      await apiDelete<unknown>(
        `/api/admin/course-templates/${tpl.id}`,
        undefined,
        { withAuth: true }
      );

      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal menghapus template.");
      } else {
        setError("Terjadi kesalahan saat menghapus template.");
      }
    } finally {
      setDeleteId(null);
    }
  };

  const isLoadingList = loading && !refreshing;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Template Mata Kuliah
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span>Tambah template</span>
            </button>
          </div>
        </div>

        {/* Filter & search */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                activeFilter === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("active")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                activeFilter === "active"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("inactive")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                activeFilter === "inactive"
                  ? "border-slate-500 bg-slate-100 text-slate-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Non-aktif
            </button>
          </div>

          <div className="flex-1 min-w-[160px] flex items-center gap-2 justify-end">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode / nama mata kuliah"
              className="w-full max-w-xs rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
            />
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

        {/* Error global */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Tabel template */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Mata kuliah
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    SKS
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Rekomendasi semester
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
                      colSpan={5}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Memuat template...
                    </td>
                  </tr>
                )}

                {!isLoadingList && templates.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Belum ada template mata kuliah.
                    </td>
                  </tr>
                )}

                {!isLoadingList &&
                  templates.map((tpl) => (
                    <tr
                      key={tpl.id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/superadmin/templates/${tpl.id}`)
                          }
                          className="text-left"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {tpl.code}
                            </span>
                            <span className="text-xs font-medium text-slate-900">
                              {tpl.name}
                            </span>
                            {tpl.description && (
                              <span className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                                {tpl.description}
                              </span>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                          {tpl.sks} SKS
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        {tpl.semester_recommendation ? (
                          <span className="text-[11px] text-slate-700">
                            {tpl.semester_recommendation}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(tpl)}
                          disabled={togglingId === tpl.id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                            tpl.is_active
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-slate-400 bg-slate-100 text-slate-700"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {tpl.is_active ? "Aktif" : "Non-aktif"}
                        </button>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditForm(tpl)}
                            className="px-2 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tpl)}
                            disabled={deleteId === tpl.id}
                            className="px-2 py-1 rounded-full border border-slate-300 bg-slate-100 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {deleteId === tpl.id ? "Hapus..." : "Hapus"}
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

      {/* Modal form tambah/edit template */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl px-5 py-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-xl bg-red-700 text-white text-xs font-semibold">
                  T
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formMode === "create"
                    ? "Tambah template mata kuliah"
                    : "Edit template mata kuliah"}
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

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Kode mata kuliah
                  </label>
                  <input
                    type="text"
                    value={formState.code}
                    onChange={(e) => handleFormChange("code", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                    placeholder="IF101"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    SKS
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formState.sks}
                    onChange={(e) => handleFormChange("sks", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                    placeholder="3"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Nama mata kuliah
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  placeholder="Pengantar Informatika & TIK"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Deskripsi singkat
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) =>
                    handleFormChange("description", e.target.value)
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 resize-none"
                  placeholder="Deskripsi mata kuliah (opsional)"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Rekomendasi semester
                </label>
                <input
                  type="text"
                  value={formState.semester_recommendation}
                  onChange={(e) =>
                    handleFormChange("semester_recommendation", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  placeholder="Contoh: Semester 1, Tahun pertama"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formState.is_active}
                    onChange={(e) =>
                      handleFormChange("is_active", e.target.checked)
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-red-700 focus:ring-red-600"
                  />
                  <span>Template aktif</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
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
                    ? "Simpan template"
                    : "Update template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CourseTemplateListPage;
