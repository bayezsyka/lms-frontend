"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  type ApiError,
} from "@/lib/apiClient";

type TabKey = "sections" | "participants" | "grades";

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

interface CourseHeader {
  id: number;
  class_name: string;
  semester: string;
  status?: CourseStatus;
  template: CourseTemplateLite | null;
  lecturer: LecturerLite | null;
}

interface SectionItem {
  id: number;
  title: string;
  order: number | null;
  created_at: string;
  updated_at: string;
}

type MaterialType = "file" | "link";

interface MaterialItem {
  id: number;
  title: string;
  description: string | null;
  type: MaterialType;
  file_path: string | null;
  url: string | null;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

type AssignmentType = "file" | "link";

interface AssignmentItem {
  id: number;
  title: string;
  description: string | null;
  type: AssignmentType;
  instructions: string | null;
  deadline: string | null;
  max_score: number | null;
  allow_late: boolean;
  is_past_deadline: boolean;
  can_submit_now: boolean;
  created_at: string;
  updated_at: string;
}

interface QuizTimeStatusFlags {
  is_future: boolean;
  is_ongoing: boolean;
  is_finished: boolean;
  can_attempt_now: boolean;
}

type QuizTimeStatus =
  | "not_started"
  | "ongoing"
  | "finished"
  | QuizTimeStatusFlags
  | string
  | null;

interface QuizItem {
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
}

interface SectionsResponse {
  course: CourseHeader & {
    status: CourseStatus;
  };
  sections: SectionItem[];
}

interface MaterialsResponse {
  section: {
    id: number;
    title: string;
    order: number | null;
    course_instance: {
      id: number;
      class_name: string;
      semester: string;
    };
  };
  materials: MaterialItem[];
}

interface AssignmentsResponse {
  section: {
    id: number;
    title: string;
    order: number | null;
    course_instance: {
      id: number;
      class_name: string;
      semester: string;
    };
  };
  assignments: AssignmentItem[];
}

interface QuizzesResponse {
  section: {
    id: number;
    title: string;
    order: number | null;
    course_instance: {
      id: number;
      class_name: string;
      semester: string;
    };
  };
  quizzes: QuizItem[];
}

// Grades (dipakai di tab Participants + Grades)
interface GradeAssignmentMeta {
  id: number;
  title: string;
  max_score: number;
}

interface GradeQuizMeta {
  id: number;
  title: string;
  max_score: number;
}

interface GradeStudentRow {
  student: {
    id: number;
    name: string;
    username: string;
    nim: string | null;
    email: string | null;
  };
  assignments: {
    [assignmentId: string]: {
      score: number | null;
      max_score: number;
    };
  };
  quizzes: {
    [quizId: string]: {
      best_score: number | null;
      max_score: number;
    };
  };
  total_score: number;
  total_assignment_score: number;
  total_quiz_score: number;
}

interface TeacherCourseGradesResponse {
  course: CourseHeader;
  assignments: GradeAssignmentMeta[];
  quizzes: GradeQuizMeta[];
  students: GradeStudentRow[];
}

type SectionFormMode = "create" | "edit";

interface SectionFormState {
  mode: SectionFormMode;
  sectionId?: number;
  title: string;
  order: string;
}

type MaterialFormMode = "create" | "edit";

interface MaterialFormState {
  mode: MaterialFormMode;
  sectionId: number;
  materialId?: number;
  type: MaterialType;
  title: string;
  description: string;
  subject: string;
  url: string;
  file: File | null;
}

type AssignmentFormMode = "create" | "edit";

interface AssignmentFormState {
  mode: AssignmentFormMode;
  sectionId: number;
  assignmentId?: number;
  title: string;
  description: string;
  type: AssignmentType;
  instructions: string;
  deadline: string;
  max_score: string;
  allow_late: boolean;
}

type QuizFormMode = "create" | "edit";

interface QuizFormState {
  mode: QuizFormMode;
  sectionId: number;
  quizId?: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: string;
  max_score: string;
}

const tabLabel: { [K in TabKey]: string } = {
  sections: "Sections",
  participants: "Participants",
  grades: "Grades",
};

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

function toLocalDateTimeInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function formatQuizStatus(status: QuizTimeStatus | undefined): string {
  if (status == null) return "—";

  if (typeof status === "string") {
    return status;
  }

  const flags = status as QuizTimeStatusFlags;

  if (flags.is_ongoing) return "Sedang berlangsung";
  if (flags.is_future) return "Belum dimulai";
  if (flags.is_finished) return "Sudah berakhir";
  if (flags.can_attempt_now) return "Dapat dikerjakan";

  return "Status tidak diketahui";
}

const CourseDetailPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = (params?.id ?? "") as string;

  const [activeTab, setActiveTab] = useState<TabKey>("sections");

  const [course, setCourse] = useState<CourseHeader | null>(null);

  // Sections
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState<boolean>(true);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [expandedSectionId, setExpandedSectionId] = useState<number | null>(
    null
  );

  // Section form (modal)
  const [sectionModalOpen, setSectionModalOpen] = useState<boolean>(false);
  const [sectionForm, setSectionForm] = useState<SectionFormState>({
    mode: "create",
    title: "",
    order: "",
  });
  const [sectionFormError, setSectionFormError] = useState<string | null>(null);
  const [sectionFormSubmitting, setSectionFormSubmitting] =
    useState<boolean>(false);

  // Content per section
  const [materialsBySection, setMaterialsBySection] = useState<{
    [sectionId: number]: MaterialItem[];
  }>({});
  const [assignmentsBySection, setAssignmentsBySection] = useState<{
    [sectionId: number]: AssignmentItem[];
  }>({});
  const [quizzesBySection, setQuizzesBySection] = useState<{
    [sectionId: number]: QuizItem[];
  }>({});
  const [sectionContentLoading, setSectionContentLoading] = useState<{
    [sectionId: number]: boolean;
  }>({});
  const [sectionContentError, setSectionContentError] = useState<{
    [sectionId: number]: string | null;
  }>({});

  // Material form (modal)
  const [materialForm, setMaterialForm] = useState<MaterialFormState | null>(
    null
  );
  const [materialFormSubmitting, setMaterialFormSubmitting] =
    useState<boolean>(false);
  const [materialFormError, setMaterialFormError] = useState<string | null>(
    null
  );

  // Assignment form (modal)
  const [assignmentForm, setAssignmentForm] =
    useState<AssignmentFormState | null>(null);
  const [assignmentFormSubmitting, setAssignmentFormSubmitting] =
    useState<boolean>(false);
  const [assignmentFormError, setAssignmentFormError] =
    useState<string | null>(null);

  // Quiz form (modal)
  const [quizForm, setQuizForm] = useState<QuizFormState | null>(null);
  const [quizFormSubmitting, setQuizFormSubmitting] =
    useState<boolean>(false);
  const [quizFormError, setQuizFormError] = useState<string | null>(null);

  // Grades (participants + grades tab)
  const [grades, setGrades] = useState<TeacherCourseGradesResponse | null>(
    null
  );
  const [gradesLoading, setGradesLoading] = useState<boolean>(true);
  const [gradesError, setGradesError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;

    let isActive = true;

    const loadSections = async () => {
      setSectionsLoading(true);
      setSectionsError(null);
      try {
        const data = await apiGet<SectionsResponse>(
          `/api/course-instances/${courseId}/sections`
        );
        if (!isActive) return;

        const sorted = [...data.sections].sort((a, b) => {
          const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
          if (aOrder === bOrder) {
            return a.id - b.id;
          }
          return aOrder - bOrder;
        });

        setSections(sorted);
        setCourse((prev) => prev ?? data.course);
      } catch (error: unknown) {
        if (!isActive) return;
        const message = extractErrorMessage(
          error,
          "Gagal memuat sections kelas."
        );
        setSectionsError(message);
      } finally {
        if (isActive) {
          setSectionsLoading(false);
        }
      }
    };

    const loadGrades = async () => {
      setGradesLoading(true);
      setGradesError(null);
      try {
        const data = await apiGet<TeacherCourseGradesResponse>(
          `/api/teacher/course-instances/${courseId}/grades`
        );
        if (!isActive) return;
        setGrades(data);
        setCourse((prev) => prev ?? data.course);
      } catch (error: unknown) {
        if (!isActive) return;
        const message = extractErrorMessage(
          error,
          "Gagal memuat data nilai/participants kelas."
        );
        setGradesError(message);
      } finally {
        if (isActive) {
          setGradesLoading(false);
        }
      }
    };

    void loadSections();
    void loadGrades();

    return () => {
      isActive = false;
    };
  }, [courseId]);

  const handleBack = () => {
    router.push("/teacher");
  };

  const toggleSectionExpand = (sectionId: number) => {
    setExpandedSectionId((prev) => {
      const next = prev === sectionId ? null : sectionId;
      if (next !== null) {
        void ensureSectionContentLoaded(next);
      }
      return next;
    });
  };

  const ensureSectionContentLoaded = async (sectionId: number) => {
    const alreadyLoaded =
      materialsBySection[sectionId] ||
      assignmentsBySection[sectionId] ||
      quizzesBySection[sectionId];

    if (alreadyLoaded) {
      return;
    }

    await loadAllSectionContent(sectionId);
  };

  const setSectionContentLoadingFlag = (
    sectionId: number,
    value: boolean
  ) => {
    setSectionContentLoading((prev) => ({
      ...prev,
      [sectionId]: value,
    }));
  };

  const setSectionContentErrorMessage = (
    sectionId: number,
    message: string | null
  ) => {
    setSectionContentError((prev) => ({
      ...prev,
      [sectionId]: message,
    }));
  };

  const loadMaterialsForSection = async (sectionId: number) => {
    const data = await apiGet<MaterialsResponse>(
      `/api/sections/${sectionId}/materials`
    );
    setMaterialsBySection((prev) => ({
      ...prev,
      [sectionId]: data.materials,
    }));
  };

  const loadAssignmentsForSection = async (sectionId: number) => {
    const data = await apiGet<AssignmentsResponse>(
      `/api/sections/${sectionId}/assignments`
    );
    setAssignmentsBySection((prev) => ({
      ...prev,
      [sectionId]: data.assignments,
    }));
  };

  const loadQuizzesForSection = async (sectionId: number) => {
    const data = await apiGet<QuizzesResponse>(
      `/api/sections/${sectionId}/quizzes`
    );
    setQuizzesBySection((prev) => ({
      ...prev,
      [sectionId]: data.quizzes,
    }));
  };

  const loadAllSectionContent = async (sectionId: number) => {
    setSectionContentLoadingFlag(sectionId, true);
    setSectionContentErrorMessage(sectionId, null);
    try {
      await Promise.all([
        loadMaterialsForSection(sectionId),
        loadAssignmentsForSection(sectionId),
        loadQuizzesForSection(sectionId),
      ]);
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        "Gagal memuat konten pada section ini."
      );
      setSectionContentErrorMessage(sectionId, message);
    } finally {
      setSectionContentLoadingFlag(sectionId, false);
    }
  };

  // ---------------------------
  // Section: modal helpers
  // ---------------------------

  const openCreateSectionModal = () => {
    setSectionForm({
      mode: "create",
      title: "",
      order: "",
    });
    setSectionFormError(null);
    setSectionModalOpen(true);
  };

  const resetSectionFormToCreate = () => {
    setSectionForm({
      mode: "create",
      title: "",
      order: "",
    });
    setSectionFormError(null);
  };

  const handleSectionFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!courseId) return;

    const { mode, sectionId, title, order } = sectionForm;
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setSectionFormError("Judul section wajib diisi.");
      return;
    }

    const orderValue = parseNumberOrNull(order);

    const payload: { title: string; order?: number | null } = {
      title: trimmedTitle,
    };
    if (orderValue !== null) {
      payload.order = orderValue;
    }

    setSectionFormSubmitting(true);
    setSectionFormError(null);

    try {
      if (mode === "create") {
        await apiPost(
          `/api/course-instances/${courseId}/sections`,
          payload
        );
      } else if (mode === "edit" && typeof sectionId === "number") {
        await apiPut(`/api/sections/${sectionId}`, payload);
      }

      setSectionsLoading(true);
      setSectionsError(null);

      const data = await apiGet<SectionsResponse>(
        `/api/course-instances/${courseId}/sections`
      );
      const sorted = [...data.sections].sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        if (aOrder === bOrder) {
          return a.id - b.id;
        }
        return aOrder - bOrder;
      });

      setSections(sorted);
      setCourse((prev) => prev ?? data.course);
      resetSectionFormToCreate();
      setSectionModalOpen(false);
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        mode === "create"
          ? "Gagal menambahkan section baru."
          : "Gagal mengubah section."
      );
      setSectionFormError(message);
    } finally {
      setSectionFormSubmitting(false);
      setSectionsLoading(false);
    }
  };

  const handleEditSectionClick = (section: SectionItem) => {
    setSectionForm({
      mode: "edit",
      sectionId: section.id,
      title: section.title,
      order: section.order !== null ? String(section.order) : "",
    });
    setSectionFormError(null);
    setSectionModalOpen(true);
  };

  const handleDeleteSection = async (section: SectionItem) => {
    const confirmDelete = window.confirm(
      `Hapus section "${section.title}"? Semua materi/tugas/quiz di dalamnya juga akan ikut terhapus.`
    );
    if (!confirmDelete) return;

    try {
      await apiDelete(`/api/sections/${section.id}`);
      setSections((prev) => prev.filter((s) => s.id !== section.id));

      setMaterialsBySection((prev) => {
        const next = { ...prev };
        delete next[section.id];
        return next;
      });
      setAssignmentsBySection((prev) => {
        const next = { ...prev };
        delete next[section.id];
        return next;
      });
      setQuizzesBySection((prev) => {
        const next = { ...prev };
        delete next[section.id];
        return next;
      });

      setSectionContentLoadingFlag(section.id, false);
      setSectionContentErrorMessage(section.id, null);

      if (expandedSectionId === section.id) {
        setExpandedSectionId(null);
      }

      if (
        sectionForm.mode === "edit" &&
        sectionForm.sectionId === section.id
      ) {
        resetSectionFormToCreate();
        setSectionModalOpen(false);
      }
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        "Gagal menghapus section. Silakan coba lagi."
      );
      window.alert(message);
    }
  };

  // ---------------------------
  // Material: create / edit / delete (modal)
  // ---------------------------

  const openCreateMaterialForm = (sectionId: number) => {
    setMaterialForm({
      mode: "create",
      sectionId,
      type: "file",
      materialId: undefined,
      title: "",
      description: "",
      subject: "",
      url: "",
      file: null,
    });
    setMaterialFormError(null);
  };

  const openEditMaterialForm = (sectionId: number, material: MaterialItem) => {
    setMaterialForm({
      mode: "edit",
      sectionId,
      materialId: material.id,
      type: material.type,
      title: material.title,
      description: material.description ?? "",
      subject: material.subject ?? "",
      url: material.url ?? "",
      file: null,
    });
    setMaterialFormError(null);
  };

  const resetMaterialForm = () => {
    setMaterialForm(null);
    setMaterialFormError(null);
    setMaterialFormSubmitting(false);
  };

  const handleMaterialFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!materialForm) return;

    const { mode, sectionId, materialId } = materialForm;

    const title = materialForm.title.trim();
    if (!title) {
      setMaterialFormError("Judul materi wajib diisi.");
      return;
    }

    if (materialForm.type === "link") {
      const urlTrimmed = materialForm.url.trim();
      if (!urlTrimmed) {
        setMaterialFormError(
          "URL wajib diisi untuk materi dengan tipe link."
        );
        return;
      }
    }

    if (materialForm.type === "file" && mode === "create") {
      if (!materialForm.file) {
        setMaterialFormError("Silakan pilih file untuk diunggah.");
        return;
      }
    }

    const formData = new FormData();
    formData.append("title", title);
    if (materialForm.description.trim()) {
      formData.append("description", materialForm.description.trim());
    }
    formData.append("type", materialForm.type);
    if (materialForm.subject.trim()) {
      formData.append("subject", materialForm.subject.trim());
    }

    if (materialForm.type === "file") {
      if (materialForm.file) {
        formData.append("file", materialForm.file);
      }
    } else if (materialForm.type === "link") {
      formData.append("url", materialForm.url.trim());
    }

    setMaterialFormSubmitting(true);
    setMaterialFormError(null);

    try {
      if (mode === "create") {
        await apiPost(`/api/sections/${sectionId}/materials`, formData, {
          headers: {},
        });
      } else if (mode === "edit" && typeof materialId === "number") {
        // diasumsikan backend pakai method spoofing (_method=PUT) atau endpoint khusus update file
        formData.append("_method", "PUT");
        await apiPost(`/api/materials/${materialId}`, formData, {
          headers: {},
        });
      }

      await loadMaterialsForSection(sectionId);
      resetMaterialForm();
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        mode === "create"
          ? "Gagal menambahkan materi."
          : "Gagal mengubah materi."
      );
      setMaterialFormError(message);
    } finally {
      setMaterialFormSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (
    sectionId: number,
    material: MaterialItem
  ) => {
    const confirmDelete = window.confirm(
      `Hapus materi "${material.title}" dari section ini?`
    );
    if (!confirmDelete) return;

    try {
      await apiDelete(`/api/materials/${material.id}`);
      await loadMaterialsForSection(sectionId);
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        "Gagal menghapus materi. Silakan coba lagi."
      );
      window.alert(message);
    }
  };

  // ---------------------------
  // Assignment: create / edit / delete (modal)
  // ---------------------------

  const openCreateAssignmentForm = (sectionId: number) => {
    setAssignmentForm({
      mode: "create",
      sectionId,
      assignmentId: undefined,
      title: "",
      description: "",
      type: "file",
      instructions: "",
      deadline: "",
      max_score: "",
      allow_late: false,
    });
    setAssignmentFormError(null);
  };

  const openEditAssignmentForm = (
    sectionId: number,
    assignment: AssignmentItem
  ) => {
    setAssignmentForm({
      mode: "edit",
      sectionId,
      assignmentId: assignment.id,
      title: assignment.title,
      description: assignment.description ?? "",
      type: assignment.type,
      instructions: assignment.instructions ?? "",
      deadline: toLocalDateTimeInput(assignment.deadline),
      max_score:
        assignment.max_score !== null
          ? String(assignment.max_score)
          : "",
      allow_late: assignment.allow_late,
    });
    setAssignmentFormError(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm(null);
    setAssignmentFormError(null);
    setAssignmentFormSubmitting(false);
  };

  const handleAssignmentFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!assignmentForm) return;

    const {
      mode,
      sectionId,
      assignmentId,
      title,
      description,
      type,
      instructions,
      deadline,
      max_score,
      allow_late,
    } = assignmentForm;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setAssignmentFormError("Judul tugas wajib diisi.");
      return;
    }

    const payload: {
      title: string;
      description?: string | null;
      type: AssignmentType;
      instructions?: string | null;
      deadline?: string | null;
      max_score?: number | null;
      allow_late?: boolean;
    } = {
      title: trimmedTitle,
      type,
    };

    if (description.trim()) {
      payload.description = description.trim();
    } else {
      payload.description = null;
    }

    if (instructions.trim()) {
      payload.instructions = instructions.trim();
    } else {
      payload.instructions = null;
    }

    if (deadline.trim()) {
      payload.deadline = deadline;
    } else {
      payload.deadline = null;
    }

    const maxScoreValue = parseNumberOrNull(max_score);
    if (maxScoreValue !== null) {
      payload.max_score = maxScoreValue;
    }

    payload.allow_late = allow_late;

    setAssignmentFormSubmitting(true);
    setAssignmentFormError(null);

    try {
      if (mode === "create") {
        await apiPost(`/api/sections/${sectionId}/assignments`, payload);
      } else if (mode === "edit" && typeof assignmentId === "number") {
        await apiPut(`/api/assignments/${assignmentId}`, payload);
      }

      await loadAssignmentsForSection(sectionId);
      resetAssignmentForm();
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        mode === "create"
          ? "Gagal membuat tugas."
          : "Gagal mengubah tugas."
      );
      setAssignmentFormError(message);
    } finally {
      setAssignmentFormSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (
    sectionId: number,
    assignment: AssignmentItem
  ) => {
    const confirmDelete = window.confirm(
      `Hapus tugas "${assignment.title}" dari section ini?`
    );
    if (!confirmDelete) return;

    try {
      await apiDelete(`/api/assignments/${assignment.id}`);
      await loadAssignmentsForSection(sectionId);
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        "Gagal menghapus tugas. Silakan coba lagi."
      );
      window.alert(message);
    }
  };

  // ---------------------------
  // Quiz: create / edit / delete (modal)
  // ---------------------------

  const openCreateQuizForm = (sectionId: number) => {
    setQuizForm({
      mode: "create",
      sectionId,
      quizId: undefined,
      title: "",
      description: "",
      start_time: "",
      end_time: "",
      duration_minutes: "",
      max_score: "",
    });
    setQuizFormError(null);
  };

  const openEditQuizForm = (sectionId: number, quiz: QuizItem) => {
    setQuizForm({
      mode: "edit",
      sectionId,
      quizId: quiz.id,
      title: quiz.title,
      description: quiz.description ?? "",
      start_time: toLocalDateTimeInput(quiz.start_time),
      end_time: toLocalDateTimeInput(quiz.end_time),
      duration_minutes:
        quiz.duration_minutes !== null
          ? String(quiz.duration_minutes)
          : "",
      max_score:
        quiz.max_score !== null ? String(quiz.max_score) : "",
    });
    setQuizFormError(null);
  };

  const resetQuizForm = () => {
    setQuizForm(null);
    setQuizFormError(null);
    setQuizFormSubmitting(false);
  };

  const handleQuizFormSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!quizForm) return;

    const {
      mode,
      sectionId,
      quizId,
      title,
      description,
      start_time,
      end_time,
      duration_minutes,
      max_score,
    } = quizForm;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setQuizFormError("Judul quiz wajib diisi.");
      return;
    }

    const payload: {
      title: string;
      description?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      duration_minutes?: number | null;
      max_score?: number | null;
      questions?: unknown[] | null;
    } = {
      title: trimmedTitle,
    };

    if (description.trim()) {
      payload.description = description.trim();
    } else {
      payload.description = null;
    }

    payload.start_time = start_time.trim() ? start_time : null;
    payload.end_time = end_time.trim() ? end_time : null;

    const durationValue = parseNumberOrNull(duration_minutes);
    if (durationValue !== null) {
      payload.duration_minutes = durationValue;
    }

    const maxScoreValue = parseNumberOrNull(max_score);
    if (maxScoreValue !== null) {
      payload.max_score = maxScoreValue;
    }

    payload.questions = null;

    setQuizFormSubmitting(true);
    setQuizFormError(null);

    try {
      if (mode === "create") {
        await apiPost(`/api/sections/${sectionId}/quizzes`, payload);
      } else if (mode === "edit" && typeof quizId === "number") {
        await apiPut(`/api/quizzes/${quizId}`, payload);
      }

      await loadQuizzesForSection(sectionId);
      resetQuizForm();
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        mode === "create"
          ? "Gagal membuat quiz."
          : "Gagal mengubah quiz."
      );
      setQuizFormError(message);
    } finally {
      setQuizFormSubmitting(false);
    }
  };

  const handleDeleteQuiz = async (sectionId: number, quiz: QuizItem) => {
    const confirmDelete = window.confirm(
      `Hapus quiz "${quiz.title}" dari section ini?`
    );
    if (!confirmDelete) return;

    try {
      await apiDelete(`/api/quizzes/${quiz.id}`);
      await loadQuizzesForSection(sectionId);
    } catch (error: unknown) {
      const message = extractErrorMessage(
        error,
        "Gagal menghapus quiz. Silakan coba lagi."
      );
      window.alert(message);
    }
  };

  // ---------------------------
  // Tab: Sections
  // ---------------------------

  const renderSectionsTab = () => {
    if (sectionsLoading) {
      return (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="h-4 w-40 rounded-full bg-slate-100" />
            <div className="mt-2 h-3 w-64 rounded-full bg-slate-100" />
          </div>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="h-3 w-32 rounded-full bg-slate-100" />
                  <div className="h-3 w-24 rounded-full bg-slate-100" />
                </div>
                <div className="h-6 w-6 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Toolbar section */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-900">
                Struktur Perkuliahan
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Atur minggu/topik kuliah sebagai section. Di dalamnya Anda
                bisa menambahkan materi, tugas, dan quiz.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateSectionModal}
              className="inline-flex items-center rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700"
            >
              + Section baru
            </button>
          </div>
        </div>

        {/* Error section */}
        {sectionsError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {sectionsError}
          </div>
        )}

        {/* Empty sections */}
        {sections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Belum ada section pada kelas ini.
            <div className="mt-1 text-[11px] text-slate-400">
              Tambahkan section pertama Anda menggunakan tombol
              &quot;Section baru&quot; di atas.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => {
              const isExpanded = expandedSectionId === section.id;
              const contentLoading = sectionContentLoading[section.id] ?? false;
              const contentError = sectionContentError[section.id] ?? null;
              const materials = materialsBySection[section.id] ?? [];
              const assignments = assignmentsBySection[section.id] ?? [];
              const quizzes = quizzesBySection[section.id] ?? [];

              return (
                <div
                  key={section.id}
                  className="rounded-2xl border border-slate-200 bg-white"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSectionExpand(section.id)}
                    onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSectionExpand(section.id);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {section.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Urutan:{" "}
                        <span className="font-medium text-slate-800">
                          {section.order ?? "—"}
                        </span>{" "}
                        • Dibuat pada {formatDate(section.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditSectionClick(section);
                        }}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteSection(section);
                        }}
                        className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] text-red-700 hover:bg-red-100"
                      >
                        Hapus
                      </button>
                      <span
                        className={[
                          "inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-[11px] text-slate-600 transition-transform",
                          isExpanded ? "rotate-90" : "",
                        ].join(" ")}
                      >
                        &gt;
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      {contentLoading && (
                        <div className="mb-3 text-[11px] text-slate-500">
                          Memuat konten section...
                        </div>
                      )}
                      {contentError && (
                        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                          {contentError}
                        </div>
                      )}

                      {!contentLoading && !contentError && (
                        <div className="grid gap-3 md:grid-cols-3">
                          {/* Materials */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                Materi
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  openCreateMaterialForm(section.id)
                                }
                                className="text-[11px] text-red-600 hover:underline"
                              >
                                + Tambah
                              </button>
                            </div>

                            {materials.length === 0 ? (
                              <p className="text-[11px] text-slate-400">
                                Belum ada materi pada section ini.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {materials.map((material) => (
                                  <li
                                    key={material.id}
                                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                          {material.type === "file"
                                            ? "FILE"
                                            : "LINK"}
                                        </span>
                                        <p className="text-xs font-semibold text-slate-900">
                                          {material.title}
                                        </p>
                                      </div>
                                      {material.description && (
                                        <p className="text-[11px] text-slate-500">
                                          {material.description}
                                        </p>
                                      )}
                                      {material.subject && (
                                        <p className="text-[10px] text-slate-400">
                                          Tag: {material.subject}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openEditMaterialForm(
                                              section.id,
                                              material
                                            )
                                          }
                                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleDeleteMaterial(
                                              section.id,
                                              material
                                            )
                                          }
                                          className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-100"
                                        >
                                          Hapus
                                        </button>
                                      </div>
                                      {material.type === "link" &&
                                        material.url && (
                                          <a
                                            href={material.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[10px] text-red-600 hover:underline"
                                          >
                                            Buka link
                                          </a>
                                        )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Assignments */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                Tugas
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  openCreateAssignmentForm(section.id)
                                }
                                className="text-[11px] text-red-600 hover:underline"
                              >
                                + Tambah
                              </button>
                            </div>

                            {assignments.length === 0 ? (
                              <p className="text-[11px] text-slate-400">
                                Belum ada tugas pada section ini.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {assignments.map((assignment) => (
                                  <li
                                    key={assignment.id}
                                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                                          TUGAS
                                        </span>
                                        <p className="text-xs font-semibold text-slate-900">
                                          {assignment.title}
                                        </p>
                                      </div>
                                      {assignment.description && (
                                        <p className="text-[11px] text-slate-500">
                                          {assignment.description}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-slate-500">
                                        Deadline:{" "}
                                        <span className="font-medium text-slate-800">
                                          {formatDateTime(
                                            assignment.deadline
                                          )}
                                        </span>{" "}
                                        • Maks{" "}
                                        {assignment.max_score ?? 100}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openEditAssignmentForm(
                                              section.id,
                                              assignment
                                            )
                                          }
                                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleDeleteAssignment(
                                              section.id,
                                              assignment
                                            )
                                          }
                                          className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-100"
                                        >
                                          Hapus
                                        </button>
                                      </div>
                                      <p className="text-[10px] text-slate-400">
                                        Tipe jawaban: {assignment.type}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Quizzes */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                Quiz
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  openCreateQuizForm(section.id)
                                }
                                className="text-[11px] text-red-600 hover:underline"
                              >
                                + Tambah
                              </button>
                            </div>

                            {quizzes.length === 0 ? (
                              <p className="text-[11px] text-slate-400">
                                Belum ada quiz pada section ini.
                              </p>
                            ) : (
                              <ul className="space-y-1.5">
                                {quizzes.map((quiz) => (
                                  <li
                                    key={quiz.id}
                                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                          QUIZ
                                        </span>
                                        <p className="text-xs font-semibold text-slate-900">
                                          {quiz.title}
                                        </p>
                                      </div>
                                      {quiz.description && (
                                        <p className="text-[11px] text-slate-500">
                                          {quiz.description}
                                        </p>
                                      )}
                                      <p className="text-[10px] text-slate-500">
                                        Window:{" "}
                                        {formatDateTime(quiz.start_time)} –{" "}
                                        {formatDateTime(quiz.end_time)} •
                                        Durasi{" "}
                                        {quiz.duration_minutes ?? "—"}{" "}
                                        menit
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        Status:{" "}
                                        {formatQuizStatus(
                                          quiz.time_status
                                        )}
                                      </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openEditQuizForm(
                                              section.id,
                                              quiz
                                            )
                                          }
                                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleDeleteQuiz(
                                              section.id,
                                              quiz
                                            )
                                          }
                                          className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-100"
                                        >
                                          Hapus
                                        </button>
                                      </div>
                                      <p className="text-[10px] text-slate-400">
                                        Maks nilai:{" "}
                                        {quiz.max_score ?? 100}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------
  // Tab: Participants (Dosen)
  // ---------------------------

  const renderParticipantsTab = () => {
    if (gradesLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100" />
                  <div className="space-y-1">
                    <div className="h-3 w-40 rounded-full bg-slate-100" />
                    <div className="h-3 w-24 rounded-full bg-slate-100" />
                  </div>
                </div>
                <div className="h-3 w-20 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (gradesError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {gradesError}
        </div>
      );
    }

    if (!grades || grades.students.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Belum ada peserta aktif pada kelas ini.
        </div>
      );
    }

    const { students, assignments, quizzes } = grades;
    const totalAssignments = assignments.length;
    const totalQuizzes = quizzes.length;

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">
          Daftar mahasiswa yang ter-enroll pada kelas ini (status aktif).
          Informasi tambahan seperti aktivitas terakhir bisa ditambahkan
          kemudian ketika tersedia dari backend.
        </div>

        {students.map((row) => {
          const assignmentEntries = Object.values(row.assignments);
          const quizEntries = Object.values(row.quizzes);

          const submittedAssignments = assignmentEntries.filter(
            (entry) => entry.score !== null
          ).length;
          const attemptedQuizzes = quizEntries.filter(
            (entry) => entry.best_score !== null
          ).length;

          return (
            <div
              key={row.student.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white">
                    {row.student.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {row.student.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {row.student.username}
                      {row.student.nim ? ` • ${row.student.nim}` : ""}
                    </p>
                    {row.student.email && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {row.student.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-right">
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-slate-600">
                    Tugas dinilai:{" "}
                    <span className="ml-1 font-semibold text-slate-900">
                      {submittedAssignments}/{totalAssignments}
                    </span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-slate-600">
                    Quiz dikerjakan:{" "}
                    <span className="ml-1 font-semibold text-slate-900">
                      {attemptedQuizzes}/{totalQuizzes}
                    </span>
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                    Total nilai:{" "}
                    <span className="ml-1 font-semibold">
                      {Math.round(row.total_score)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ---------------------------
  // Tab: Grades
  // ---------------------------

  const renderGradesTab = () => {
    if (gradesLoading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Memuat rekap nilai kelas...
        </div>
      );
    }

    if (gradesError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {gradesError}
        </div>
      );
    }

    if (!grades) {
      return null;
    }

    const { assignments, quizzes, students } = grades;

    if (students.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Belum ada nilai untuk kelas ini.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-500">
          Rekap nilai per mahasiswa untuk semua tugas dan quiz di kelas
          ini. Pengelolaan detail penilaian akan ditambahkan di tahap
          selanjutnya.
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700">
                  Mahasiswa
                </th>
                {assignments.map((assignment) => (
                  <th
                    key={assignment.id}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700"
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold">
                        {assignment.title}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Tugas • Maks {assignment.max_score}
                      </span>
                    </div>
                  </th>
                ))}
                {quizzes.map((quiz) => (
                  <th
                    key={quiz.id}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-700"
                  >
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold">
                        {quiz.title}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Quiz • Maks {quiz.max_score}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-700">
                  Total Tugas
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-700">
                  Total Quiz
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-700">
                  Total Nilai
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((row, rowIndex) => (
                <tr
                  key={row.student.id}
                  className={
                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                  }
                >
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-900">
                        {row.student.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {row.student.username}
                        {row.student.nim ? ` • ${row.student.nim}` : ""}
                      </span>
                    </div>
                  </td>
                  {assignments.map((assignment) => {
                    const key = String(assignment.id);
                    const cell = row.assignments[key];
                    const value =
                      cell && cell.score !== null
                        ? cell.score
                        : undefined;
                    return (
                      <td
                        key={assignment.id}
                        className="whitespace-nowrap px-3 py-2 text-right align-top text-[11px]"
                      >
                        {value !== undefined ? (
                          <span className="font-semibold text-slate-900">
                            {value}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  {quizzes.map((quiz) => {
                    const key = String(quiz.id);
                    const cell = row.quizzes[key];
                    const value =
                      cell && cell.best_score !== null
                        ? cell.best_score
                        : undefined;
                    return (
                      <td
                        key={quiz.id}
                        className="whitespace-nowrap px-3 py-2 text-right align-top text-[11px]"
                      >
                        {value !== undefined ? (
                          <span className="font-semibold text-slate-900">
                            {value}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top text-[11px]">
                    <span className="font-semibold text-slate-900">
                      {Math.round(row.total_assignment_score)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top text-[11px]">
                    <span className="font-semibold text-slate-900">
                      {Math.round(row.total_quiz_score)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top text-[11px]">
                    <span className="font-semibold text-slate-900">
                      {Math.round(row.total_score)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---------------------------
  // MAIN RENDER
  // ---------------------------

  const renderActiveTab = () => {
    switch (activeTab) {
      case "sections":
        return renderSectionsTab();
      case "participants":
        return renderParticipantsTab();
      case "grades":
        return renderGradesTab();
      default:
        return null;
    }
  };

  const activeMaterialSection = materialForm
    ? sections.find((s) => s.id === materialForm.sectionId)
    : undefined;
  const activeAssignmentSection = assignmentForm
    ? sections.find((s) => s.id === assignmentForm.sectionId)
    : undefined;
  const activeQuizSection = quizForm
    ? sections.find((s) => s.id === quizForm.sectionId)
    : undefined;

  return (
    <>
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
                Detail Kelas
              </h1>
              {course && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {course.template
                    ? `${course.template.code} — ${course.template.name}`
                    : "Tanpa template"}{" "}
                  • Kelas {course.class_name} • Semester {course.semester}
                </p>
              )}
            </div>
          </div>
          {course && course.lecturer && (
            <div className="text-right">
              <p className="text-[11px] text-slate-500">Dosen pengampu</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900">
                {course.lecturer.name}
              </p>
              <p className="text-[10px] text-slate-500">
                {course.lecturer.username}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="rounded-full border border-slate-200 bg-white px-1 py-1 text-xs">
          <div className="flex gap-1">
            {(Object.keys(tabLabel) as TabKey[]).map((key) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={[
                    "flex-1 rounded-full px-3 py-1.5 transition-colors",
                    isActive
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {tabLabel[key]}
                </button>
              );
            })}
          </div>
        </div>

        {renderActiveTab()}
      </div>

      {/* MODAL: Section */}
      {sectionModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {sectionForm.mode === "create"
                    ? "Tambah Section"
                    : "Ubah Section"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Gunakan section sebagai minggu/topik perkuliahan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSectionModalOpen(false);
                  resetSectionFormToCreate();
                }}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
            <form
              onSubmit={handleSectionFormSubmit}
              className="space-y-3 text-xs"
            >
              {sectionFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                  {sectionFormError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Judul section
                </label>
                <input
                  type="text"
                  value={sectionForm.title}
                  onChange={(event) =>
                    setSectionForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  placeholder="Misal: Minggu 1 – Pendahuluan"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Urutan (opsional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={sectionForm.order}
                  onChange={(event) =>
                    setSectionForm((prev) => ({
                      ...prev,
                      order: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  placeholder="1, 2, 3, ..."
                />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSectionModalOpen(false);
                    resetSectionFormToCreate();
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sectionFormSubmitting}
                  className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sectionFormSubmitting ? (
                    <>
                      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Menyimpan...
                    </>
                  ) : sectionForm.mode === "create" ? (
                    "Simpan section"
                  ) : (
                    "Update section"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Material */}
      {materialForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {materialForm.mode === "create"
                    ? "Tambah Materi"
                    : "Ubah Materi"}
                </p>
                {activeMaterialSection && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Section: {activeMaterialSection.title}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetMaterialForm}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
            <form
              onSubmit={handleMaterialFormSubmit}
              className="space-y-2 text-xs"
            >
              {materialFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                  {materialFormError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Judul materi
                </label>
                <input
                  type="text"
                  value={materialForm.title}
                  onChange={(event) =>
                    setMaterialForm((prev) =>
                      prev
                        ? { ...prev, title: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  placeholder="Misal: Slide pertemuan 1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={materialForm.description}
                  onChange={(event) =>
                    setMaterialForm((prev) =>
                      prev
                        ? { ...prev, description: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Tipe
                  </label>
                  <div className="mt-1 flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setMaterialForm((prev) =>
                          prev ? { ...prev, type: "file" } : prev
                        )
                      }
                      className={[
                        "flex-1 rounded-full border px-2 py-1",
                        materialForm.type === "file"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-600",
                      ].join(" ")}
                    >
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMaterialForm((prev) =>
                          prev ? { ...prev, type: "link" } : prev
                        )
                      }
                      className={[
                        "flex-1 rounded-full border px-2 py-1",
                        materialForm.type === "link"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-600",
                      ].join(" ")}
                    >
                      Link
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Tag/subject (opsional)
                  </label>
                  <input
                    type="text"
                    value={materialForm.subject}
                    onChange={(event) =>
                      setMaterialForm((prev) =>
                        prev ? { ...prev, subject: event.target.value } : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                    placeholder="Misal: Teori, Referensi"
                  />
                </div>
              </div>
              {materialForm.type === "file" ? (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    File
                  </label>
                  <input
                    type="file"
                    onChange={(event) => {
                      const file =
                        event.target.files && event.target.files[0]
                          ? event.target.files[0]
                          : null;
                      setMaterialForm((prev) =>
                        prev ? { ...prev, file } : prev
                      );
                    }}
                    className="mt-1 w-full text-[11px]"
                  />
                  {materialForm.mode === "edit" && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Jika tidak memilih file, file lama akan
                      dipertahankan.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    URL
                  </label>
                  <input
                    type="url"
                    value={materialForm.url}
                    onChange={(event) =>
                      setMaterialForm((prev) =>
                        prev ? { ...prev, url: event.target.value } : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                    placeholder="https://..."
                  />
                </div>
              )}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetMaterialForm}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={materialFormSubmitting}
                  className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {materialFormSubmitting ? (
                    <>
                      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Menyimpan...
                    </>
                  ) : materialForm.mode === "create" ? (
                    "Simpan materi"
                  ) : (
                    "Update materi"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Assignment */}
      {assignmentForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {assignmentForm.mode === "create"
                    ? "Tambah Tugas"
                    : "Ubah Tugas"}
                </p>
                {activeAssignmentSection && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Section: {activeAssignmentSection.title}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetAssignmentForm}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
            <form
              onSubmit={handleAssignmentFormSubmit}
              className="space-y-2 text-xs"
            >
              {assignmentFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                  {assignmentFormError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Judul tugas
                </label>
                <input
                  type="text"
                  value={assignmentForm.title}
                  onChange={(event) =>
                    setAssignmentForm((prev) =>
                      prev
                        ? { ...prev, title: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  placeholder="Misal: Tugas 1 - Analisis Kasus"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={assignmentForm.description}
                  onChange={(event) =>
                    setAssignmentForm((prev) =>
                      prev
                        ? { ...prev, description: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Tipe jawaban
                  </label>
                  <div className="mt-1 flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setAssignmentForm((prev) =>
                          prev ? { ...prev, type: "file" } : prev
                        )
                      }
                      className={[
                        "flex-1 rounded-full border px-2 py-1",
                        assignmentForm.type === "file"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-600",
                      ].join(" ")}
                    >
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAssignmentForm((prev) =>
                          prev ? { ...prev, type: "link" } : prev
                        )
                      }
                      className={[
                        "flex-1 rounded-full border px-2 py-1",
                        assignmentForm.type === "link"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-slate-200 bg-white text-slate-600",
                      ].join(" ")}
                    >
                      Link
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Nilai maksimal
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={assignmentForm.max_score}
                    onChange={(event) =>
                      setAssignmentForm((prev) =>
                        prev
                          ? { ...prev, max_score: event.target.value }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                    placeholder="Default 100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Instruksi (opsional)
                </label>
                <textarea
                  value={assignmentForm.instructions}
                  onChange={(event) =>
                    setAssignmentForm((prev) =>
                      prev
                        ? { ...prev, instructions: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  rows={2}
                  placeholder="Contoh: unggah file PDF, atau sertakan link repository."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Deadline (opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={assignmentForm.deadline}
                    onChange={(event) =>
                      setAssignmentForm((prev) =>
                        prev
                          ? { ...prev, deadline: event.target.value }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={assignmentForm.allow_late}
                      onChange={(event) =>
                        setAssignmentForm((prev) =>
                          prev
                            ? { ...prev, allow_late: event.target.checked }
                            : prev
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-red-600"
                    />
                    Izinkan telat
                  </label>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetAssignmentForm}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={assignmentFormSubmitting}
                  className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assignmentFormSubmitting ? (
                    <>
                      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Menyimpan...
                    </>
                  ) : assignmentForm.mode === "create" ? (
                    "Simpan tugas"
                  ) : (
                    "Update tugas"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quiz */}
      {quizForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  {quizForm.mode === "create" ? "Tambah Quiz" : "Ubah Quiz"}
                </p>
                {activeQuizSection && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Section: {activeQuizSection.title}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetQuizForm}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
            <form
              onSubmit={handleQuizFormSubmit}
              className="space-y-2 text-xs"
            >
              {quizFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                  {quizFormError}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Judul quiz
                </label>
                <input
                  type="text"
                  value={quizForm.title}
                  onChange={(event) =>
                    setQuizForm((prev) =>
                      prev
                        ? { ...prev, title: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  placeholder="Misal: Quiz 1 - Bab 1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={quizForm.description}
                  onChange={(event) =>
                    setQuizForm((prev) =>
                      prev
                        ? { ...prev, description: event.target.value }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Waktu mulai (opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={quizForm.start_time}
                    onChange={(event) =>
                      setQuizForm((prev) =>
                        prev
                          ? { ...prev, start_time: event.target.value }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Waktu selesai (opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={quizForm.end_time}
                    onChange={(event) =>
                      setQuizForm((prev) =>
                        prev
                          ? { ...prev, end_time: event.target.value }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Durasi (menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quizForm.duration_minutes}
                    onChange={(event) =>
                      setQuizForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              duration_minutes: event.target.value,
                            }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600">
                    Nilai maksimal
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quizForm.max_score}
                    onChange={(event) =>
                      setQuizForm((prev) =>
                        prev
                          ? { ...prev, max_score: event.target.value }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500"
                    placeholder="Default 100"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetQuizForm}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={quizFormSubmitting}
                  className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {quizFormSubmitting ? (
                    <>
                      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      Menyimpan...
                    </>
                  ) : quizForm.mode === "create" ? (
                    "Simpan quiz"
                  ) : (
                    "Update quiz"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CourseDetailPage;
