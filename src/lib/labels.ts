/** Nhãn tiếng Việt cho các enum của backend. Giá trị gửi lên vẫn là khoá gốc. */

export interface Option {
  value: string;
  label: string;
}

function options(map: Record<string, string>): Option[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

export const ITEM_CATEGORY = {
  trang_bi: "Trang bị",
  thuc_pham: "Thực phẩm",
  dung_cu: "Dụng cụ",
} as const;

export const ITEM_GRADE = {
  thuong: "Thường",
  quy: "Quý",
  cuc_pham: "Cực phẩm",
  gia_tien: "Gia tiên",
} as const;

export const EQUIP_SLOT = {
  non: "Nón",
  ao: "Áo",
  tay: "Tay",
  chan: "Chân",
  phu_kien: "Phụ kiện",
} as const;

export const CURRENCY = {
  hoa_sen: "Hoa sen (tiền nạp)",
  long_den: "Lồng đèn (tiền mềm)",
} as const;

export const CURRENCY_SHORT = {
  hoa_sen: "Hoa sen",
  long_den: "Lồng đèn",
} as const;

export const SHOP_TAB = {
  nap: "Nạp",
  nap_dau_cuc_hoi: "Nạp đầu cực hời",
  goi_uu_dai: "Gói ưu đãi",
  doi_qua_nap: "Đổi quà nạp",
  goi_tai_nguyen: "Gói tài nguyên",
} as const;

export const PUBLISH_STATUS = {
  draft: "Bản nháp",
  published: "Đã xuất bản",
  archived: "Lưu trữ",
} as const;

export const OBJECTIVE_KIND = {
  thu_thap: "Thu thập vật phẩm",
  giao_vat_pham: "Giao vật phẩm cho NPC",
  noi_chuyen_npc: "Nói chuyện với NPC",
  cho_thu_cung_an: "Cho thú cưng ăn",
  thu_hoach: "Thu hoạch",
  ve_tranh_kieng: "Vẽ tranh kiếng",
  tieu_tien: "Tiêu tiền",
  so_huu_vat_pham: "Sở hữu vật phẩm",
} as const;

export const ACCOUNT_STATUS = {
  active: "Đang hoạt động",
  banned: "Bị cấm",
  deleted: "Đã xoá",
} as const;

export const ADMIN_ROLE = {
  viewer: "Người xem",
  editor: "Biên tập viên",
  publisher: "Người xuất bản",
} as const;

export const ADMIN_ROLE_HINT = {
  viewer: "Chỉ đọc: xem nội dung, người chơi, nhật ký.",
  editor: "Thêm/sửa/lưu trữ nội dung. Không xuất bản, không đụng người chơi.",
  publisher: "Toàn quyền: xuất bản, thao tác người chơi, quản lý tài khoản quản trị.",
} as const;

export const AUDIT_ACTION = {
  insert: "Thêm mới",
  update: "Cập nhật",
  delete: "Xoá",
  publish: "Xuất bản",
} as const;

export const ITEM_CATEGORY_OPTIONS = options(ITEM_CATEGORY);
export const ITEM_GRADE_OPTIONS = options(ITEM_GRADE);
export const EQUIP_SLOT_OPTIONS = options(EQUIP_SLOT);
export const CURRENCY_OPTIONS = options(CURRENCY);
export const SHOP_TAB_OPTIONS = options(SHOP_TAB);
export const PUBLISH_STATUS_OPTIONS = options(PUBLISH_STATUS);
export const OBJECTIVE_KIND_OPTIONS = options(OBJECTIVE_KIND);
export const ADMIN_ROLE_OPTIONS = options(ADMIN_ROLE);

/** Tra nhãn, không có thì trả nguyên khoá — thêm enum bên backend không làm vỡ UI. */
export function labelOf(map: Record<string, string>, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return map[String(value)] ?? String(value);
}
