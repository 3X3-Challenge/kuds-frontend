import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { formatDateTime } from "../lib/format";
import type { ConfigState, PreflightResponse, PublishIssue, PublishResponse } from "../lib/types";
import { ConfirmDialog } from "../components/Modal";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  FieldShell,
  Input,
  Loading,
  PageHeader,
  Table,
  Td,
  Th,
} from "../components/ui";

export function PublishPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const state = useQuery({
    queryKey: ["publish-state"],
    queryFn: () => api.get<ConfigState>("/admin/publish/state"),
  });

  const preflight = useQuery({
    queryKey: ["preflight"],
    queryFn: () => api.get<PreflightResponse>("/admin/publish/preflight"),
  });

  const publish = useMutation({
    mutationFn: () => api.post<PublishResponse>("/admin/publish", { force, note: note || undefined }),
    onSuccess: (result) => {
      toast.success(
        result.forced
          ? `Đã xuất bản v${result.version}, bỏ qua ${result.skippedErrorCount} lỗi.`
          : `Đã xuất bản v${result.version}.`,
      );
      setConfirming(false);
      setNote("");
      setForce(false);
      queryClient.invalidateQueries({ queryKey: ["publish-state"] });
      queryClient.invalidateQueries({ queryKey: ["preflight"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Không xuất bản được");
      setConfirming(false);
    },
  });

  if (state.isPending || preflight.isPending) return <Loading />;
  if (state.error) {
    return <ErrorState message={(state.error as Error).message} onRetry={() => state.refetch()} />;
  }
  if (preflight.error) {
    return (
      <ErrorState message={(preflight.error as Error).message} onRetry={() => preflight.refetch()} />
    );
  }

  const { errors, warnings, ok } = preflight.data;
  const blocked = !ok && !force;

  return (
    <>
      <PageHeader
        title="Xuất bản"
        description="Tăng phiên bản nội dung để client biết phải tải lại danh mục."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              preflight.refetch();
              state.refetch();
            }}
          >
            Kiểm tra lại
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Trạng thái hiện tại" className="lg:col-span-1">
          <dl className="space-y-4 px-5 py-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Phiên bản</dt>
              <dd className="mt-1 text-3xl font-semibold text-ink-900">v{state.data.version}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Xuất bản lúc</dt>
              <dd className="mt-1 text-sm text-ink-800">{formatDateTime(state.data.publishedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Bởi</dt>
              <dd className="mt-1 text-sm text-ink-800">
                {state.data.publisherName || state.data.publisherEmail || "—"}
              </dd>
            </div>
          </dl>

          <div className="border-t border-ink-100 px-5 py-4 text-xs leading-relaxed text-ink-500">
            Một dòng chuyển sang trạng thái <strong>Đã xuất bản</strong> là ra tới người chơi ngay,
            không đợi nút này. Bấm Xuất bản chỉ báo cho client biết đã đến lúc tải lại danh mục.
          </div>
        </Card>

        <Card
          title="Kiểm tra trước khi xuất bản"
          description="Những chỗ gãy mà khoá ngoại của cơ sở dữ liệu không bắt được."
          className="lg:col-span-2"
          actions={
            <>
              <Badge tone={errors.length > 0 ? "danger" : "success"}>{errors.length} lỗi</Badge>
              <Badge tone={warnings.length > 0 ? "warning" : "neutral"}>
                {warnings.length} cảnh báo
              </Badge>
            </>
          }
        >
          {errors.length === 0 && warnings.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-emerald-800">
              Không tìm thấy vấn đề nào. Nội dung sẵn sàng để xuất bản.
            </p>
          ) : (
            <IssueTable issues={[...errors, ...warnings]} />
          )}
        </Card>
      </div>

      {can("publisher") && (
        <Card title="Xuất bản" className="mt-6">
          <div className="space-y-4 px-5 py-4">
            <FieldShell
              label="Ghi chú"
              hint="Ghi vào nhật ký kèm phiên bản. Sáu tháng sau, đây là thứ trả lời được 'bản này có gì'."
            >
              <Input
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="ví dụ: mở banner Trung Thu, sửa giá gói 99k"
              />
            </FieldShell>

            {errors.length > 0 && (
              <Checkbox
                checked={force}
                onChange={(event) => setForce(event.target.checked)}
                label={`Bỏ qua ${errors.length} lỗi và xuất bản bằng mọi giá`}
                hint="Chỉ dùng khi thật sự cần đẩy gấp một thay đổi khác. Mọi lần dùng đều nằm trong nhật ký, kèm danh sách lỗi đã bỏ qua."
              />
            )}

            <Button
              variant="primary"
              disabled={blocked}
              loading={publish.isPending}
              onClick={() => setConfirming(true)}
            >
              Xuất bản phiên bản v{Number(state.data.version) + 1}
            </Button>

            {blocked && (
              <p className="text-sm text-red-700">
                Còn {errors.length} lỗi chặn xuất bản. Sửa xong rồi kiểm tra lại, hoặc tick ô bỏ
                qua ở trên.
              </p>
            )}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        danger={force}
        loading={publish.isPending}
        title="Xuất bản phiên bản mới?"
        confirmLabel="Xuất bản"
        onCancel={() => setConfirming(false)}
        onConfirm={() => publish.mutate()}
        message={
          force ? (
            <p>
              Sẽ xuất bản <strong>bỏ qua {errors.length} lỗi</strong>. Danh sách lỗi được ghi vào
              nhật ký kèm phiên bản này.
            </p>
          ) : (
            <p>
              Phiên bản tăng lên <strong>v{Number(state.data.version) + 1}</strong>. Client sẽ tải
              lại danh mục ở lần gọi tiếp theo.
            </p>
          )
        }
      />
    </>
  );
}

function IssueTable({ issues }: { issues: PublishIssue[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Mức</Th>
          <Th>Bảng</Th>
          <Th>Dòng</Th>
          <Th>Vấn đề</Th>
        </tr>
      </thead>
      <tbody>
        {issues.map((issue, index) => (
          <tr key={`${issue.code}-${issue.rowKey}-${index}`}>
            <Td>
              <Badge tone={issue.severity === "error" ? "danger" : "warning"}>
                {issue.severity === "error" ? "Lỗi" : "Cảnh báo"}
              </Badge>
            </Td>
            <Td className="font-mono text-xs">{issue.table}</Td>
            <Td className="font-mono text-xs">{issue.rowKey}</Td>
            <Td>
              {issue.message}
              <span className="mt-0.5 block font-mono text-xs text-ink-400">{issue.code}</span>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
