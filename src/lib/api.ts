/**
 * Lớp gọi HTTP duy nhất của trang quản trị.
 *
 * Mọi thứ khác trong app đi qua `api.get/post/patch/del` — không có `fetch` trần
 * ở chỗ nào khác. Đổi cách gắn token, cách đọc lỗi hay base URL thì chỉ sửa ở
 * đây.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const TOKEN_STORAGE_KEY = "kuds_admin_token";

/** Lỗi Zod của backend: `{ error: { formErrors, fieldErrors } }`. */
export interface ZodFlatten {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, details: unknown) {
    super(messageOf(status, details));
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** Lỗi theo từng trường, để form tô đỏ đúng ô. Không phải lỗi Zod thì rỗng. */
  get fieldErrors(): Record<string, string> {
    const flat = this.details as ZodFlatten | undefined;
    if (!flat || typeof flat !== "object" || !flat.fieldErrors) return {};
    return Object.fromEntries(
      Object.entries(flat.fieldErrors)
        .filter(([, msgs]) => msgs?.length)
        .map(([field, msgs]) => [field, msgs.join(". ")]),
    );
  }
}

function messageOf(status: number, details: unknown): string {
  if (typeof details === "string") return details;

  if (details && typeof details === "object") {
    const flat = details as ZodFlatten;
    const parts = [
      ...(flat.formErrors ?? []),
      ...Object.entries(flat.fieldErrors ?? {}).map(([field, msgs]) => `${field}: ${msgs.join(", ")}`),
    ];
    if (parts.length > 0) return parts.join(" · ");
  }

  return `Lỗi ${status}`;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token === null) localStorage.removeItem(TOKEN_STORAGE_KEY);
  else localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

/**
 * Token admin sống 8 tiếng và KHÔNG có refresh token — hết hạn là đăng nhập
 * lại. Nên 401 ở bất kỳ đâu đều có cùng một nghĩa: phiên chết. Xoá token và
 * phát sự kiện để AuthProvider đá về trang đăng nhập, thay vì để từng trang tự
 * xử lý.
 */
const UNAUTHORIZED_EVENT = "kuds:unauthorized";

export function onUnauthorized(handler: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const token = getToken();

  const response = await fetch(BASE_URL + withQuery(path, query), {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const details = (payload as { error?: unknown })?.error ?? payload ?? response.statusText;
    throw new ApiError(response.status, details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
};

export { BASE_URL };
