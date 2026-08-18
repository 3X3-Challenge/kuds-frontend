import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { RESOURCE_BY_NAME } from "../resources";
import { defaultValues } from "../resources/form";
import type { FormContext } from "../resources/types";
import type { ContentRow, ListResponse, ResourceType } from "../lib/types";
import { ResourceForm } from "../components/ResourceForm";
import { Card, ErrorState, Loading, PageHeader } from "../components/ui";
import { formatDateTime } from "../lib/format";

export function ContentEditPage({ mode }: { mode: "create" | "edit" }) {
  const { resource = "", id = "" } = useParams();
  const spec = RESOURCE_BY_NAME.get(resource);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const row = useQuery({
    queryKey: ["content", resource, "row", id],
    queryFn: () => api.get<ContentRow>(`/admin/content/${resource}/${id}`),
    enabled: Boolean(spec) && mode === "edit",
  });

  /**
   * quest / achievement / mail_template chỉ trả về `bundleId`, còn biểu mẫu ghi
   * bằng `bundleKey`. Bảng gói thưởng nhỏ nên tải cả về rồi tra ngược tại chỗ.
   */
  const bundles = useQuery({
    queryKey: ["content", "reward-bundles", "lookup"],
    queryFn: () =>
      api.get<ListResponse<ContentRow>>("/admin/content/reward-bundles", { limit: 200 }),
    enabled: Boolean(spec?.needsBundleLookup),
    staleTime: 60_000,
  });

  /** Tên bảng thật (content.item…) để mở đúng nhật ký của dòng này. */
  const resourceTypes = useQuery({
    queryKey: ["content-types"],
    queryFn: () => api.get<ResourceType[]>("/admin/content"),
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      mode === "create"
        ? api.post<ContentRow>(`/admin/content/${resource}`, payload)
        : api.patch<ContentRow>(`/admin/content/${resource}/${id}`, payload),
    onSuccess: (saved) => {
      toast.success(mode === "create" ? "Đã tạo xong." : "Đã lưu thay đổi.");
      queryClient.invalidateQueries({ queryKey: ["content", resource] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (mode === "create" && spec) {
        navigate(`/content/${resource}/${String(saved[spec.idField])}`, { replace: true });
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Không lưu được");
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

  if (mode === "edit" && (row.isPending || (spec.needsBundleLookup && bundles.isPending))) {
    return <Loading />;
  }
  if (mode === "edit" && row.error) {
    return <ErrorState message={(row.error as Error).message} onRetry={() => row.refetch()} />;
  }

  const ctx: FormContext = {
    bundleKeyById: new Map(
      (bundles.data?.items ?? []).map((bundle) => [
        String(bundle.bundleId),
        String(bundle.bundleKey),
      ]),
    ),
  };

  const base = defaultValues(spec.fields);
  const current = row.data;

  const initialValues =
    mode === "create" || !current
      ? base
      : {
          ...base,
          // Không có toForm riêng thì lấy đúng các trường trùng tên; đủ cho những
          // bảng phẳng (npc, codex, pattern…).
          ...(spec.toForm
            ? spec.toForm(current, ctx)
            : Object.fromEntries(
                spec.fields
                  .filter((field) => current[field.name] !== undefined)
                  .map((field) => [field.name, current[field.name]]),
              )),
          // Khoá chính hiện ra để đối chiếu, nhưng bị khoá không sửa được.
          ...Object.fromEntries(
            spec.fields
              .filter((field) => field.createOnly && current[field.name] !== undefined)
              .map((field) => [field.name, current[field.name]]),
          ),
        };

  const table = resourceTypes.data?.find((type) => type.name === resource)?.table;
  const readOnly = !can("editor");

  return (
    <>
      <PageHeader
        title={
          mode === "create"
            ? `Thêm ${spec.label.toLowerCase()}`
            : (current && spec.titleOf?.(current)) || String(current?.[spec.idField] ?? spec.label)
        }
        description={
          mode === "create"
            ? spec.description
            : `${spec.label} · ${spec.idField}: ${String(current?.[spec.idField] ?? "")}`
        }
        actions={
          <>
            <Link
              to={`/content/${resource}`}
              className="rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
            >
              ← Danh sách
            </Link>
            {mode === "edit" && table && (
              <Link
                to={`/audit?tableName=${encodeURIComponent(table)}&rowKey=${encodeURIComponent(id)}`}
                className="rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
              >
                Nhật ký của dòng này
              </Link>
            )}
          </>
        }
      />

      {readOnly && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tài khoản của bạn chỉ có quyền xem. Mọi ô đều mở để đọc, nhưng nút lưu sẽ bị backend từ
          chối.
        </p>
      )}

      {mode === "edit" && current?.updatedAt !== undefined && (
        <p className="mb-4 text-xs text-ink-500">
          Cập nhật lần cuối: {formatDateTime(current.updatedAt)}
        </p>
      )}

      <ResourceForm
        // Khi tạo xong và điều hướng sang trang sửa, React giữ nguyên state cũ
        // của form nếu không đổi key — ép dựng lại theo dòng đang mở.
        key={`${mode}-${id}`}
        fields={spec.fields}
        initialValues={initialValues}
        mode={mode}
        submitting={save.isPending}
        fieldErrors={save.error instanceof ApiError ? save.error.fieldErrors : {}}
        submitLabel={mode === "create" ? "Tạo mới" : "Lưu thay đổi"}
        onSubmit={(payload) => save.mutate(payload)}
        onCancel={() => navigate(`/content/${resource}`)}
        footerNote="Bản ghi mới luôn ở trạng thái bạn chọn — chọn 'Bản nháp' nếu chưa muốn ra tới người chơi."
      />
    </>
  );
}
