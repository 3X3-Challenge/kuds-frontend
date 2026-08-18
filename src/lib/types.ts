/**
 * Hình dạng dữ liệu trả về từ /admin/*.
 *
 * Chép tay từ backend (src/modules/admin) chứ không sinh tự động — hai repo
 * tách nhau. Sửa response bên backend thì sửa cả ở đây.
 */

export type AdminRole = "viewer" | "editor" | "publisher";

export interface AdminUser {
  adminId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

// --- Nội dung ---------------------------------------------------------------

export type PublishStatus = "draft" | "published" | "archived";

export interface ResourceType {
  name: string;
  table: string;
  idField: string;
  hasStatus: boolean;
  searchable: boolean;
}

/** Dòng danh mục: hình dạng khác nhau tuỳ bảng, nên chỉ biết nó là một object. */
export type ContentRow = Record<string, unknown>;

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ArchiveResponse {
  archived: boolean;
  deleted: boolean;
  item: ContentRow | null;
}

// --- Vận hành ---------------------------------------------------------------

export interface ConfigState {
  version: string;
  publishedAt: string | null;
  publishedBy: string | null;
  publisherEmail: string | null;
  publisherName: string | null;
}

export interface PublishIssue {
  severity: "error" | "warning";
  code: string;
  table: string;
  rowKey: string;
  message: string;
}

export interface PreflightResponse {
  ok: boolean;
  errors: PublishIssue[];
  warnings: PublishIssue[];
}

export interface PublishResponse {
  version: string;
  publishedAt: string;
  forced: boolean;
  skippedErrorCount: number;
}

export interface DashboardResponse {
  config: ConfigState;
  counts: {
    players: number;
    publishedItems: number;
    publishedQuests: number;
    publishedAchievements: number;
    publishedBanners: number;
    publishedShopProducts: number;
    mailsInFlight: number;
    gachaPulls: number;
  };
  drafts: {
    items: number;
    quests: number;
    achievements: number;
    mailTemplates: number;
    banners: number;
    shopProducts: number;
    codex: number;
    total: number;
  };
  issues: { errorCount: number; warningCount: number };
}

export interface AuditRow {
  logId: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  action: "insert" | "update" | "delete" | "publish";
  tableName: string;
  rowKey: string;
  before: unknown;
  after: unknown;
  actedAt: string;
}

export interface AuditResponse {
  items: AuditRow[];
  nextCursor: string | null;
}

// --- Người chơi -------------------------------------------------------------

export type CurrencyCode = "hoa_sen" | "long_den";
export type AccountStatus = "active" | "banned" | "deleted";

export interface PlayerWallet {
  currency: CurrencyCode;
  balance: number;
}

export interface PlayerRow {
  playerId: string;
  accountId: string;
  uid: string;
  displayName: string;
  level: number;
  exp: number;
  createdAt: string;
  status: AccountStatus;
  bannedUntil: string | null;
  lastLoginAt: string | null;
  wallets: PlayerWallet[];
}

/** GET /admin/players/:id trả nguyên dòng Prisma đã snapshot — rộng và lỏng. */
export interface PlayerDetail extends Record<string, unknown> {
  playerId: string;
  uid: string;
  displayName: string;
  level: number;
  exp: number | string;
  mailCapacity: number;
  avatarUrl: string | null;
  createdAt: string;
  /** Tài khoản đăng nhập. Tên đăng nhập nằm ở bảng auth_identity, không kèm ở đây. */
  account: {
    accountId: string;
    status: AccountStatus;
    bannedUntil: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    deletedAt: string | null;
  };
  wallets: { currency: CurrencyCode; balance: string | number; updatedAt?: string }[];
  inventory: { itemKey: string; quantity: string | number; acquiredAt?: string }[];
  equipment: { slot: string; itemKey: string }[];
  quests: { questKey: string; status: string; startedAt: string; claimedAt: string | null }[];
  achievements: { achievementKey: string; progress: string | number; claimedAt: string | null }[];
  save: Record<string, unknown> | null;
}

export interface BanResponse {
  playerId: string;
  status: AccountStatus;
  bannedUntil: string | null;
}

export interface AdjustCurrencyResponse {
  playerId: string;
  currency: CurrencyCode;
  balance: number;
}

export interface GrantItemResponse {
  playerId: string;
  itemKey: string;
  quantity: number;
}

export interface SendMailResponse {
  sentCount: number;
  requestedCount: number | null;
}
