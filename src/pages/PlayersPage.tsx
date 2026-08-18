import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ACCOUNT_STATUS, CURRENCY_SHORT, labelOf } from "../lib/labels";
import { formatDateTime, formatNumber } from "../lib/format";
import type { ListResponse, PlayerRow } from "../lib/types";
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
  StatusBadge,
  Table,
  Td,
  Th,
} from "../components/ui";

const LIMIT = 50;

export function PlayersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const offset = Number(searchParams.get("offset") ?? 0);
  const [searchDraft, setSearchDraft] = useState(q);

  const query = useQuery({
    queryKey: ["players", { q, status, offset }],
    queryFn: () =>
      api.get<ListResponse<PlayerRow>>("/admin/players", {
        limit: LIMIT,
        offset,
        q: q || undefined,
        status: status || undefined,
      }),
  });

  const setFilter = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("offset");
    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        title="Người chơi"
        description="Tra cứu tài khoản, xem ví và tiến độ. Mọi thao tác ghi đều cần quyền xuất bản."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-5 py-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter({ q: searchDraft.trim() });
            }}
          >
            <Input
              type="search"
              className="w-72"
              placeholder="UID (12 số) hoặc tên hiển thị…"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
            <Button type="submit" variant="secondary">
              Tìm
            </Button>
          </form>

          <Select
            className="w-48"
            value={status}
            onChange={(event) => setFilter({ status: event.target.value })}
          >
            <option value="">Mọi trạng thái</option>
            {Object.entries(ACCOUNT_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

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
          <EmptyState message="Không tìm thấy người chơi nào khớp bộ lọc." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>UID</Th>
                  <Th>Tên hiển thị</Th>
                  <Th>Cấp</Th>
                  <Th>Ví</Th>
                  <Th>Trạng thái</Th>
                  <Th>Đăng nhập lần cuối</Th>
                  <Th>Tạo lúc</Th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((player) => (
                  <tr
                    key={player.playerId}
                    className="cursor-pointer hover:bg-ink-50"
                    onClick={() => navigate(`/players/${player.playerId}`)}
                  >
                    <Td className="font-mono text-xs">{player.uid}</Td>
                    <Td className="font-medium">{player.displayName}</Td>
                    <Td>{player.level}</Td>
                    <Td>
                      {player.wallets.length === 0
                        ? "—"
                        : player.wallets
                            .map(
                              (wallet) =>
                                `${formatNumber(wallet.balance)} ${labelOf(CURRENCY_SHORT, wallet.currency)}`,
                            )
                            .join(" · ")}
                    </Td>
                    <Td>
                      <StatusBadge
                        status={player.status}
                        label={labelOf(ACCOUNT_STATUS, player.status)}
                      />
                    </Td>
                    <Td>{formatDateTime(player.lastLoginAt)}</Td>
                    <Td>{formatDateTime(player.createdAt)}</Td>
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
    </>
  );
}
