// src/lib/apiClient.ts

/**
 * HTTP client wrapper untuk LMS backend.
 * - Base URL dari NEXT_PUBLIC_API_BASE_URL
 *   (fallback ke https://backend-lms.farros.space)
 * - Tambah Authorization: Bearer <token> otomatis jika token ada
 * - Helper GET / POST / PUT / DELETE dengan generic typing
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://backend-lms.farros.space";
// process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/";
// -----------------------------
// Token management
// -----------------------------

let authToken: string | null = null;
const LOCAL_STORAGE_KEY = "lms_access_token";

export function setAuthToken(token: string) {
  authToken = token;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, token);
    } catch {
      // ignore
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) {
    return authToken;
  }

  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        authToken = stored;
        return stored;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function clearAuthToken() {
  authToken = null;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

// -----------------------------
// Core request wrapper
// -----------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  /**
   * Relative path, contoh: "/api/auth/login" atau "api/auth/login"
   */
  path: string;

  method?: HttpMethod;

  /**
   * Body akan di-JSON.stringify secara otomatis jika bukan FormData.
   */
  body?: unknown;

  /**
   * Query params (?key=value) sebagai object. Akan di-encode otomatis.
   */
  query?: Record<string, string | number | boolean | null | undefined>;

  /**
   * Header tambahan. Authorization akan ditimpa otomatis jika token tersedia.
   */
  headers?: Record<string, string>;

  /**
   * Jika true, akan mencoba menambahkan Authorization: Bearer <token> otomatis.
   * Default: true.
   */
  withAuth?: boolean;

  /**
   * Override token secara manual (misal untuk server-side).
   * Jika di-set, ini yang dipakai, bukan getAuthToken().
   */
  tokenOverride?: string | null;
}

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

interface ErrorResponseBody {
  message?: string;
  error?: string;
}

/**
 * Wrapper utama untuk request ke API backend.
 *
 * Contoh:
 * const data = await apiRequest<{ token: string }>({
 *   path: "/api/auth/login",
 *   method: "POST",
 *   body: { username, password },
 *   withAuth: false,
 * });
 */
export async function apiRequest<TResponse = unknown>(
  options: ApiRequestOptions
): Promise<TResponse> {
  const {
    path,
    method = "GET",
    body,
    query,
    headers = {},
    withAuth = true,
    tokenOverride,
  } = options;

  // Build URL (base + path + query)
  let url = path.startsWith("http")
    ? path
    : `${API_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === "") {
        continue;
      }
      params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  let requestBody: BodyInit | undefined;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormData && body !== undefined && body !== null) {
    requestHeaders["Content-Type"] =
      requestHeaders["Content-Type"] ?? "application/json";
    requestBody = JSON.stringify(body);
  } else if (isFormData) {
    requestBody = body as FormData;
  }

  // Authorization header
  if (withAuth) {
    const token = tokenOverride ?? getAuthToken();
    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    // Hanya GET yang tidak boleh punya body
    body: method === "GET" ? undefined : requestBody,
    // NOTE: credentials default = "same-origin" → untuk cross-origin akan dianggap non-credentialed
    // dan tidak perlu Access-Control-Allow-Credentials dari server
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");
  const responseData: unknown = isJson
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    if (isJson && responseData && typeof responseData === "object") {
      const errBody = responseData as ErrorResponseBody;
      if (errBody.message || errBody.error) {
        message = errBody.message ?? errBody.error ?? message;
      }
    }

    const error: ApiError = new Error(message);
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData as TResponse;
}

// -----------------------------
// Helper aliases (GET/POST/...)
// -----------------------------

export function apiGet<TResponse = unknown>(
  path: string,
  query?: ApiRequestOptions["query"],
  options?: Omit<ApiRequestOptions, "path" | "method" | "query">
) {
  return apiRequest<TResponse>({
    path,
    method: "GET",
    query,
    ...(options ?? {}),
  });
}

export function apiPost<TResponse = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "path" | "method" | "body">
) {
  return apiRequest<TResponse>({
    path,
    method: "POST",
    body,
    ...(options ?? {}),
  });
}

export function apiPut<TResponse = unknown>(
  path: string,
  body?: unknown,
  options?: Omit<ApiRequestOptions, "path" | "method" | "body">
) {
  return apiRequest<TResponse>({
    path,
    method: "PUT",
    body,
    ...(options ?? {}),
  });
}

export function apiDelete<TResponse = unknown>(
path: string, options?: Omit<ApiRequestOptions, "path" | "method">, p0?: { withAuth: boolean; }) {
  return apiRequest<TResponse>({
    path,
    method: "DELETE",
    ...(options ?? {}),
  });
}

// -----------------------------
// Specific helpers (contoh: /api/ping)
// -----------------------------

export interface PingResponse {
  message: string;
}

/**
 * Hit endpoint /api/ping backend.
 * Tidak perlu token.
 */
export function fetchPing() {
  return apiGet<PingResponse>("/api/ping", undefined, { withAuth: false });
}
