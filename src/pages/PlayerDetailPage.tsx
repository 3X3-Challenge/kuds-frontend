import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { ACCOUNT_STATUS, CURRENCY, CURRENCY_SHORT, labelOf } from "../lib/labels";
import { formatDateTime, formatNumber, fromDateTimeLocal } from "../lib/format";
import type {
  AdjustCurrencyResponse,
  BanResponse,
  CurrencyCode,
  GrantItemResponse,
  PlayerDetail,
} from "../lib/types";
import { Modal } from "../components/Modal";
import { FieldRenderer } from "../components/FormFields";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  FieldShell,
  Input,
  JsonBlock,
  Loading,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "../components/ui";

type OpenModal = "ban" | "unban" | "currency" | "item" | null;

export function PlayerDetailPage() {
  const { playerId = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const [modal, setModal] = useState<OpenModal>(null);

  const query = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => api.get<PlayerDetail>(`/admin/players/${playerId}`),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["player", playerId] });
    queryClient.invalidateQueries({ queryKey: ["players"] });
  };

  const onError = (error: unknown) =>
    toast.error(error instanceof ApiError ? error.message : "Không thực hiện được");

  const ban = useMutation({
    mutationFn: (input: { banned: boolean; reason: string; bannedUntil: string | null }) =>
      api.post<BanResponse>(`/admin/players/${playerId}/${input.banned ? "ban" : "unban"}`, {
        reason: input.reason,
        bannedUntil: input.banned ? input.bannedUntil : null,
      }),
    onSuccess: (result) => {
      toast.success(result.status === "banned" ? "Đã cấm tài khoản." : "Đã gỡ cấm.");
      setModal(null);
      refresh();
    },
    onError,
  });

  const currency = useMutation({
    mutationFn: (input: { currency: CurrencyCode; delta: number; reason: string }) =>
      api.post<AdjustCurrencyResponse>(`/admin/players/${playerId}/currency`, input),
    onSuccess: (result) => {
      toast.success(
        `Số dư mới: ${formatNumber(result.balance)} ${labelOf(CURRENCY_SHORT, result.currency)}.`,
      );
      setModal(null);
      refresh();
    },
    onError,
  });

  const grant = useMutation({
    mutationFn: (input: { itemKey: string; quantity: number }) =>
      api.post<GrantItemResponse>(`/admin/players/${playerId}/items`, input),
    onSuccess: (result) => {
      toast.success(`Đã tặng. Người chơi đang có ${formatNumber(result.quantity)} ${result.itemKey}.`);
      setModal(null);
      refresh();
    },
    onError,
  });

  if (query.isPending) return <Loading />;
  if (query.error) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }

  const player = query.data;
  const account = player.account;
  const banned = account.status === "banned";

  return (
    <>
      <PageHeader
        title={player.displayName}
        description={`UID ${player.uid} · ${player.playerId}`}
        actions={
          <>
            <Link
              to="/players"
              className="rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
            >
              ← Danh sách
            </Link>
            {can("publisher") && (
              <>
                <Link
                  to={`/mail?playerId=${player.playerId}&playerName=${encodeURIComponent(player.displayName)}`}
                  className="rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50"
                >
                  Gửi thư
                </Link>
                <Button onClick={() => setModal("currency")}>Cộng/trừ tiền</Button>
                <Button onClick={() => setModal("item")}>Tặng vật phẩm</Button>
                <Button
                  variant={banned ? "secondary" : "danger"}
                  onClick={() => setModal(banned ? "unban" : "ban")}
                >
                  {banned ? "Gỡ cấm" : "Cấm tài khoản"}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Tài khoản" className="lg:col-span-2">
          <dl className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <Detail label="Trạng thái">
              <StatusBadge status={account.status} label={labelOf(ACCOUNT_STATUS, account.status)} />
            </Detail>
            <Detail label="Cấm đến">{formatDateTime(account.bannedUntil)}</Detail>
            <Detail label="Mã tài khoản">
              <span className="font-mono text-xs">{account.accountId}</span>
            </Detail>
            <Detail label="Cấp">{player.level}</Detail>
            <Detail label="Kinh nghiệm">{formatNumber(player.exp)}</Detail>
            <Detail label="Sức chứa hòm thư">{formatNumber(player.mailCapacity)}</Detail>
            <Detail label="Đăng nhập lần cuối">{formatDateTime(account.lastLoginAt)}</Detail>
            <Detail label="Tạo tài khoản">{formatDateTime(account.createdAt)}</Detail>
            <Detail label="Tạo nhân vật">{formatDateTime(player.createdAt)}</Detail>
          </dl>
        </Card>

        <Card title="Ví">
          <ul className="divide-y divide-ink-100">
            {player.wallets.length === 0 && (
              <li className="px-5 py-4 text-sm text-ink-500">Chưa có ví nào.</li>
            )}
            {player.wallets.map((wallet) => (
              <li key={wallet.currency} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-ink-700">{labelOf(CURRENCY, wallet.currency)}</span>
                <span className="font-semibold text-ink-900">{formatNumber(wallet.balance)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Túi đồ (${player.inventory.length})`} className="lg:col-span-2">
          {player.inventory.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Túi trống.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Vật phẩm</Th>
                  <Th className="text-right">Số lượng</Th>
                </tr>
              </thead>
              <tbody>
                {player.inventory.map((entry) => (
                  <tr key={entry.itemKey}>
                    <Td className="font-mono text-xs">{entry.itemKey}</Td>
                    <Td className="text-right">{formatNumber(entry.quantity)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Đang mặc">
          {player.equipment.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Không mặc gì.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {player.equipment.map((entry) => (
                <li key={entry.slot} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-ink-600">{entry.slot}</span>
                  <span className="font-mono text-xs text-ink-900">{entry.itemKey}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Nhiệm vụ (${player.quests.length})`}>
          {player.quests.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Chưa nhận nhiệm vụ nào.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">
              {player.quests.map((quest) => (
                <li key={quest.questKey} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="font-mono text-xs text-ink-800">{quest.questKey}</span>
                  <Badge tone={quest.claimedAt ? "success" : "info"}>{quest.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Thành tựu (${player.achievements.length})`}>
          {player.achievements.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-500">Chưa có tiến độ thành tựu.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">
              {player.achievements.map((achievement) => (
                <li
                  key={achievement.achievementKey}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="font-mono text-xs text-ink-800">
                    {achievement.achievementKey}
                  </span>
                  <span className="text-sm text-ink-600">
                    {formatNumber(achievement.progress)}
                    {achievement.claimedAt && " · đã nhận"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Dữ liệu lưu" description="Bản lưu vị trí và trạng thái thế giới của người chơi.">
          <div className="px-5 py-4">
            <JsonBlock value={player.save} />
          </div>
        </Card>
      </div>

      <BanModal
        open={modal === "ban" || modal === "unban"}
        banned={modal === "ban"}
        loading={ban.isPending}
        playerName={player.displayName}
        onCancel={() => setModal(null)}
        onSubmit={(input) => ban.mutate({ banned: modal === "ban", ...input })}
      />

      <CurrencyModal
        open={modal === "currency"}
        loading={currency.isPending}
        onCancel={() => setModal(null)}
        onSubmit={(input) => currency.mutate(input)}
      />

      <GrantItemModal
        open={modal === "item"}
        loading={grant.isPending}
        onCancel={() => setModal(null)}
        onSubmit={(input) => grant.mutate(input)}
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink-800">{children}</dd>
    </div>
  );
}

// --- Hộp thoại thao tác -----------------------------------------------------

function BanModal({
  open,
  banned,
  loading,
  playerName,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  banned: boolean;
  loading: boolean;
  playerName: string;
  onCancel: () => void;
  onSubmit: (input: { reason: string; bannedUntil: string | null }) => void;
}) {
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");

  return (
    <Modal
      open={open}
      title={banned ? `Cấm ${playerName}?` : `Gỡ cấm ${playerName}?`}
      description={
        banned
          ? "Cấm xong sẽ thu hồi mọi phiên đang đăng nhập của tài khoản này."
          : "Tài khoản trở lại trạng thái hoạt động và hạn cấm bị xoá."
      }
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Huỷ
          </Button>
          <Button
            variant={banned ? "danger" : "primary"}
            loading={loading}
            disabled={reason.trim().length === 0}
            onClick={() => onSubmit({ reason: reason.trim(), bannedUntil: fromDateTimeLocal(until) })}
          >
            {banned ? "Cấm tài khoản" : "Gỡ cấm"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldShell
          label="Lý do"
          required
          hint="Bắt buộc — lý do được ghi vào nhật ký và là thứ duy nhất còn lại khi cần đối chiếu sau này."
        >
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FieldShell>

        {banned && (
          <FieldShell label="Cấm đến" hint="Để trống = cấm vĩnh viễn.">
            <Input
              type="datetime-local"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
            />
          </FieldShell>
        )}
      </div>
    </Modal>
  );
}

function CurrencyModal({
  open,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (input: { currency: CurrencyCode; delta: number; reason: string }) => void;
}) {
  const [code, setCode] = useState<CurrencyCode>("hoa_sen");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const amount = Number(delta);
  const valid = delta !== "" && Number.isInteger(amount) && amount !== 0 && reason.trim().length > 0;

  return (
    <Modal
      open={open}
      title="Cộng / trừ tiền"
      description="Đi qua đúng đường mà game đi, nên vẫn sinh dòng sổ cái với lý do 'gm_dieu_chinh'."
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
            onClick={() => onSubmit({ currency: code, delta: amount, reason: reason.trim() })}
          >
            Thực hiện
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldShell label="Loại tiền" required>
          <Select value={code} onChange={(event) => setCode(event.target.value as CurrencyCode)}>
            {Object.entries(CURRENCY).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FieldShell>

        <FieldShell
          label="Thay đổi"
          required
          hint="Số dương là cộng, số âm là trừ. Không nhận số 0. Trừ quá số dư sẽ bị từ chối."
        >
          <Input
            type="number"
            step={1}
            placeholder="ví dụ: 100 hoặc -50"
            value={delta}
            onChange={(event) => setDelta(event.target.value)}
          />
        </FieldShell>

        <FieldShell label="Lý do" required>
          <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FieldShell>
      </div>
    </Modal>
  );
}

function GrantItemModal({
  open,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (input: { itemKey: string; quantity: number }) => void;
}) {
  const [itemKey, setItemKey] = useState<unknown>(null);
  const [quantity, setQuantity] = useState(1);

  const valid = typeof itemKey === "string" && itemKey.length > 0 && quantity >= 1;

  return (
    <Modal
      open={open}
      title="Tặng vật phẩm"
      description="Cộng thẳng vào túi. Vật phẩm phải tồn tại trong bảng danh mục."
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
            onClick={() => onSubmit({ itemKey: String(itemKey), quantity })}
          >
            Tặng
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FieldRenderer
          spec={{
            kind: "ref",
            name: "itemKey",
            label: "Vật phẩm",
            resource: "items",
            valueField: "itemKey",
            labelField: "displayName",
            required: true,
          }}
          value={itemKey}
          onChange={setItemKey}
        />

        <FieldShell label="Số lượng" required>
          <Input
            type="number"
            min={1}
            max={9999}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </FieldShell>
      </div>
    </Modal>
  );
}
