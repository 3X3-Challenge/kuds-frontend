import type { FieldSpec } from "./types";

/** Giá trị khởi tạo cho biểu mẫu TẠO MỚI, lấy từ `default` của từng trường. */
export function defaultValues(fields: FieldSpec[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.name] = field.default;
      continue;
    }
    switch (field.kind) {
      case "boolean":
        values[field.name] = false;
        break;
      case "list":
        values[field.name] = [];
        break;
      case "select":
        values[field.name] = field.nullable ? null : (field.options[0]?.value ?? null);
        break;
      case "text":
      case "textarea":
        values[field.name] = field.nullable ? null : "";
        break;
      default:
        values[field.name] = null;
    }
  }

  return values;
}

/**
 * Chỉ gửi thứ đã đổi.
 *
 * PATCH của backend là partial: trường vắng mặt = không đụng tới. Gửi cả biểu
 * mẫu sẽ ghi đè những thứ mình không định sửa, và với vài trường thì còn tệ hơn
 * thế:
 *
 *   - `equip` gửi null khi vật phẩm vốn không có hồ sơ trang bị ⇒ Prisma chạy
 *     `delete` lên một dòng không tồn tại và trả lỗi.
 *   - `shelfLifeSeconds` / `ttlSeconds` không đọc lại được từ API (cột interval),
 *     nên biểu mẫu luôn hiện trống; gửi kèm sẽ xoá sạch giá trị đang có.
 *   - `objectives` / `lines` / `entries` xoá rồi tạo lại toàn bộ dòng con, kéo
 *     theo tiến độ người chơi.
 */
export function changedValues(
  initial: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const changed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    if (JSON.stringify(value) !== JSON.stringify(initial[key])) {
      changed[key] = value;
    }
  }

  return changed;
}

/**
 * Bỏ những trường đang trống mà lược đồ KHÔNG cho phép null.
 *
 * Zod `.default(...)` chỉ chạy khi khoá vắng mặt, không chạy khi khoá mang giá
 * trị null. Gửi `activeFrom: null` vì người tạo chưa điền sẽ ăn lỗi "Invalid
 * date" thay vì nhận mặc định "bây giờ" mà backend đã chuẩn bị sẵn. Trường
 * nullable thì giữ nguyên null — ở đó null là một lựa chọn có nghĩa.
 */
export function stripUnsetNulls(
  values: Record<string, unknown>,
  fields: FieldSpec[],
): Record<string, unknown> {
  const nullable = new Set(
    fields.filter((field) => "nullable" in field && field.nullable).map((field) => field.name),
  );

  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== null || nullable.has(key)),
  );
}
