import type { ReactNode } from "react";
import type { ContentRow } from "../lib/types";
import type { Option } from "../lib/labels";

/**
 * MÔ TẢ MƯỜI HAI BẢNG DANH MỤC
 *
 * Backend gom mười hai bảng vào một bộ route /admin/content/:resource và một sổ
 * đăng ký duy nhất (admin-content.resources.ts). Frontend soi gương đúng như
 * vậy: một trang danh sách, một trang biểu mẫu, còn khác biệt giữa các bảng nằm
 * hết trong `RESOURCE_SPECS`.
 *
 * Thêm bảng mới bên backend = thêm một mục vào resources/index.tsx, không đụng
 * tới trang nào.
 *
 * File này là hợp đồng viết TAY, chép từ các Zod schema bên backend. Không có
 * cách nào sinh tự động khi hai repo tách nhau, nên đổi schema bên kia thì phải
 * đổi ở đây — nếu quên, backend vẫn chặn bằng 400 kèm lỗi theo từng trường và
 * biểu mẫu hiện đúng ô sai.
 */

interface FieldBase {
  name: string;
  label: string;
  hint?: string;
  /** Khoá chính: nhập lúc tạo, khoá cứng lúc sửa (backend không nhận). */
  createOnly?: boolean;
  required?: boolean;
  /** Chiếm trọn chiều ngang thay vì nửa lưới hai cột. */
  full?: boolean;
  default?: unknown;
}

export interface TextField extends FieldBase {
  kind: "text";
  maxLength?: number;
  placeholder?: string;
  nullable?: boolean;
  /** Khoá kỹ thuật: chỉ chữ thường, số và _ (regex bên backend). */
  keyFormat?: boolean;
}

export interface TextareaField extends FieldBase {
  kind: "textarea";
  rows?: number;
  maxLength?: number;
  nullable?: boolean;
}

export interface NumberField extends FieldBase {
  kind: "number";
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
  /** Hiện "1 giờ 30 phút" bên dưới ô nhập giây. */
  asDuration?: boolean;
}

export interface SelectField extends FieldBase {
  kind: "select";
  options: Option[];
  nullable?: boolean;
  nullLabel?: string;
}

export interface BooleanField extends FieldBase {
  kind: "boolean";
}

export interface DateTimeField extends FieldBase {
  kind: "datetime";
  nullable?: boolean;
}

export interface JsonField extends FieldBase {
  kind: "json";
  nullable?: boolean;
  rows?: number;
}

/** Trỏ tới khoá tự nhiên của một bảng khác; gợi ý bằng datalist. */
export interface RefField extends FieldBase {
  kind: "ref";
  resource: string;
  valueField: string;
  labelField?: string;
  nullable?: boolean;
}

/** Danh sách con thay thế toàn bộ mỗi lần lưu (dòng thưởng, mục tiêu, bể quay). */
export interface ListField extends FieldBase {
  kind: "list";
  fields: FieldSpec[];
  min?: number;
  max?: number;
  addLabel: string;
  emptyLabel: string;
  newItem: () => Record<string, unknown>;
}

/** Cụm trường bật/tắt được — dùng cho hồ sơ trang bị của vật phẩm. */
export interface GroupField extends FieldBase {
  kind: "group";
  fields: FieldSpec[];
  enableLabel: string;
  newValue: () => Record<string, unknown>;
}

export type FieldSpec =
  | TextField
  | TextareaField
  | NumberField
  | SelectField
  | BooleanField
  | DateTimeField
  | JsonField
  | RefField
  | ListField
  | GroupField;

export interface ColumnSpec {
  key: string;
  label: string;
  render?: (row: ContentRow) => ReactNode;
  className?: string;
}

/** Dữ liệu tra cứu mà biểu mẫu cần trước khi dựng giá trị ban đầu. */
export interface FormContext {
  /** bundle_id (chuỗi số) → bundleKey. Bảng quest/achievement/mail chỉ trả về id. */
  bundleKeyById: Map<string, string>;
}

export interface ResourceSpec {
  /** Trùng với đoạn :resource trên URL của backend. */
  name: string;
  label: string;
  description: string;
  icon: string;
  idField: string;
  hasStatus: boolean;
  searchable: boolean;
  searchPlaceholder?: string;
  /** Cần bản đồ bundle_id → bundleKey mới dựng được biểu mẫu. */
  needsBundleLookup?: boolean;
  columns: ColumnSpec[];
  fields: FieldSpec[];
  /** Dòng từ API → giá trị biểu mẫu. Mặc định: lấy đúng các trường có tên trùng. */
  toForm?: (row: ContentRow, ctx: FormContext) => Record<string, unknown>;
  /** Tiêu đề trang sửa. */
  titleOf?: (row: ContentRow) => string;
}
