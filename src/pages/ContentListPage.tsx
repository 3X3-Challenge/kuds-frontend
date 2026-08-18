import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { PUBLISH_STATUS_OPTIONS } from "../lib/labels";
import { RESOURCE_BY_NAME } from "../resources";
import type { ArchiveResponse, ContentRow, ListResponse } from "../lib/types";
import { ConfirmDialog } from "../components/Modal";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
  Th,
} from "../components/ui";

const LIMIT = 50;

export function ContentListPage() {
  const { resource = "" } = useParams();
  const spec = RESOURCE_BY_NAME.get(resource);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const offset = Number(searchParams.get("offset") ?? 0);

  const [searchDraft, setSearchDraft] = useState(q);
  const [pendingArchive, setPendingArchive] = useState<ContentRow | null>(null);

  const query = useQuery({
    queryKey: ["content", resource, { q, status, offset }],
    queryFn: () =>
      api.get<ListResponse<ContentRow>>(`/admin/content/${resource}`, {
        limit: LIMIT,
        offset,
        q: q || undefined,
        status: status || undefined,
      }),
    enabled: Boolean(spec),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.del<ArchiveResponse>(`/admin/content/${resource}/${id}`),
    onSuccess: (result) => {
      toast.success(result.deleted ? "Đã xoá khỏi cơ sở dữ liệu." : "Đã chuyển sang trạng thái lưu trữ.");
      setPendingArchive(null);
      queryClient.invalidateQueries({ queryKey: ["content", resource] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Không thực hiện được");
      setPendingArchive(null);
    },
  });

  if (!spec) {
    return (
      <>
        <PageHeader title="Không có loại nội dung này" />
        <Card>
          <p className="px-5 py-6 text-sm text-ink-600">
            Đường dẫn <code className="font-mono">{resource}</code> không khớp bảng danh mục nào.
          </p>
        </Card>
      </>
    );
  }

  /** Đổi bộ lọc thì luôn nhảy về trang đầu — trang 7 của kết quả cũ vô nghĩa. */
  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("offset");
    setSearchParams(next);
  };

  const idOf = (row: ContentRow) => String(row[spec.idField]);

  return (
    <>
      <PageHeader
        title={spec.label}
        description={spec.description}
        actions={
          can("editor") && (
            <Link
              to={`/content/${resource}/new`}
              className="rounded-lg bg-maroon-800 px-3.5 py-2 text-sm font-medium text-cream hover:bg-maroon-700"
            >
              + Thêm mới
            </Link>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3">
          {spec.searchable && (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setFilter({ q: searchDraft.trim() });
              }}
            >
              <Input
                type="search"
                className="w-64"
                placeholder={spec.searchPlaceholder ?? "Tìm kiếm…"}
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
              <Button type="submit" variant="secondary">
                Tìm
              </Button>
            </form>
          )}

          {spec.hasStatus && (
            <Select
              className="w-48"
              value={status}
              onChange={(event) => setFilter({ status: event.target.value })}
            >
              <option value="">Mọi trạng thái</option>
              {PUBLISH_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}

          {(q || status) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearchDraft("");
                setFilter({ q: "", status: "" });
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
        ) : query.data.items.length === 0 ? (
          <EmptyState
            message={q || status ? "Không có dòng nào khớp bộ lọc." : "Bảng này chưa có dữ liệu."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  {spec.columns.map((column) => (
                    <Th key={column.key}>{column.label}</Th>
                  ))}
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr
                    key={idOf(row)}
                    className="cursor-pointer hover:bg-ink-50"
                    onClick={() => navigate(`/content/${resource}/${idOf(row)}`)}
                  >
                    {spec.columns.map((column) => (
                      <Td key={column.key} className={column.className}>
                        {column.render ? column.render(row) : String(row[column.key] ?? "—")}
                      </Td>
                    ))}
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/content/${resource}/${idOf(row)}`);
                        }}
                      >
                        {can("editor") ? "Sửa" : "Xem"}
                      </Button>
                      {can("editor") && (
                        <Button
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingArchive(row);
                          }}
                        >
                          {spec.hasStatus ? "Lưu trữ" : "Xoá"}
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Pagination
              total={query.data.total}
              limit={query.data.limit}
              offset={query.data.offset}
              onChange={(next) => {
                const params = new URLSearchParams(searchParams);
                params.set("offset", String(next));
                setSearchParams(params);
              }}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={pendingArchive !== null}
        danger
        loading={archive.isPending}
        title={spec.hasStatus ? "Chuyển sang lưu trữ?" : "Xoá hẳn dòng này?"}
        confirmLabel={spec.hasStatus ? "Lưu trữ" : "Xoá"}
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => pendingArchive && archive.mutate(idOf(pendingArchive))}
        message={
          spec.hasStatus ? (
            <>
              <p>
                <strong>{pendingArchive ? (spec.titleOf?.(pendingArchive) ?? idOf(pendingArchive)) : ""}</strong>{" "}
                sẽ chuyển sang trạng thái <em>Lưu trữ</em> và biến mất khỏi game, nhưng vẫn hiển thị
                được cho những người chơi đang giữ nó.
              </p>
              <p>Có thể chuyển ngược lại thành bản nháp bất cứ lúc nào.</p>
            </>
          ) : (
            <p>
              Bảng này không có trạng thái xuất bản nên dòng sẽ bị <strong>xoá thật</strong>. Nếu
              đang có dữ liệu khác trỏ tới, cơ sở dữ liệu sẽ từ chối.
            </p>
          )
        }
      />
    </>
  );
}
