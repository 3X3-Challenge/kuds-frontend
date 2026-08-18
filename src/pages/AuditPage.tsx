import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { AUDIT_ACTION, labelOf } from "../lib/labels";
import { formatDateTime } from "../lib/format";
import type { AdminUser, AuditResponse, AuditRow } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  JsonBlock,
  Loading,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "../components/ui";

const LIMIT = 50;

const ACTION_TONE = {
  insert: "success",
  update: "info",
  delete: "danger",
  publish: "warning",
} as const;

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useAuth();

  const tableName = searchParams.get("tableName") ?? "";
  const rowKey = searchParams.get("rowKey") ?? "";
  const adminId = searchParams.get("adminId") ?? "";

  const [tableDraft, setTableDraft] = useState(tableName);
  const [rowDraft, setRowDraft] = useState(rowKey);
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Danh sách admin để lọc theo người thao tác — chỉ publisher đọc được. */
  const admins = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.get<AdminUser[]>("/admin/admins"),
    enabled: can("publisher"),
    staleTime: 5 * 60_000,
  });

  const query = useInfiniteQuery({
    queryKey: ["audit", { tableName, rowKey, adminId }],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<AuditResponse>("/admin/audit", {
        limit: LIMIT,
        cursor: pageParam,
        tableName: tableName || undefined,
        rowKey: rowKey || undefined,
        adminId: adminId || undefined,
      }),
    // Nhật ký phân trang bằng con trỏ (logId giảm dần), không phải offset: dòng
    // mới ghi vào liên tục nên offset sẽ trượt và lặp dòng giữa các trang.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  };

  const rows: AuditRow[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  const filtering = Boolean(tableName || rowKey || adminId);

  return (
    <>
      <PageHeader
        title="Nhật ký thao tác"
        description="Mọi thay đổi do trang quản trị tạo ra, kèm bản chụp trước và sau."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter({ tableName: tableDraft.trim(), rowKey: rowDraft.trim() });
            }}
          >
            <Input
              className="w-56 font-mono text-xs"
              placeholder="Bảng, ví dụ content.item"
              value={tableDraft}
              onChange={(event) => setTableDraft(event.target.value)}
            />
            <Input
              className="w-48 font-mono text-xs"
              placeholder="Khoá dòng"
              value={rowDraft}
              onChange={(event) => setRowDraft(event.target.value)}
            />
            <Button type="submit" variant="secondary">
              Lọc
            </Button>
          </form>

          {can("publisher") && (
            <Select
              className="w-56"
              value={adminId}
              onChange={(event) => setFilter({ adminId: event.target.value })}
            >
              <option value="">Mọi người thao tác</option>
              {(admins.data ?? []).map((admin) => (
                <option key={admin.adminId} value={admin.adminId}>
                  {admin.displayName || admin.email}
                </option>
              ))}
            </Select>
          )}

          {filtering && (
            <Button
              variant="ghost"
              onClick={() => {
                setTableDraft("");
                setRowDraft("");
                setFilter({ tableName: "", rowKey: "", adminId: "" });
              }}
            >
              Xoá bộ lọc
            </Button>
          )}
        </div>

        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState message="Chưa có dòng nhật ký nào khớp bộ lọc." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Thời điểm</Th>
                  <Th>Người thao tác</Th>
                  <Th>Hành động</Th>
                  <Th>Bảng</Th>
                  <Th>Dòng</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.logId}>
                    <tr className="hover:bg-ink-50">
                      <Td className="whitespace-nowrap">{formatDateTime(row.actedAt)}</Td>
                      <Td>
                        <span className="block text-ink-900">{row.adminName || row.adminEmail}</span>
                        <span className="block text-xs text-ink-500">{row.adminEmail}</span>
                      </Td>
                      <Td>
                        <Badge tone={ACTION_TONE[row.action] ?? "neutral"}>
                          {labelOf(AUDIT_ACTION, row.action)}
                        </Badge>
                      </Td>
                      <Td className="font-mono text-xs">{row.tableName}</Td>
                      <Td className="font-mono text-xs">{row.rowKey}</Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => setExpanded(expanded === row.logId ? null : row.logId)}
                        >
                          {expanded === row.logId ? "Ẩn" : "Chi tiết"}
                        </Button>
                      </Td>
                    </tr>

                    {expanded === row.logId && (
                      <tr>
                        <Td className="bg-ink-50" />
                        <td className="border-b border-ink-100 bg-ink-50 px-4 py-3" colSpan={5}>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                                Trước
                              </p>
                              <JsonBlock value={row.before} />
                            </div>
                            <div>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                                Sau
                              </p>
                              <JsonBlock value={row.after} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>

            <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-sm text-ink-600">
              <span>Đang hiện {rows.length} dòng</span>
              <Button
                variant="secondary"
                disabled={!query.hasNextPage}
                loading={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                {query.hasNextPage ? "Tải thêm" : "Hết nhật ký"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
