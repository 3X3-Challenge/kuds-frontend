import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useToast } from "../lib/toast";
import type { ListResponse, PlayerRow, SendMailResponse } from "../lib/types";
import { FieldRenderer } from "../components/FormFields";
import { ConfirmDialog } from "../components/Modal";
import {
  Badge,
  Button,
  Card,
  FieldShell,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from "../components/ui";

interface Recipient {
  playerId: string;
  label: string;
}

/**
 * Thư GM.
 *
 * Phần thưởng KHÔNG gõ tay được — phải trỏ tới một gói thưởng có sẵn, vì backend
 * chụp lại nội dung gói ngay lúc gửi và lưu kèm nguồn gốc để đối soát về sau.
 * Muốn combo mới thì tạo gói ở trang Gói thưởng trước.
 */
export function MailPage() {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [recipients, setRecipients] = useState<Recipient[]>(() => {
    const playerId = searchParams.get("playerId");
    if (!playerId) return [];
    return [{ playerId, label: searchParams.get("playerName") || playerId }];
  });

  const [broadcast, setBroadcast] = useState(false);
  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("Ban Quản Trị");
  const [body, setBody] = useState("");
  const [bundleKey, setBundleKey] = useState<unknown>(null);
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const players = useQuery({
    queryKey: ["players", "mail-picker", searchTerm],
    queryFn: () =>
      api.get<ListResponse<PlayerRow>>("/admin/players", { limit: 20, q: searchTerm || undefined }),
    enabled: searchTerm.length > 0,
  });

  const send = useMutation({
    mutationFn: () =>
      api.post<SendMailResponse>("/admin/players/mail", {
        playerIds: broadcast ? [] : recipients.map((r) => r.playerId),
        broadcast,
        title: title.trim(),
        sender: sender.trim(),
        body,
        bundleKey: bundleKey || null,
        expiresInDays: expiresInDays === "" ? null : Number(expiresInDays),
      }),
    onSuccess: (result) => {
      const skipped =
        result.requestedCount === null ? 0 : result.requestedCount - result.sentCount;
      toast.success(
        skipped > 0
          ? `Đã gửi ${result.sentCount} thư. ${skipped} người bị bỏ qua vì hòm thư đã đầy.`
          : `Đã gửi ${result.sentCount} thư.`,
      );
      setConfirming(false);
      setConfirmText("");
      setTitle("");
      setBody("");
      setBundleKey(null);
      setRecipients([]);
      setBroadcast(false);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Không gửi được");
      setConfirming(false);
      setConfirmText("");
    },
  });

  const fieldErrors = send.error instanceof ApiError ? send.error.fieldErrors : {};
  const hasTarget = broadcast || recipients.length > 0;
  const canSend = hasTarget && title.trim().length > 0 && !send.isPending;
  const confirmPhrase = "GUI TOAN SERVER";

  const addRecipient = (player: PlayerRow) => {
    setRecipients((prev) =>
      prev.some((r) => r.playerId === player.playerId)
        ? prev
        : [...prev, { playerId: player.playerId, label: `${player.displayName} (${player.uid})` }],
    );
  };

  return (
    <>
      <PageHeader
        title="Gửi thư GM"
        description="Thư gửi tay tới người chơi. Phần thưởng phải trỏ tới một gói thưởng có sẵn."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Nội dung thư">
            <div className="space-y-4 px-5 py-4">
              <FieldShell label="Tiêu đề" required error={fieldErrors.title}>
                <Input
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="[Thư cá nhân] Quà xin lỗi vì sự cố máy chủ"
                />
              </FieldShell>

              <FieldShell label="Người gửi" error={fieldErrors.sender}>
                <Input
                  maxLength={128}
                  value={sender}
                  onChange={(event) => setSender(event.target.value)}
                />
              </FieldShell>

              <FieldShell
                label="Nội dung"
                hint="Dùng token {player_name} để chèn tên người chơi."
                error={fieldErrors.body}
              >
                <Textarea
                  rows={8}
                  maxLength={4000}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </FieldShell>

              <FieldRenderer
                spec={{
                  kind: "ref",
                  name: "bundleKey",
                  label: "Gói thưởng đính kèm",
                  resource: "reward-bundles",
                  valueField: "bundleKey",
                  nullable: true,
                  hint: "Để trống = thư thông báo thuần, không có gì để nhận.",
                }}
                value={bundleKey}
                error={fieldErrors.bundleKey}
                onChange={setBundleKey}
              />

              <FieldShell
                label="Số ngày thư sống"
                hint="Để trống = thư không hết hạn."
                error={fieldErrors.expiresInDays}
              >
                <Input
                  type="number"
                  min={1}
                  max={365}
                  className="w-40"
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(event.target.value)}
                />
              </FieldShell>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Người nhận" description={broadcast ? "Toàn bộ máy chủ" : `${recipients.length} người chơi`}>
            <div className="space-y-4 px-5 py-4">
              <div className="flex gap-2">
                <Button
                  variant={broadcast ? "secondary" : "primary"}
                  onClick={() => setBroadcast(false)}
                >
                  Chọn người chơi
                </Button>
                <Button
                  variant={broadcast ? "danger" : "secondary"}
                  onClick={() => setBroadcast(true)}
                >
                  Toàn server
                </Button>
              </div>

              {broadcast ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  Thư sẽ tới TẤT CẢ người chơi và không có nút hoàn tác. Danh sách chọn tay bị bỏ
                  qua khi bật chế độ này.
                </p>
              ) : (
                <>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setSearchTerm(search.trim());
                    }}
                  >
                    <Input
                      type="search"
                      placeholder="UID hoặc tên hiển thị…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <Button type="submit" variant="secondary">
                      Tìm
                    </Button>
                  </form>

                  {players.isFetching && (
                    <p className="flex items-center gap-2 text-sm text-ink-500">
                      <Spinner className="h-4 w-4" /> Đang tìm…
                    </p>
                  )}

                  {players.data && players.data.items.length > 0 && (
                    <ul className="max-h-56 divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-200">
                      {players.data.items.map((player) => (
                        <li key={player.playerId}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-ink-50"
                            onClick={() => addRecipient(player)}
                          >
                            <span>{player.displayName}</span>
                            <span className="font-mono text-xs text-ink-500">{player.uid}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {players.data && players.data.items.length === 0 && (
                    <p className="text-sm text-ink-500">Không tìm thấy ai khớp.</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {recipients.map((recipient) => (
                      <button
                        key={recipient.playerId}
                        type="button"
                        title="Bỏ khỏi danh sách"
                        onClick={() =>
                          setRecipients((prev) =>
                            prev.filter((r) => r.playerId !== recipient.playerId),
                          )
                        }
                      >
                        <Badge tone="info">{recipient.label} ✕</Badge>
                      </button>
                    ))}
                  </div>

                  {recipients.length > 500 && (
                    <p className="text-sm text-red-700">Tối đa 500 người mỗi lần gửi.</p>
                  )}

                  {fieldErrors.playerIds && (
                    <p className="text-sm text-red-700">{fieldErrors.playerIds}</p>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-ink-100 px-5 py-4">
              <Button
                variant="primary"
                className="w-full"
                disabled={!canSend}
                loading={send.isPending}
                onClick={() => setConfirming(true)}
              >
                Gửi thư
              </Button>
              {!hasTarget && (
                <p className="mt-2 text-xs text-ink-500">
                  Chọn ít nhất một người chơi, hoặc bật chế độ toàn server.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        danger={broadcast}
        loading={send.isPending}
        confirmDisabled={broadcast && confirmText.trim().toUpperCase() !== confirmPhrase}
        title={broadcast ? "Gửi thư cho TOÀN BỘ máy chủ?" : `Gửi thư cho ${recipients.length} người chơi?`}
        confirmLabel="Gửi"
        onCancel={() => {
          setConfirming(false);
          setConfirmText("");
        }}
        onConfirm={() => send.mutate()}
        message={
          broadcast ? (
            <>
              <p>
                Mọi người chơi sẽ nhận thư <strong>{title}</strong>
                {bundleKey ? (
                  <>
                    {" "}
                    kèm gói thưởng <strong>{String(bundleKey)}</strong>
                  </>
                ) : (
                  " (không có phần thưởng)"
                )}
                . Không có nút hoàn tác.
              </p>
              <p>
                Gõ <code className="rounded bg-ink-100 px-1 font-mono">{confirmPhrase}</code> để mở
                nút gửi.
              </p>
            </>
          ) : (
            <p>
              Thư <strong>{title}</strong>
              {bundleKey ? (
                <>
                  {" "}
                  kèm gói <strong>{String(bundleKey)}</strong>
                </>
              ) : (
                " (không có phần thưởng)"
              )}{" "}
              sẽ được gửi ngay. Người có hòm thư đầy sẽ bị bỏ qua.
            </p>
          )
        }
      >
        {broadcast && (
          <Input
            autoFocus
            placeholder={confirmPhrase}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
          />
        )}
      </ConfirmDialog>
    </>
  );
}
