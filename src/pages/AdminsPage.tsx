import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { ADMIN_ROLE, ADMIN_ROLE_HINT, ADMIN_ROLE_OPTIONS, labelOf } from "../lib/labels";
import { formatDateTime } from "../lib/format";
import type { AdminRole, AdminUser } from "../lib/types";
import { Modal } from "../components/Modal";
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
  Select,
  Table,
  Td,
  Th,
} from "../components/ui";

export function AdminsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { admin: me } = useAuth();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const query = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.get<AdminUser[]>("/admin/admins"),
  });

  const done = (message: string) => {
    toast.success(message);
    setCreating(false);
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["admins"] });
  };

  const onError = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : "Không thực hiện được");

  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<AdminUser>("/admin/admins", input),
    onSuccess: () => done("Đã tạo tài khoản quản trị."),
    onError,
  });

  const update = useMutation({
    mutationFn: ({ adminId, input }: { adminId: string; input: Record<string, unknown> }) =>
      api.patch<AdminUser>(`/admin/admins/${adminId}`, input),
    onSuccess: () => done("Đã cập nhật tài khoản."),
    onError,
  });

  if (query.isPending) return <Loading />;
  if (query.error) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }

  const activePublishers = query.data.filter(
    (admin) => admin.role === "publisher" && admin.isActive,
  ).length;

  return (
    <>
      <PageHeader
        title="Tài khoản quản trị"
        description="Ba mức quyền: người xem ⊂ biên tập viên ⊂ người xuất bản."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Tạo tài khoản
          </Button>
        }
      />

      {activePublishers <= 1 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ còn <strong>một</strong> người xuất bản đang hoạt động. Backend sẽ chặn hạ quyền hoặc
          vô hiệu hoá tài khoản đó — tạo thêm một người xuất bản nữa trước khi đổi.
        </p>
      )}

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Tên hiển thị</Th>
              <Th>Quyền</Th>
              <Th>Trạng thái</Th>
              <Th>Đăng nhập lần cuối</Th>
              <Th>Tạo lúc</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {query.data.map((admin) => (
              <tr key={admin.adminId} className="hover:bg-ink-50">
                <Td>
                  {admin.email}
                  {admin.adminId === me?.adminId && (
                    <span className="ml-2 text-xs text-ink-500">(bạn)</span>
                  )}
                </Td>
                <Td>{admin.displayName || "—"}</Td>
                <Td>
                  <Badge tone={admin.role === "publisher" ? "success" : "info"}>
                    {labelOf(ADMIN_ROLE, admin.role)}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={admin.isActive ? "success" : "neutral"}>
                    {admin.isActive ? "Đang hoạt động" : "Đã vô hiệu hoá"}
                  </Badge>
                </Td>
                <Td>{formatDateTime(admin.lastLoginAt)}</Td>
                <Td>{formatDateTime(admin.createdAt)}</Td>
                <Td className="text-right">
                  <Button variant="ghost" onClick={() => setEditing(admin)}>
                    Sửa
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <CreateAdminModal
        open={creating}
        loading={create.isPending}
        fieldErrors={create.error instanceof ApiError ? create.error.fieldErrors : {}}
        onCancel={() => setCreating(false)}
        onSubmit={(input) => create.mutate(input)}
      />

      <EditAdminModal
        admin={editing}
        isSelf={editing?.adminId === me?.adminId}
        loading={update.isPending}
        fieldErrors={update.error instanceof ApiError ? update.error.fieldErrors : {}}
        onCancel={() => setEditing(null)}
        onSubmit={(input) => editing && update.mutate({ adminId: editing.adminId, input })}
      />
    </>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: AdminRole;
  onChange: (role: AdminRole) => void;
}) {
  return (
    <FieldShell label="Quyền" required hint={ADMIN_ROLE_HINT[value]}>
      <Select value={value} onChange={(event) => onChange(event.target.value as AdminRole)}>
        {ADMIN_ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

function CreateAdminModal({
  open,
  loading,
  fieldErrors,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  fieldErrors: Record<string, string>;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");

  const valid = email.includes("@") && password.length >= 10;

  return (
    <Modal
      open={open}
      title="Tạo tài khoản quản trị"
      description="Mật khẩu tối thiểu 10 ký tự. Không có luồng gửi email — đưa mật khẩu cho người dùng qua kênh khác."
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!valid}
            onClick={() => onSubmit({ email: email.trim(), displayName: displayName.trim(), password, role })}
          >
            Tạo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldShell label="Email" required error={fieldErrors.email}>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </FieldShell>

        <FieldShell label="Tên hiển thị" error={fieldErrors.displayName}>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </FieldShell>

        <FieldShell label="Mật khẩu" required error={fieldErrors.password} hint="Tối thiểu 10 ký tự.">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FieldShell>

        <RoleSelect value={role} onChange={setRole} />
      </div>
    </Modal>
  );
}

function EditAdminModal({
  admin,
  isSelf,
  loading,
  fieldErrors,
  onCancel,
  onSubmit,
}: {
  admin: AdminUser | null;
  isSelf: boolean;
  loading: boolean;
  fieldErrors: Record<string, string>;
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AdminRole>("viewer");
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Nạp giá trị của tài khoản đang mở, một lần cho mỗi lần mở hộp thoại.
  if (admin && loadedFor !== admin.adminId) {
    setLoadedFor(admin.adminId);
    setDisplayName(admin.displayName);
    setRole(admin.role);
    setIsActive(admin.isActive);
    setPassword("");
  }

  if (!admin) return null;

  const changed: Record<string, unknown> = {};
  if (displayName !== admin.displayName) changed.displayName = displayName.trim();
  if (role !== admin.role) changed.role = role;
  if (isActive !== admin.isActive) changed.isActive = isActive;
  if (password) changed.password = password;

  const passwordTooShort = password.length > 0 && password.length < 10;
  const nothingChanged = Object.keys(changed).length === 0;

  return (
    <Modal
      open
      title={`Sửa ${admin.email}`}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={nothingChanged || passwordTooShort}
            onClick={() => onSubmit(changed)}
          >
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldShell label="Tên hiển thị" error={fieldErrors.displayName}>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </FieldShell>

        <RoleSelect value={role} onChange={setRole} />

        <Checkbox
          checked={isActive}
          disabled={isSelf}
          onChange={(event) => setIsActive(event.target.checked)}
          label="Tài khoản đang hoạt động"
          hint={
            isSelf
              ? "Không thể tự vô hiệu hoá tài khoản của chính mình."
              : "Vô hiệu hoá chỉ chặn lần ĐĂNG NHẬP sau. Token đã phát vẫn sống tới khi hết hạn (tối đa 8 tiếng)."
          }
        />

        <FieldShell
          label="Mật khẩu mới"
          error={fieldErrors.password ?? (passwordTooShort ? "Tối thiểu 10 ký tự." : undefined)}
          hint="Để trống nếu không đổi."
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FieldShell>
      </div>
    </Modal>
  );
}
