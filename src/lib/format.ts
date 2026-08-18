/** Định dạng hiển thị. Giờ theo múi giờ của máy đang mở trang. */

const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormat.format(date);
}

export function formatDate(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : dateFormat.format(date);
}

/** Số dư ví là bigint bên DB, về đây có thể là string — ép về Number để in. */
export function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num.toLocaleString("vi-VN");
}

export function formatVnd(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return `${formatNumber(value)} ₫`;
}

/** "3.600" giây → "1 giờ". Cột interval của DB nhập bằng giây. */
export function formatDuration(seconds: unknown): string {
  if (seconds === null || seconds === undefined || seconds === "") return "Không hết hạn";
  const total = Number(seconds);
  if (Number.isNaN(total)) return String(seconds);

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  const parts = [
    days ? `${days} ngày` : "",
    hours ? `${hours} giờ` : "",
    minutes ? `${minutes} phút` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : `${total} giây`;
}

/**
 * ISO 8601 → giá trị của <input type="datetime-local">, tính theo giờ địa
 * phương. Cắt chuỗi ISO thẳng tay sẽ hiện sai giờ đúng bằng offset múi giờ.
 */
export function toDateTimeLocal(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Chiều ngược lại: input trả giờ địa phương, backend nhận ISO có múi giờ. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function truncate(value: unknown, max = 60): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
