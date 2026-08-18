import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatDateTime, formatNumber } from "../lib/format";
import type { DashboardResponse } from "../lib/types";
import { Badge, Card, ErrorState, Loading, PageHeader, Table, Td, Th } from "../components/ui";

/** Các ô đếm ở hàng trên: nhãn tiếng Việt cho từng khoá của counts. */
const COUNT_LABELS: { key: keyof DashboardResponse["counts"]; label: string; to?: string }[] = [
  { key: "players", label: "Người chơi", to: "/players" },
  { key: "publishedItems", label: "Vật phẩm đã xuất bản", to: "/content/items?status=published" },
  { key: "publishedQuests", label: "Nhiệm vụ đã xuất bản", to: "/content/quests?status=published" },
  {
    key: "publishedAchievements",
    label: "Thành tựu đã xuất bản",
    to: "/content/achievements?status=published",
  },
  { key: "publishedBanners", label: "Banner đang chạy", to: "/content/banners?status=published" },
  {
    key: "publishedShopProducts",
    label: "Gói cửa hàng đang bán",
    to: "/content/shop-products?status=published",
  },
  { key: "mailsInFlight", label: "Thư chưa xoá" },
  { key: "gachaPulls", label: "Lượt quay gacha" },
];

/** Bản nháp theo bảng — bấm vào là mở đúng danh sách đã lọc sẵn draft. */
const DRAFT_LINKS: { key: keyof DashboardResponse["drafts"]; label: string; resource: string }[] = [
  { key: "items", label: "Vật phẩm", resource: "items" },
  { key: "quests", label: "Nhiệm vụ", resource: "quests" },
  { key: "achievements", label: "Thành tựu", resource: "achievements" },
  { key: "mailTemplates", label: "Mẫu thư", resource: "mail-templates" },
  { key: "banners", label: "Banner", resource: "banners" },
  { key: "shopProducts", label: "Gói cửa hàng", resource: "shop-products" },
  { key: "codex", label: "Sổ tay di sản", resource: "codex-entries" },
];

export function DashboardPage() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardResponse>("/admin/dashboard"),
  });

  if (isPending) return <Loading />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const { config, counts, drafts, issues } = data;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        description="Tình trạng nội dung và một vài con số của máy chủ."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COUNT_LABELS.map(({ key, label, to }) => {
          const body = (
            <div className="rounded-xl border border-ink-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-maroon-300">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">{formatNumber(counts[key])}</p>
            </div>
          );
          return to ? (
            <Link key={key} to={to}>
              {body}
            </Link>
          ) : (
            <div key={key}>{body}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Phiên bản nội dung"
          description="Client tải lại danh mục khi số này đổi."
          actions={
            <Link
              to="/publish"
              className="rounded-lg bg-maroon-800 px-3.5 py-2 text-sm font-medium text-cream hover:bg-maroon-700"
            >
              Tới trang xuất bản
            </Link>
          }
        >
          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Phiên bản</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink-900">v{config.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Xuất bản lúc</dt>
              <dd className="mt-1 text-sm text-ink-800">{formatDateTime(config.publishedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-ink-500">Người xuất bản</dt>
              <dd className="mt-1 text-sm text-ink-800">
                {config.publisherName || config.publisherEmail || "—"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-ink-100 px-5 py-4">
            <Badge tone={issues.errorCount > 0 ? "danger" : "success"}>
              {issues.errorCount} lỗi chặn xuất bản
            </Badge>
            <Badge tone={issues.warningCount > 0 ? "warning" : "neutral"}>
              {issues.warningCount} cảnh báo
            </Badge>
          </div>
        </Card>

        <Card
          title={`Bản nháp đang chờ (${drafts.total})`}
          description="Nội dung đã soạn nhưng chưa ra tới người chơi."
        >
          {drafts.total === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-500">
              Không còn bản nháp nào. Mọi thứ đã ở đúng trạng thái mong muốn.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Bảng</Th>
                  <Th className="text-right">Bản nháp</Th>
                </tr>
              </thead>
              <tbody>
                {DRAFT_LINKS.filter(({ key }) => drafts[key] > 0).map(({ key, label, resource }) => (
                  <tr key={key} className="hover:bg-ink-50">
                    <Td>
                      <Link
                        className="text-maroon-800 hover:underline"
                        to={`/content/${resource}?status=draft`}
                      >
                        {label}
                      </Link>
                    </Td>
                    <Td className="text-right font-medium">{formatNumber(drafts[key])}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
