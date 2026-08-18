import { Badge, StatusBadge } from "../components/ui";
import {
  CURRENCY_OPTIONS,
  CURRENCY_SHORT,
  EQUIP_SLOT_OPTIONS,
  ITEM_CATEGORY,
  ITEM_CATEGORY_OPTIONS,
  ITEM_GRADE,
  ITEM_GRADE_OPTIONS,
  OBJECTIVE_KIND,
  OBJECTIVE_KIND_OPTIONS,
  PUBLISH_STATUS,
  PUBLISH_STATUS_OPTIONS,
  SHOP_TAB,
  SHOP_TAB_OPTIONS,
  labelOf,
} from "../lib/labels";
import { formatDateTime, formatDuration, formatNumber, formatVnd, truncate } from "../lib/format";
import type { ContentRow } from "../lib/types";
import type { FieldSpec, FormContext, ResourceSpec } from "./types";

/**
 * Khai báo cho mười hai bảng danh mục — xem resources/types.ts để biết vì sao
 * chúng gom về một chỗ.
 */

// --- Trường dùng lại --------------------------------------------------------

const keyField = (name: string, label: string, hint?: string): FieldSpec => ({
  kind: "text",
  name,
  label,
  hint: hint ?? "Chỉ chữ thường, số và dấu _. Không đổi được sau khi tạo.",
  keyFormat: true,
  createOnly: true,
  required: true,
  maxLength: 64,
  default: "",
});

const statusField: FieldSpec = {
  kind: "select",
  name: "status",
  label: "Trạng thái",
  options: PUBLISH_STATUS_OPTIONS,
  default: "draft",
  hint: "Chỉ 'Đã xuất bản' mới ra tới người chơi.",
};

const sortOrderField: FieldSpec = {
  kind: "number",
  name: "sortOrder",
  label: "Thứ tự hiển thị",
  min: 0,
  max: 100000,
  default: 0,
  hint: "Số nhỏ hiện trước.",
};

const bundleField = (label = "Gói thưởng"): FieldSpec => ({
  kind: "ref",
  name: "bundleKey",
  label,
  resource: "reward-bundles",
  valueField: "bundleKey",
  nullable: true,
  default: null,
  hint: "Khoá của gói thưởng. Để trống nếu không có phần thưởng.",
});

const itemRef = (name: string, label: string, nullable = false): FieldSpec => ({
  kind: "ref",
  name,
  label,
  resource: "items",
  valueField: "itemKey",
  labelField: "displayName",
  nullable,
  required: !nullable,
  default: null,
});

/** Cột trạng thái dùng chung cho mọi bảng có publish_status. */
const statusColumn = {
  key: "status",
  label: "Trạng thái",
  render: (row: ContentRow) => (
    <StatusBadge status={String(row.status)} label={labelOf(PUBLISH_STATUS, row.status)} />
  ),
};

/** Đọc mảng con của một dòng (lines / entries / objectives). */
function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/**
 * bundle_id → bundleKey. Quest/Achievement/MailTemplate chỉ trả về id (backend
 * không include quan hệ bundle), còn biểu mẫu ghi bằng khoá tự nhiên.
 */
function bundleKeyOf(row: ContentRow, ctx: FormContext): string | null {
  const id = row.bundleId;
  if (id === null || id === undefined) return null;
  return ctx.bundleKeyById.get(String(id)) ?? null;
}

// --- 1. Vật phẩm ------------------------------------------------------------

const items: ResourceSpec = {
  name: "items",
  label: "Vật phẩm",
  description: "Mọi thứ nằm trong túi đồ: trang bị, thực phẩm, dụng cụ.",
  icon: "🎒",
  idField: "itemKey",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo tên hiển thị…",
  columns: [
    { key: "itemKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "displayName", label: "Tên hiển thị" },
    { key: "category", label: "Loại", render: (r) => labelOf(ITEM_CATEGORY, r.category) },
    {
      key: "grade",
      label: "Phẩm cấp",
      render: (r) => <Badge tone="info">{labelOf(ITEM_GRADE, r.grade)}</Badge>,
    },
    {
      key: "isEquippable",
      label: "Mặc được",
      render: (r) => (r.isEquippable ? "Có" : "—"),
    },
    { key: "stackMax", label: "Xếp chồng", render: (r) => formatNumber(r.stackMax) },
    statusColumn,
  ],
  fields: [
    keyField("itemKey", "Khoá vật phẩm", "Khớp tên sprite bag_item_<khoá>.png. Ví dụ: ca_rot."),
    { kind: "text", name: "displayName", label: "Tên hiển thị", required: true, maxLength: 128, default: "" },
    { kind: "textarea", name: "description", label: "Mô tả", maxLength: 1000, rows: 3, full: true, default: "" },
    { kind: "select", name: "category", label: "Loại", options: ITEM_CATEGORY_OPTIONS, required: true, default: "thuc_pham" },
    { kind: "select", name: "grade", label: "Phẩm cấp", options: ITEM_GRADE_OPTIONS, default: "thuong" },
    { kind: "number", name: "stackMax", label: "Xếp chồng tối đa", min: 1, max: 9999, default: 999 },
    { kind: "boolean", name: "isConsumable", label: "Dùng được (tiêu hao)", default: false },
    {
      kind: "number",
      name: "shelfLifeSeconds",
      label: "Hạn dùng (giây)",
      min: 1,
      nullable: true,
      asDuration: true,
      default: null,
      hint: "Cột interval của Postgres — API không đọc lại được. Để trống khi sửa = giữ nguyên giá trị hiện có.",
    },
    statusField,
    sortOrderField,
    {
      kind: "group",
      name: "equip",
      label: "Hồ sơ trang bị",
      enableLabel: "Vật phẩm này mặc được",
      full: true,
      default: null,
      hint: "Bật thì vật phẩm tự động thành 'mặc được'. Tắt sẽ xoá hồ sơ trang bị — bị chặn nếu đang có người mặc.",
      newValue: () => ({ slot: "non", stats: {} }),
      fields: [
        { kind: "select", name: "slot", label: "Ô trang bị", options: EQUIP_SLOT_OPTIONS, required: true, default: "non" },
        {
          kind: "json",
          name: "stats",
          label: "Chỉ số",
          rows: 4,
          full: true,
          default: {},
          hint: 'Cặp khoá → số. Ví dụ: {"toc_do_thu_hoach": 1.15}',
        },
      ],
    },
  ],
  toForm: (row) => ({
    displayName: row.displayName,
    description: row.description,
    category: row.category,
    grade: row.grade,
    stackMax: row.stackMax,
    isConsumable: row.isConsumable,
    shelfLifeSeconds: null,
    status: row.status,
    sortOrder: row.sortOrder,
    equip: row.equipmentProfile
      ? {
          slot: (row.equipmentProfile as Record<string, unknown>).slot,
          stats: (row.equipmentProfile as Record<string, unknown>).stats ?? {},
        }
      : null,
  }),
  titleOf: (row) => String(row.displayName ?? row.itemKey),
};

// --- 2. Cây trồng -----------------------------------------------------------

const crops: ResourceSpec = {
  name: "crops",
  label: "Cây trồng",
  description: "Hạt giống, thời gian lớn và sản lượng thu hoạch của nông trại.",
  icon: "🌱",
  idField: "cropKey",
  hasStatus: false,
  searchable: true,
  searchPlaceholder: "Tìm theo khoá cây…",
  columns: [
    { key: "cropKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "seedItemKey", label: "Hạt giống", className: "font-mono text-xs" },
    { key: "harvestItemKey", label: "Nông sản", className: "font-mono text-xs" },
    { key: "growSeconds", label: "Thời gian lớn", render: (r) => formatDuration(r.growSeconds) },
    { key: "waterStages", label: "Lần tưới" },
    {
      key: "yield",
      label: "Sản lượng",
      render: (r) => `${formatNumber(r.yieldMin)} – ${formatNumber(r.yieldMax)}`,
    },
  ],
  fields: [
    keyField("cropKey", "Khoá cây trồng"),
    itemRef("seedItemKey", "Vật phẩm hạt giống"),
    itemRef("harvestItemKey", "Vật phẩm thu hoạch"),
    {
      kind: "number",
      name: "growSeconds",
      label: "Thời gian lớn (giây)",
      min: 1,
      max: 2_592_000,
      required: true,
      asDuration: true,
      default: 3600,
    },
    { kind: "number", name: "waterStages", label: "Số lần phải tưới", min: 0, max: 10, default: 1 },
    { kind: "number", name: "yieldMin", label: "Sản lượng tối thiểu", min: 1, max: 999, default: 1 },
    {
      kind: "number",
      name: "yieldMax",
      label: "Sản lượng tối đa",
      min: 1,
      max: 999,
      default: 1,
      hint: "Phải lớn hơn hoặc bằng sản lượng tối thiểu.",
    },
  ],
  titleOf: (row) => String(row.cropKey),
};

// --- 3. Mẫu tranh kiếng -----------------------------------------------------

const patterns: ResourceSpec = {
  name: "patterns",
  label: "Mẫu tranh kiếng",
  description: "Các mẫu của minigame vẽ tranh kiếng.",
  icon: "🖼️",
  idField: "patternKey",
  hasStatus: false,
  searchable: true,
  searchPlaceholder: "Tìm theo tên mẫu…",
  columns: [
    { key: "patternKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "displayName", label: "Tên hiển thị" },
    { key: "difficulty", label: "Độ khó", render: (r) => "★".repeat(Number(r.difficulty) || 1) },
    { key: "sortOrder", label: "Thứ tự" },
  ],
  fields: [
    keyField("patternKey", "Khoá mẫu"),
    { kind: "text", name: "displayName", label: "Tên hiển thị", required: true, maxLength: 128, default: "" },
    { kind: "number", name: "difficulty", label: "Độ khó (1–5)", min: 1, max: 5, default: 1 },
    sortOrderField,
    {
      kind: "json",
      name: "outline",
      label: "Dữ liệu nét vẽ",
      nullable: true,
      rows: 6,
      full: true,
      default: null,
      hint: "JSON tự do do minigame đọc. Để trống nếu chưa có.",
    },
  ],
  titleOf: (row) => String(row.displayName ?? row.patternKey),
};

// --- 4. NPC -----------------------------------------------------------------

const npcs: ResourceSpec = {
  name: "npcs",
  label: "NPC",
  description: "Nhân vật đứng trong scene, dùng cho mục tiêu nhiệm vụ.",
  icon: "🧍",
  idField: "npcKey",
  hasStatus: false,
  searchable: true,
  searchPlaceholder: "Tìm theo tên NPC…",
  columns: [
    { key: "npcKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "displayName", label: "Tên hiển thị" },
    { key: "sceneName", label: "Scene" },
  ],
  fields: [
    keyField("npcKey", "Khoá NPC"),
    { kind: "text", name: "displayName", label: "Tên hiển thị", required: true, maxLength: 128, default: "" },
    { kind: "text", name: "sceneName", label: "Scene", maxLength: 64, default: "MainScene" },
  ],
  titleOf: (row) => String(row.displayName ?? row.npcKey),
};

// --- 5. Gói thưởng ----------------------------------------------------------

const rewardBundles: ResourceSpec = {
  name: "reward-bundles",
  label: "Gói thưởng",
  description: "Cụm phần thưởng dùng lại cho nhiệm vụ, thành tựu, thư và cửa hàng.",
  icon: "🎁",
  idField: "bundleId",
  hasStatus: false,
  searchable: true,
  searchPlaceholder: "Tìm theo khoá gói…",
  columns: [
    { key: "bundleKey", label: "Khoá", className: "font-mono text-xs" },
    {
      key: "lines",
      label: "Nội dung",
      render: (r) => {
        const lines = rows(r.lines);
        if (lines.length === 0) return <span className="text-amber-700">Gói rỗng</span>;
        return lines
          .map((line) => {
            const what = line.currency
              ? labelOf(CURRENCY_SHORT, line.currency)
              : String(line.itemKey);
            return `${formatNumber(line.amount)} × ${what}`;
          })
          .join(", ");
      },
    },
    { key: "note", label: "Ghi chú", render: (r) => truncate(r.note, 50) || "—" },
  ],
  fields: [
    keyField("bundleKey", "Khoá gói thưởng"),
    { kind: "text", name: "note", label: "Ghi chú", maxLength: 500, nullable: true, full: true, default: null },
    {
      kind: "list",
      name: "lines",
      label: "Dòng thưởng",
      addLabel: "Thêm dòng thưởng",
      emptyLabel: "Chưa có dòng nào. Gói rỗng sẽ khiến người chơi bấm Nhận mà không được gì.",
      min: 1,
      max: 32,
      full: true,
      default: [],
      hint: "Mỗi dòng là TIỀN hoặc VẬT PHẨM, không được cả hai.",
      newItem: () => ({ currency: null, itemKey: null, amount: 1 }),
      fields: [
        {
          kind: "select",
          name: "currency",
          label: "Tiền",
          options: CURRENCY_OPTIONS,
          nullable: true,
          nullLabel: "— Không phải tiền —",
          default: null,
        },
        itemRef("itemKey", "Vật phẩm", true),
        { kind: "number", name: "amount", label: "Số lượng", min: 1, max: 1_000_000_000, required: true, default: 1 },
      ],
    },
  ],
  toForm: (row) => ({
    note: row.note ?? null,
    lines: rows(row.lines).map((line) => ({
      currency: line.currency ?? null,
      itemKey: line.itemKey ?? null,
      amount: Number(line.amount),
    })),
  }),
  titleOf: (row) => String(row.bundleKey),
};

// --- 6. Vật phẩm gacha ------------------------------------------------------

const gachaItems: ResourceSpec = {
  name: "gacha-items",
  label: "Vật phẩm gacha",
  description: "Thứ quay ra được từ banner. Có thể tặng kèm một vật phẩm túi đồ.",
  icon: "🎴",
  idField: "gachaItemKey",
  hasStatus: false,
  searchable: true,
  searchPlaceholder: "Tìm theo tên hiển thị…",
  columns: [
    { key: "gachaItemKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "displayName", label: "Tên hiển thị" },
    { key: "rarity", label: "Sao", render: (r) => "★".repeat(Number(r.rarity) || 1) },
    { key: "grantsItemKey", label: "Tặng vật phẩm", className: "font-mono text-xs" },
  ],
  fields: [
    keyField("gachaItemKey", "Khoá vật phẩm gacha"),
    { kind: "text", name: "displayName", label: "Tên hiển thị", required: true, maxLength: 128, default: "" },
    { kind: "text", name: "subtitle", label: "Phụ đề", maxLength: 128, default: "" },
    { kind: "number", name: "rarity", label: "Số sao (1–5)", min: 1, max: 5, required: true, default: 3 },
    itemRef("grantsItemKey", "Vật phẩm nhận được", true),
    { kind: "textarea", name: "description", label: "Mô tả", maxLength: 1000, rows: 3, full: true, default: "" },
    { kind: "textarea", name: "quote", label: "Câu trích", maxLength: 500, rows: 2, full: true, default: "" },
  ],
  titleOf: (row) => String(row.displayName ?? row.gachaItemKey),
};

// --- 7. Banner --------------------------------------------------------------

const banners: ResourceSpec = {
  name: "banners",
  label: "Banner gacha",
  description: "Bể quay: giá một lượt, mốc bảo hiểm và danh sách vật phẩm kèm trọng số.",
  icon: "🎰",
  idField: "bannerId",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo tên banner…",
  columns: [
    { key: "bannerKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "displayName", label: "Tên hiển thị" },
    {
      key: "cost",
      label: "Giá / lượt",
      render: (r) => `${formatNumber(r.costAmount)} ${labelOf(CURRENCY_SHORT, r.costCurrency)}`,
    },
    {
      key: "entries",
      label: "Bể quay",
      render: (r) => {
        const list = rows(r.entries);
        return list.length === 0 ? <span className="text-red-700">Rỗng</span> : `${list.length} món`;
      },
    },
    { key: "opensAt", label: "Mở", render: (r) => formatDateTime(r.opensAt) },
    { key: "closesAt", label: "Đóng", render: (r) => formatDateTime(r.closesAt) },
    statusColumn,
  ],
  fields: [
    keyField("bannerKey", "Khoá banner"),
    { kind: "text", name: "displayName", label: "Tên hiển thị", required: true, maxLength: 128, default: "" },
    { kind: "select", name: "costCurrency", label: "Tiền dùng để quay", options: CURRENCY_OPTIONS, default: "hoa_sen" },
    { kind: "number", name: "costAmount", label: "Giá một lượt", min: 1, max: 1_000_000, required: true, default: 160 },
    { kind: "number", name: "pity5Star", label: "Bảo hiểm 5 sao", min: 1, max: 1000, default: 90 },
    { kind: "number", name: "pity4Star", label: "Bảo hiểm 4 sao", min: 1, max: 1000, default: 10 },
    { kind: "datetime", name: "opensAt", label: "Thời điểm mở", required: true, default: null },
    {
      kind: "datetime",
      name: "closesAt",
      label: "Thời điểm đóng",
      nullable: true,
      default: null,
      hint: "Để trống = mở vô thời hạn. Phải sau thời điểm mở.",
    },
    statusField,
    {
      kind: "list",
      name: "entries",
      label: "Bể quay",
      addLabel: "Thêm vật phẩm vào bể",
      emptyLabel: "Bể rỗng. Banner đã xuất bản mà bể rỗng sẽ bị chặn lúc kiểm tra trước khi xuất bản.",
      min: 1,
      max: 200,
      full: true,
      default: [],
      hint: "Tỉ lệ thật = trọng số của món / tổng trọng số cùng bậc sao.",
      newItem: () => ({ gachaItemKey: null, weight: 100, isFeatured: false }),
      fields: [
        {
          kind: "ref",
          name: "gachaItemKey",
          label: "Vật phẩm gacha",
          resource: "gacha-items",
          valueField: "gachaItemKey",
          labelField: "displayName",
          required: true,
          default: null,
        },
        { kind: "number", name: "weight", label: "Trọng số", min: 1, max: 1_000_000, required: true, default: 100 },
        { kind: "boolean", name: "isFeatured", label: "Món nổi bật", default: false },
      ],
    },
  ],
  toForm: (row) => ({
    displayName: row.displayName,
    costCurrency: row.costCurrency,
    costAmount: Number(row.costAmount),
    pity5Star: Number(row.pity5Star),
    pity4Star: Number(row.pity4Star),
    opensAt: row.opensAt,
    closesAt: row.closesAt ?? null,
    status: row.status,
    entries: rows(row.entries).map((entry) => ({
      gachaItemKey: entry.gachaItemKey,
      weight: Number(entry.weight),
      isFeatured: Boolean(entry.isFeatured),
    })),
  }),
  titleOf: (row) => String(row.displayName ?? row.bannerKey),
};

// --- 8. Gói cửa hàng --------------------------------------------------------

const shopProducts: ResourceSpec = {
  name: "shop-products",
  label: "Gói cửa hàng",
  description: "Năm tab của màn Nạp. Mỗi gói bán bằng tiền thật HOẶC tiền trong game.",
  icon: "🛒",
  idField: "productId",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo khoá gói…",
  columns: [
    { key: "productKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "tab", label: "Tab", render: (r) => labelOf(SHOP_TAB, r.tab) },
    { key: "displayName", label: "Tên hiển thị" },
    {
      key: "price",
      label: "Giá",
      render: (r) =>
        r.priceVnd
          ? formatVnd(r.priceVnd)
          : `${formatNumber(r.priceAmount)} ${labelOf(CURRENCY_SHORT, r.priceCurrency)}`,
    },
    {
      key: "bundle",
      label: "Gói thưởng",
      className: "font-mono text-xs",
      render: (r) => String((r.bundle as Record<string, unknown> | null)?.bundleKey ?? "—"),
    },
    statusColumn,
  ],
  fields: [
    keyField("productKey", "Khoá gói"),
    { kind: "select", name: "tab", label: "Tab hiển thị", options: SHOP_TAB_OPTIONS, required: true, default: "nap" },
    { kind: "text", name: "displayName", label: "Tên hiển thị", maxLength: 128, default: "" },
    {
      kind: "number",
      name: "priceVnd",
      label: "Giá tiền thật (VND)",
      min: 1,
      max: 100_000_000,
      nullable: true,
      default: null,
      hint: "Điền cái này HOẶC cặp tiền trong game bên dưới, không được cả hai.",
    },
    { kind: "text", name: "storeSku", label: "SKU cửa hàng (IAP)", maxLength: 128, nullable: true, default: null },
    {
      kind: "text",
      name: "transferNote",
      label: "Nội dung chuyển khoản",
      maxLength: 25,
      nullable: true,
      default: null,
      hint: "PayOS giới hạn 25 ký tự. Để trống thì server tự sinh từ khoá gói.",
    },
    {
      kind: "select",
      name: "priceCurrency",
      label: "Tiền trong game",
      options: CURRENCY_OPTIONS,
      nullable: true,
      nullLabel: "— Không bán bằng tiền trong game —",
      default: null,
    },
    { kind: "number", name: "priceAmount", label: "Số tiền trong game", min: 1, nullable: true, default: null },
    {
      kind: "ref",
      name: "bundleKey",
      label: "Gói thưởng nhận được",
      resource: "reward-bundles",
      valueField: "bundleKey",
      required: true,
      default: null,
      hint: "Bắt buộc: gói này trả cái gì cho người chơi.",
    },
    {
      kind: "number",
      name: "bonusMultiplier",
      label: "Hệ số thưởng thêm",
      min: 1,
      max: 9.99,
      step: 0.01,
      default: 1,
      hint: "Huy hiệu x2 ở tab Nạp đầu cực hời đọc từ đây.",
    },
    { kind: "boolean", name: "oncePerAccount", label: "Chỉ mua một lần mỗi tài khoản", default: false },
    { kind: "datetime", name: "activeFrom", label: "Bán từ", default: null },
    { kind: "datetime", name: "activeTo", label: "Bán đến", nullable: true, default: null },
    statusField,
    sortOrderField,
  ],
  toForm: (row) => ({
    tab: row.tab,
    displayName: row.displayName,
    priceVnd: row.priceVnd === null || row.priceVnd === undefined ? null : Number(row.priceVnd),
    storeSku: row.storeSku ?? null,
    transferNote: row.transferNote ?? null,
    priceCurrency: row.priceCurrency ?? null,
    priceAmount:
      row.priceAmount === null || row.priceAmount === undefined ? null : Number(row.priceAmount),
    bundleKey: (row.bundle as Record<string, unknown> | null)?.bundleKey ?? null,
    bonusMultiplier: Number(row.bonusMultiplier ?? 1),
    oncePerAccount: Boolean(row.oncePerAccount),
    activeFrom: row.activeFrom,
    activeTo: row.activeTo ?? null,
    status: row.status,
    sortOrder: row.sortOrder,
  }),
  titleOf: (row) => String(row.displayName || row.productKey),
};

// --- 9. Nhiệm vụ ------------------------------------------------------------

const quests: ResourceSpec = {
  name: "quests",
  label: "Nhiệm vụ",
  description: "Chuỗi nhiệm vụ theo chương, kèm mục tiêu và phần thưởng.",
  icon: "📜",
  idField: "questKey",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo tiêu đề…",
  needsBundleLookup: true,
  columns: [
    { key: "questKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "title", label: "Tiêu đề" },
    { key: "chapter", label: "Chương" },
    { key: "requiresQuest", label: "Phụ thuộc", className: "font-mono text-xs" },
    {
      key: "objectives",
      label: "Mục tiêu",
      render: (r) => `${rows(r.objectives).length} mục`,
    },
    statusColumn,
  ],
  fields: [
    keyField("questKey", "Khoá nhiệm vụ"),
    { kind: "text", name: "title", label: "Tiêu đề", required: true, maxLength: 200, default: "" },
    { kind: "textarea", name: "summary", label: "Tóm tắt", maxLength: 1000, rows: 3, full: true, default: "" },
    { kind: "number", name: "chapter", label: "Chương", min: 1, max: 999, default: 1 },
    {
      kind: "ref",
      name: "requiresQuest",
      label: "Nhiệm vụ phải xong trước",
      resource: "quests",
      valueField: "questKey",
      labelField: "title",
      nullable: true,
      default: null,
      hint: "Không được tạo vòng: A cần B, B cần A sẽ bị chặn lúc kiểm tra trước khi xuất bản.",
    },
    bundleField(),
    statusField,
    sortOrderField,
    {
      kind: "list",
      name: "objectives",
      label: "Mục tiêu",
      addLabel: "Thêm mục tiêu",
      emptyLabel: "Chưa có mục tiêu nào.",
      max: 16,
      full: true,
      default: [],
      hint: "Sửa danh sách này sau khi đã có người chơi làm nhiệm vụ sẽ bị backend từ chối — tạo nhiệm vụ mới thay vì sửa.",
      newItem: () => ({ kind: "thu_thap", targetKey: null, targetCount: 1 }),
      fields: [
        { kind: "select", name: "kind", label: "Loại mục tiêu", options: OBJECTIVE_KIND_OPTIONS, required: true, default: "thu_thap" },
        {
          kind: "text",
          name: "targetKey",
          label: "Khoá mục tiêu",
          maxLength: 64,
          nullable: true,
          default: null,
          hint: "item_key / npc_key / crop_key tuỳ loại mục tiêu.",
        },
        { kind: "number", name: "targetCount", label: "Số lượng", min: 1, max: 1_000_000, default: 1 },
      ],
    },
  ],
  toForm: (row, ctx) => ({
    title: row.title,
    summary: row.summary,
    chapter: row.chapter,
    requiresQuest: row.requiresQuest ?? null,
    bundleKey: bundleKeyOf(row, ctx),
    status: row.status,
    sortOrder: row.sortOrder,
    objectives: rows(row.objectives).map((objective) => ({
      kind: objective.kind,
      targetKey: objective.targetKey ?? null,
      targetCount: Number(objective.targetCount),
    })),
  }),
  titleOf: (row) => String(row.title ?? row.questKey),
};

// --- 10. Thành tựu ----------------------------------------------------------

const achievements: ResourceSpec = {
  name: "achievements",
  label: "Thành tựu",
  description: "Điều kiện tích luỹ dài hạn, dùng chung bộ loại mục tiêu với nhiệm vụ.",
  icon: "🏆",
  idField: "achievementKey",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo tiêu đề…",
  needsBundleLookup: true,
  columns: [
    { key: "achievementKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "title", label: "Tiêu đề" },
    { key: "kind", label: "Loại", render: (r) => labelOf(OBJECTIVE_KIND, r.kind) },
    { key: "targetCount", label: "Chỉ tiêu", render: (r) => formatNumber(r.targetCount) },
    statusColumn,
  ],
  fields: [
    keyField("achievementKey", "Khoá thành tựu"),
    { kind: "text", name: "title", label: "Tiêu đề", required: true, maxLength: 200, default: "" },
    { kind: "textarea", name: "description", label: "Mô tả", maxLength: 1000, rows: 3, full: true, default: "" },
    { kind: "select", name: "kind", label: "Loại điều kiện", options: OBJECTIVE_KIND_OPTIONS, required: true, default: "thu_thap" },
    {
      kind: "text",
      name: "targetKey",
      label: "Khoá mục tiêu",
      maxLength: 64,
      nullable: true,
      default: null,
      hint: "Để trống nếu điều kiện không gắn với một đối tượng cụ thể.",
    },
    {
      kind: "number",
      name: "targetCount",
      label: "Chỉ tiêu",
      min: 1,
      required: true,
      default: 1,
      hint: "Thành tựu tiêu tiền đếm bằng đồng, nên số có thể rất lớn.",
    },
    bundleField(),
    statusField,
    sortOrderField,
  ],
  toForm: (row, ctx) => ({
    title: row.title,
    description: row.description,
    kind: row.kind,
    targetKey: row.targetKey ?? null,
    targetCount: Number(row.targetCount),
    bundleKey: bundleKeyOf(row, ctx),
    status: row.status,
    sortOrder: row.sortOrder,
  }),
  titleOf: (row) => String(row.title ?? row.achievementKey),
};

// --- 11. Mẫu thư ------------------------------------------------------------

const mailTemplates: ResourceSpec = {
  name: "mail-templates",
  label: "Mẫu thư",
  description: "Thư hệ thống gửi tự động. Thư GM gửi tay thì dùng trang Gửi thư.",
  icon: "✉️",
  idField: "templateKey",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo tiêu đề…",
  needsBundleLookup: true,
  columns: [
    { key: "templateKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "title", label: "Tiêu đề" },
    { key: "sender", label: "Người gửi" },
    statusColumn,
  ],
  fields: [
    keyField("templateKey", "Khoá mẫu thư"),
    { kind: "text", name: "title", label: "Tiêu đề", required: true, maxLength: 200, default: "" },
    { kind: "text", name: "sender", label: "Người gửi", maxLength: 128, default: "Ban Quản Trị" },
    {
      kind: "textarea",
      name: "body",
      label: "Nội dung",
      maxLength: 4000,
      rows: 8,
      full: true,
      default: "",
      hint: "Dùng token {player_name} để chèn tên người chơi.",
    },
    bundleField("Gói thưởng đính kèm"),
    {
      kind: "number",
      name: "ttlSeconds",
      label: "Hạn sống của thư (giây)",
      min: 1,
      nullable: true,
      asDuration: true,
      default: null,
      hint: "Cột interval của Postgres — API không đọc lại được. Để trống khi sửa = giữ nguyên.",
    },
    statusField,
  ],
  toForm: (row, ctx) => ({
    title: row.title,
    sender: row.sender,
    body: row.body,
    bundleKey: bundleKeyOf(row, ctx),
    ttlSeconds: null,
    status: row.status,
  }),
  titleOf: (row) => String(row.title ?? row.templateKey),
};

// --- 12. Sổ tay di sản ------------------------------------------------------

const codexEntries: ResourceSpec = {
  name: "codex-entries",
  label: "Sổ tay di sản",
  description: "Bài viết trong sổ tay, mở khoá dần khi chơi.",
  icon: "📖",
  idField: "entryKey",
  hasStatus: true,
  searchable: true,
  searchPlaceholder: "Tìm theo tiêu đề…",
  columns: [
    { key: "entryKey", label: "Khoá", className: "font-mono text-xs" },
    { key: "title", label: "Tiêu đề" },
    { key: "category", label: "Chủ đề" },
    statusColumn,
  ],
  fields: [
    keyField("entryKey", "Khoá bài viết"),
    { kind: "text", name: "title", label: "Tiêu đề", required: true, maxLength: 200, default: "" },
    {
      kind: "text",
      name: "category",
      label: "Chủ đề",
      required: true,
      maxLength: 64,
      default: "",
      hint: "Ví dụ: tranh_kieng, long_den, cu_lao.",
    },
    { kind: "textarea", name: "body", label: "Nội dung", maxLength: 8000, rows: 12, full: true, default: "" },
    statusField,
    sortOrderField,
  ],
  titleOf: (row) => String(row.title ?? row.entryKey),
};

// ---------------------------------------------------------------------------

export const RESOURCE_SPECS: ResourceSpec[] = [
  items,
  crops,
  patterns,
  npcs,
  rewardBundles,
  gachaItems,
  banners,
  shopProducts,
  quests,
  achievements,
  mailTemplates,
  codexEntries,
];

export const RESOURCE_BY_NAME = new Map(RESOURCE_SPECS.map((spec) => [spec.name, spec]));
