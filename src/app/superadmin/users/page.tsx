"use client";

import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/apiClient";
import * as XLSX from "xlsx";

type UserRole = "superadmin" | "dosen" | "mahasiswa";
type UserStatus = "active" | "inactive";

interface User {
  id: number;
  name: string;
  email: string | null;
  username: string;
  nim: string | null;
  role: UserRole;
  status: UserStatus;
  force_password_change: boolean;
}

interface ResetPasswordResponse {
  plain_password?: string;
  password?: string;
  message?: string;
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

type UserFormMode = "create" | "edit";

interface UserFormState {
  id?: number;
  name: string;
  email: string;
  username: string;
  nim: string;
  role: UserRole;
  status: UserStatus;
  force_password_change: boolean;
}

const emptyForm: UserFormState = {
  name: "",
  email: "",
  username: "",
  nim: "",
  role: "mahasiswa",
  status: "active",
  force_password_change: true,
};

interface BulkStudentRow {
  order: number; // urutan global hari itu (001, 002, dst)
  name: string;
  nim: string;
  username: string;
  password: string;
}

/**
 * Generate NIM & password:
 * NIM = (TahunMasuk)(BulanMasuk)(TanggalMasuk)(UrutanDataMahasiswa)
 * Password = 7 huruf pertama nama (tanpa spasi, huruf kecil) + (UrutanDataMahasiswa 3 digit)
 */
function generateNimAndPassword(
  name: string,
  order: number,
  date: Date
): { nim: string; password: string; username: string } {
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const orderStr = String(order).padStart(3, "0");

  const nim = `${year}${month}${day}${orderStr}`;

  const normalizedName = name.replace(/\s+/g, "").toLowerCase().slice(0, 7);

  const password = `${normalizedName}${orderStr}`;
  const username = nim; // username = NIM

  return { nim, password, username };
}

/**
 * Cari urutan terakhir (NNN) di NIM mahasiswa yang nim-nya
 * diawali prefix (yyyymmdd) pada tanggal hari ini.
 */
function getNextOrderForToday(users: User[], date: Date): number {
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const prefix = `${year}${month}${day}`;

  let maxOrder = 0;

  users.forEach((u) => {
    if (u.role !== "mahasiswa" || !u.nim) return;
    const nim = u.nim.trim();
    if (!nim.startsWith(prefix)) return;
    const suffix = nim.slice(prefix.length);
    if (suffix.length === 0) return;
    const n = Number.parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > maxOrder) {
      maxOrder = n;
    }
  });

  return maxOrder + 1;
}

type UserSection = "civitas" | "mahasiswa";

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [keyword, setKeyword] = useState<string>("");

  const [section, setSection] = useState<UserSection>("civitas");

  // Form modal
  const [formMode, setFormMode] = useState<UserFormMode>("create");
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formState, setFormState] = useState<UserFormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset password
  const [resetInfo, setResetInfo] = useState<{
    userId: number;
    username: string;
    plainPassword: string;
  } | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<number | null>(null);

  // Toggle status
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  // Delete user
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

  // Bulk import mahasiswa (modal)
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkRows, setBulkRows] = useState<BulkStudentRow[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState<boolean>(false);
  const [bulkGeneratedRows, setBulkGeneratedRows] = useState<BulkStudentRow[]>(
    []
  );

  const loadUsers = async () => {
    setError(null);
    setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (roleFilter !== "all") {
        params.role = roleFilter;
      }
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (keyword.trim()) {
        params.keyword = keyword.trim();
      }

      const res = await apiGet<unknown>("/api/admin/users", params, {
        withAuth: true,
      });

      const list = extractArray<User>(res);
      setUsers(list);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal memuat data pengguna.");
      } else {
        setError("Terjadi kesalahan saat memuat data pengguna.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilter = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const openCreateForm = () => {
    setFormMode("create");
    setFormState(emptyForm);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (user: User) => {
    setFormMode("edit");
    setFormState({
      id: user.id,
      name: user.name,
      email: user.email ?? "",
      username: user.username,
      nim: user.nim ?? "",
      role: user.role,
      status: user.status,
      force_password_change: user.force_password_change,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormState(emptyForm);
    setFormError(null);
  };

  const handleFormChange = (
    field: keyof UserFormState,
    value: string | boolean
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formState.name.trim() || !formState.username.trim()) {
      setFormError("Nama dan username wajib diisi.");
      return;
    }

    try {
      setFormSubmitting(true);

      const payload: Record<string, unknown> = {
        name: formState.name.trim(),
        email: formState.email.trim() || null,
        username: formState.username.trim(),
        nim: formState.nim.trim() || null,
        role: formState.role,
        status: formState.status,
        force_password_change: formState.force_password_change,
      };

      if (formMode === "create") {
        await apiPost<unknown>("/api/admin/users", payload, {
          withAuth: true,
        });
      } else {
        if (!formState.id) {
          throw new Error("ID pengguna tidak valid.");
        }
        await apiPut<unknown>(`/api/admin/users/${formState.id}`, payload, {
          withAuth: true,
        });
      }

      closeForm();
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message || "Gagal menyimpan pengguna.");
      } else {
        setFormError("Terjadi kesalahan saat menyimpan pengguna.");
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    setResetInfo(null);
    setResetLoadingId(user.id);
    setError(null);

    try {
      const res = await apiPost<ResetPasswordResponse>(
        `/api/admin/users/${user.id}/reset-password`,
        {},
        { withAuth: true }
      );

      const plain = res.plain_password ?? res.password ?? "";

      if (!plain) {
        throw new Error("Password baru tidak ditemukan di response.");
      }

      setResetInfo({
        userId: user.id,
        username: user.username,
        plainPassword: plain,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal reset password.");
      } else {
        setError("Terjadi kesalahan saat reset password.");
      }
    } finally {
      setResetLoadingId(null);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus: UserStatus =
      user.status === "active" ? "inactive" : "active";

    setStatusUpdatingId(user.id);
    setError(null);

    try {
      const payload = {
        name: user.name,
        email: user.email,
        username: user.username,
        nim: user.nim,
        role: user.role,
        status: nextStatus,
        force_password_change: user.force_password_change,
      };

      await apiPut<unknown>(`/api/admin/users/${user.id}`, payload, {
        withAuth: true,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal mengubah status pengguna.");
      } else {
        setError("Terjadi kesalahan saat mengubah status pengguna.");
      }
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const ok = window.confirm(
      `Yakin ingin menghapus user "${user.name}" (${user.username})?`
    );
    if (!ok) return;

    setDeleteLoadingId(user.id);
    setError(null);

    try {
      await apiDelete<unknown>(`/api/admin/users/${user.id}`, undefined, {
        withAuth: true,
      });

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (resetInfo?.userId === user.id) {
        setResetInfo(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Gagal menghapus user.");
      } else {
        setError("Terjadi kesalahan saat menghapus user.");
      }
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const isLoadingList = loading && !refreshing;

  // ======================
  // Bulk import mahasiswa (modal)
  // ======================

  const openBulkModal = () => {
    setBulkModalOpen(true);
    setBulkRows([]);
    setBulkError(null);
    setBulkGeneratedRows([]);
    setBulkGenerating(false);
  };

  const closeBulkModal = () => {
    if (bulkGenerating) return;
    setBulkModalOpen(false);
    setBulkRows([]);
    setBulkError(null);
    setBulkGeneratedRows([]);
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ["No", "Nama"],
      ["1", "Udin (contoh)"],
      ["2", "Udin (contoh)"],
      ["3", "Udin (contoh)"],
      ["4", "Udin (contoh)"],
      ["5", "Udin (contoh)"],
      ["6", "Udin (contoh)"],
      ["7", "Udin (contoh)"],
      ["8", ""],
      ["9", ""],
      ["10", ""],
      ["11", ""],
      ["12", ""],
      ["13", ""],
      ["14", ""],
      ["15", ""],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mahasiswa");

    const wbout = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_mahasiswa.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Upload & generate preview:
   * - baca nama dari Excel
   * - generate NIM/username/password
   * - pastikan TIDAK Nabrak:
   *   - tidak ada di database (username/nim existing)
   *   - tidak duplikat di batch ini
   */
  const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setBulkError(null);
    setBulkRows([]);
    setBulkGeneratedRows([]);

    if (!file) return;

    // Kumpulkan username & nim yang SUDAH ada di database
    const existingUsernames = new Set<string>();
    const existingNims = new Set<string>();

    users.forEach((u) => {
      if (u.username) {
        existingUsernames.add(u.username.trim());
      }
      if (u.nim) {
        existingNims.add(u.nim.trim());
      }
    });

    // Set yang dipakai untuk deteksi duplikat di kombinasi:
    // existing + row yang baru dibuat
    const usedUsernames = new Set<string>(existingUsernames);
    const usedNims = new Set<string>(existingNims);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) {
        setBulkError("Gagal membaca file.");
        return;
      }

      try {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<{
          No?: number | string;
          Nama?: string;
        }>(sheet, {
          header: ["No", "Nama"],
          range: 1,
        });

        const now = new Date();
        let baseOrder = getNextOrderForToday(users, now); // titik awal dari DB
        const rows: BulkStudentRow[] = [];

        json.forEach((row) => {
          const rawName = (row.Nama ?? "").toString().trim();
          if (!rawName) return;

          // Cari order yang aman (tidak nabrak username/nim)
          let candidateOrder = baseOrder;
          let nim: string;
          let username: string;
          let password: string;

          // Loop sampai ketemu kombinasi yang belum pernah dipakai
          // (baik di DB maupun di batch ini)
          // Dalam praktik, biasanya cukup 1-2 kali saja.
          // Kalau pun banyak, tetap aman; cuma angka urutan makin besar.
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const generated = generateNimAndPassword(
              rawName,
              candidateOrder,
              now
            );
            nim = generated.nim;
            username = generated.username;
            password = generated.password;

            const nimUsed = usedNims.has(nim);
            const usernameUsed = usedUsernames.has(username);

            if (!nimUsed && !usernameUsed) {
              break;
            }

            candidateOrder += 1;
          }

          rows.push({
            order: candidateOrder,
            name: rawName,
            nim: nim!,
            username: username!,
            password: password!,
          });

          // tandai NIM & username ini sudah dipakai agar tidak dipakai lagi
          usedNims.add(nim!);
          usedUsernames.add(username!);

          // untuk mahasiswa berikutnya, mulai dari order setelah kandidat terakhir
          baseOrder = candidateOrder + 1;
        });

        if (rows.length === 0) {
          setBulkError("Tidak ada nama mahasiswa yang terbaca di file.");
          return;
        }

        setBulkRows(rows);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setBulkError(err.message || "Gagal memproses file.");
        } else {
          setBulkError("Terjadi kesalahan saat memproses file.");
        }
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleBulkRowChange = (
    order: number,
    field: keyof BulkStudentRow,
    value: string
  ) => {
    setBulkRows((prev) =>
      prev.map((row) =>
        row.order === order ? { ...row, [field]: value } : row
      )
    );
    setBulkGeneratedRows([]); // kalau di-edit lagi, hasil sebelumnya dianggap tidak valid
  };

  const handleGenerateBulk = async () => {
    if (bulkRows.length === 0) {
      setBulkError("Belum ada data mahasiswa untuk digenerate.");
      return;
    }

    setBulkGenerating(true);
    setBulkError(null);
    setBulkGeneratedRows([]);

    try {
      for (const row of bulkRows) {
        if (!row.name.trim() || !row.nim.trim() || !row.username.trim()) {
          continue;
        }

        const payload: Record<string, unknown> = {
          name: row.name.trim(),
          email: null,
          username: row.username.trim(),
          nim: row.nim.trim(),
          role: "mahasiswa",
          status: "active",
          force_password_change: true,
          password: row.password, // backend sudah menerima & hash field ini
        };

        await apiPost<unknown>("/api/admin/users", payload, {
          withAuth: true,
        });
      }

      setBulkGeneratedRows([...bulkRows]);
      await loadUsers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setBulkError(err.message || "Gagal generate data mahasiswa.");
      } else {
        setBulkError("Terjadi kesalahan saat generate data mahasiswa.");
      }
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleExportBulkResult = () => {
    if (bulkGeneratedRows.length === 0) return;

    const header = ["Nama", "Username", "NIM", "Password"];
    const data: (string | number)[][] = [header];

    bulkGeneratedRows.forEach((row) => {
      data.push([row.name, row.username, row.nim, row.password]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Mahasiswa");

    const wbout = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hasil_import_mahasiswa.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ======================
  // Derived data for table
  // ======================

  const usersForTable = users.filter((u) => {
    if (section === "civitas" && u.role === "mahasiswa") return false;
    if (section === "mahasiswa" && u.role !== "mahasiswa") return false;

    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      const match =
        u.name.toLowerCase().includes(kw) ||
        u.username.toLowerCase().includes(kw) ||
        (u.email ?? "").toLowerCase().includes(kw);
      if (!match) return false;
    }

    return true;
  });

  const hasBulkResult = bulkGeneratedRows.length > 0;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Manajemen User
            </h1>
            <div className="hidden sm:flex items-center rounded-full bg-slate-100 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSection("civitas")}
                className={`px-3 py-1.5 rounded-full ${
                  section === "civitas"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Civitas
              </button>
              <button
                type="button"
                onClick={() => setSection("mahasiswa")}
                className={`px-3 py-1.5 rounded-full ${
                  section === "mahasiswa"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500"
                }`}
              >
                Mahasiswa
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {section === "mahasiswa" && (
              <button
                type="button"
                onClick={openBulkModal}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                <span>Import mahasiswa</span>
              </button>
            )}
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span>Tambah user</span>
            </button>
          </div>
        </div>

        {/* Filter & search */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                roleFilter === "all"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("superadmin")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                roleFilter === "superadmin"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Superadmin
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("dosen")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                roleFilter === "dosen"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Dosen
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("mahasiswa")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                roleFilter === "mahasiswa"
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Mahasiswa
            </button>
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
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                statusFilter === "inactive"
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
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari nama / username / email"
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

        {/* Info reset password */}
        {resetInfo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-medium">Password baru di-reset</div>
              <div className="font-mono text-[11px]">
                {resetInfo.username} → {resetInfo.plainPassword}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setResetInfo(null)}
              className="text-[11px] px-2 py-1 rounded-full border border-amber-300 hover:bg-amber-100"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Error global */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Tabel user */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Nama
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Username / NIM
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">
                    Role
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
                      Memuat pengguna...
                    </td>
                  </tr>
                )}

                {!isLoadingList && usersForTable.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Tidak ada data pengguna.
                    </td>
                  </tr>
                )}

                {!isLoadingList &&
                  usersForTable.map((user) => (
                    <tr
                      key={user.id}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 align-middle">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-900">
                            {user.name}
                          </span>
                          {user.email && (
                            <span className="text-[11px] text-slate-500">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-800">
                            {user.username}
                          </span>
                          {user.nim && (
                            <span className="text-[11px] text-slate-500">
                              NIM: {user.nim}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] capitalize text-slate-700">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={statusUpdatingId === user.id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                            user.status === "active"
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                              : "border-slate-400 bg-slate-100 text-slate-700"
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {user.status === "active" ? "Aktif" : "Non-aktif"}
                        </button>
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditForm(user)}
                            className="px-2 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            disabled={resetLoadingId === user.id}
                            className="px-2 py-1 rounded-full border border-red-200 bg-red-50 text-[11px] text-red-700 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {resetLoadingId === user.id
                              ? "Reset..."
                              : "Reset password"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deleteLoadingId === user.id}
                            className="px-2 py-1 rounded-full border border-slate-300 bg-slate-100 text-[11px] text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {deleteLoadingId === user.id ? "Hapus..." : "Hapus"}
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

      {/* Modal form tambah/edit user */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl px-5 py-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-xl bg-red-700 text-white text-xs font-semibold">
                  U
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {formMode === "create" ? "Tambah user" : "Edit user"}
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
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Nama
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  placeholder="Nama lengkap"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  placeholder="Email (opsional)"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formState.username}
                    onChange={(e) =>
                      handleFormChange("username", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                    placeholder="Username login"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    NIM
                  </label>
                  <input
                    type="text"
                    value={formState.nim}
                    onChange={(e) => handleFormChange("nim", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                    placeholder="Untuk mahasiswa (opsional)"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Role
                  </label>
                  <select
                    value={formState.role}
                    onChange={(e) =>
                      handleFormChange("role", e.target.value as UserRole)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  >
                    <option value="superadmin">Superadmin</option>
                    <option value="dosen">Dosen</option>
                    <option value="mahasiswa">Mahasiswa</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      handleFormChange("status", e.target.value as UserStatus)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Non-aktif</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formState.force_password_change}
                    onChange={(e) =>
                      handleFormChange(
                        "force_password_change",
                        e.target.checked
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-red-700 focus:ring-red-600"
                  />
                  <span>Paksa ganti password saat login</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  Password awal dapat dibuat melalui tombol{" "}
                  <span className="font-medium">Reset password</span> setelah
                  user tersimpan.
                </span>
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
                    ? "Simpan user"
                    : "Update user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal import mahasiswa */}
      {bulkModalOpen && section === "mahasiswa" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl px-5 py-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 flex items-center justify-center rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
                  M
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Import mahasiswa dari Excel
                </div>
              </div>
              <button
                type="button"
                onClick={closeBulkModal}
                className="text-[11px] px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                disabled={bulkGenerating}
              >
                Tutup
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Unduh template
                </button>
                <label className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                  <span>Pilih file</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleUploadTemplate}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleGenerateBulk}
                  disabled={bulkGenerating || bulkRows.length === 0}
                  className="px-3 py-1.5 rounded-full bg-red-700 text-white font-medium hover:bg-red-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {bulkGenerating ? "Memproses..." : "Generate"}
                </button>
                <button
                  type="button"
                  onClick={handleExportBulkResult}
                  disabled={!hasBulkResult}
                  className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Unduh hasil
                </button>
              </div>
            </div>

            {bulkError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
                {bulkError}
              </div>
            )}

            {hasBulkResult && !bulkError && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                Berhasil generate {bulkGeneratedRows.length} mahasiswa. Anda
                dapat mengunduh file hasil untuk dibagikan ke mahasiswa.
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {bulkRows.length === 0 ? (
                <div className="px-4 py-6 text-center text-[11px] text-slate-400">
                  Belum ada data. Unduh template, isi nama mahasiswa, lalu
                  upload kembali file Excel-nya.
                </div>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Urutan
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Nama
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          NIM
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Username
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-500">
                          Password
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr
                          key={row.order}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-1.5 align-middle text-slate-500">
                            {row.order}
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) =>
                                handleBulkRowChange(
                                  row.order,
                                  "name",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900"
                              disabled={bulkGenerating}
                            />
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="text"
                              value={row.nim}
                              onChange={(e) =>
                                handleBulkRowChange(
                                  row.order,
                                  "nim",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-900"
                              disabled={bulkGenerating}
                            />
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="text"
                              value={row.username}
                              onChange={(e) =>
                                handleBulkRowChange(
                                  row.order,
                                  "username",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-900"
                              disabled={bulkGenerating}
                            />
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="text"
                              value={row.password}
                              onChange={(e) =>
                                handleBulkRowChange(
                                  row.order,
                                  "password",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-900"
                              disabled={bulkGenerating}
                            />
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
      )}
    </>
  );
};

export default UserManagementPage;
