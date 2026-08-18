import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatDuration, fromDateTimeLocal, toDateTimeLocal } from "../lib/format";
import type { ListResponse, ContentRow } from "../lib/types";
import type { FieldSpec, GroupField, JsonField, ListField, RefField } from "../resources/types";
import { Button, Checkbox, FieldShell, Input, Select, Textarea } from "./ui";

/**
 * Bộ vẽ biểu mẫu theo khai báo. Nhận một FieldSpec (resources/types.ts) và trả
 * về ô nhập tương ứng; không biết gì về bảng nào đang được sửa.
 *
 * Giá trị luôn ở dạng SẼ GỬI LÊN API: số là number, thời điểm là chuỗi ISO,
 * JSON là object đã parse. Chỉ có ô nhập giữ chuỗi thô ở state riêng của nó.
 */

interface FieldProps {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function FieldRenderer(props: FieldProps) {
  const { spec } = props;
  switch (spec.kind) {
    case "list":
      return <ListInput {...props} spec={spec} />;
    case "group":
      return <GroupInput {...props} spec={spec} />;
    case "json":
      return <JsonInput {...props} spec={spec} />;
    case "ref":
      return <RefInput {...props} spec={spec} />;
    case "boolean":
      return (
        <Checkbox
          checked={Boolean(props.value)}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.checked)}
          label={spec.label}
          hint={props.error ?? spec.hint}
        />
      );
    default:
      return <ScalarInput {...props} />;
  }
}

// --- Ô nhập cơ bản ----------------------------------------------------------

function ScalarInput({ spec, value, onChange, error, disabled }: FieldProps) {
  const hint =
    spec.kind === "number" && spec.asDuration && value !== null && value !== ""
      ? `${spec.hint ? `${spec.hint} · ` : ""}≈ ${formatDuration(value)}`
      : spec.hint;

  return (
    <FieldShell label={spec.label} hint={hint} error={error} required={spec.required}>
      {spec.kind === "textarea" && (
        <Textarea
          rows={spec.rows ?? 4}
          maxLength={spec.maxLength}
          disabled={disabled}
          invalid={Boolean(error)}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(spec.nullable && event.target.value === "" ? null : event.target.value)}
        />
      )}

      {spec.kind === "text" && (
        <Input
          type="text"
          maxLength={spec.maxLength}
          placeholder={spec.placeholder}
          disabled={disabled}
          invalid={Boolean(error)}
          className={spec.keyFormat ? "font-mono" : undefined}
          value={(value as string) ?? ""}
          onChange={(event) => {
            // Khoá kỹ thuật: backend chỉ nhận [a-z0-9_], nên chặn ngay lúc gõ
            // thay vì để người ta điền xong cả biểu mẫu rồi mới báo lỗi.
            const raw = spec.keyFormat
              ? event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")
              : event.target.value;
            onChange(spec.nullable && raw === "" ? null : raw);
          }}
        />
      )}

      {spec.kind === "number" && (
        <Input
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          disabled={disabled}
          invalid={Boolean(error)}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
        />
      )}

      {spec.kind === "select" && (
        <Select
          disabled={disabled}
          invalid={Boolean(error)}
          value={(value as string) ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        >
          {spec.nullable && <option value="">{spec.nullLabel ?? "— Không chọn —"}</option>}
          {spec.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}

      {spec.kind === "datetime" && (
        <Input
          type="datetime-local"
          disabled={disabled}
          invalid={Boolean(error)}
          value={toDateTimeLocal(value)}
          onChange={(event) => onChange(fromDateTimeLocal(event.target.value))}
        />
      )}
    </FieldShell>
  );
}

// --- Trỏ tới bảng khác ------------------------------------------------------

/**
 * Danh sách gợi ý cho ô khoá ngoại. Mười hai bảng danh mục đều nhỏ (vài chục
 * tới vài trăm dòng), nên tải 200 dòng đầu một lần rồi lọc tại chỗ đơn giản và
 * đủ nhanh hơn hẳn một ô tìm kiếm gọi API theo từng phím.
 */
function useRefOptions(spec: RefField) {
  return useQuery({
    queryKey: ["content", spec.resource, "ref-options"],
    queryFn: () => api.get<ListResponse<ContentRow>>(`/admin/content/${spec.resource}`, { limit: 200 }),
    staleTime: 60_000,
  });
}

function RefInput({ spec, value, onChange, error, disabled }: FieldProps & { spec: RefField }) {
  const { data, isPending } = useRefOptions(spec);
  const listId = `ref-${spec.resource}-${spec.name}`;

  const options = (data?.items ?? []).map((row) => ({
    value: String(row[spec.valueField] ?? ""),
    label: spec.labelField ? String(row[spec.labelField] ?? "") : "",
  }));

  const current = String(value ?? "");
  const match = options.find((option) => option.value === current);
  const unknownKey = current !== "" && !isPending && !match;

  return (
    <FieldShell
      label={spec.label}
      required={spec.required}
      error={error}
      hint={
        unknownKey
          ? `Không thấy "${current}" trong danh sách — kiểm tra lại khoá.`
          : match?.label
            ? `${match.label}${spec.hint ? ` · ${spec.hint}` : ""}`
            : spec.hint
      }
    >
      <Input
        type="text"
        list={listId}
        disabled={disabled}
        invalid={Boolean(error) || unknownKey}
        className="font-mono"
        placeholder={isPending ? "Đang tải gợi ý…" : "Gõ hoặc chọn khoá…"}
        value={current}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </FieldShell>
  );
}

// --- JSON -------------------------------------------------------------------

/**
 * Ô JSON giữ chuỗi thô ở state riêng: gõ dở một object thì chuỗi chưa parse
 * được, và đẩy giá trị hỏng lên biểu mẫu sau mỗi phím sẽ làm mất chỗ đang gõ.
 * Chỉ khi parse thành công mới báo lên trên.
 */
function JsonInput({ spec, value, onChange, error, disabled }: FieldProps & { spec: JsonField }) {
  const [text, setText] = useState(() =>
    value === null || value === undefined ? "" : JSON.stringify(value, null, 2),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  return (
    <FieldShell
      label={spec.label}
      hint={spec.hint}
      error={parseError ?? error}
      required={spec.required}
    >
      <Textarea
        rows={spec.rows ?? 5}
        disabled={disabled}
        invalid={Boolean(parseError || error)}
        className="font-mono text-xs"
        value={text}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);

          if (raw.trim() === "") {
            setParseError(null);
            onChange(spec.nullable ? null : {});
            return;
          }
          try {
            onChange(JSON.parse(raw));
            setParseError(null);
          } catch {
            setParseError("JSON không hợp lệ — chưa lưu được thay đổi của ô này.");
          }
        }}
      />
    </FieldShell>
  );
}

// --- Cụm bật/tắt ------------------------------------------------------------

function GroupInput({ spec, value, onChange, disabled }: FieldProps & { spec: GroupField }) {
  const enabled = value !== null && value !== undefined;
  const current = (value ?? {}) as Record<string, unknown>;

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-4">
      <Checkbox
        checked={enabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked ? spec.newValue() : null)}
        label={spec.enableLabel}
        hint={spec.hint}
      />
      {enabled && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {spec.fields.map((child) => (
            <div key={child.name} className={child.full ? "sm:col-span-2" : undefined}>
              <FieldRenderer
                spec={child}
                disabled={disabled}
                value={current[child.name] ?? child.default ?? null}
                onChange={(next) => onChange({ ...current, [child.name]: next })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Danh sách con ----------------------------------------------------------

function ListInput({ spec, value, onChange, error, disabled }: FieldProps & { spec: ListField }) {
  const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  const replace = (index: number, next: Record<string, unknown>) =>
    onChange(list.map((row, i) => (i === index ? next : row)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink-800">
          {spec.label}
          {spec.required && <span className="ml-1 text-maroon-700">*</span>}
          <span className="ml-2 text-xs font-normal text-ink-500">{list.length} dòng</span>
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || (spec.max !== undefined && list.length >= spec.max)}
          onClick={() => onChange([...list, spec.newItem()])}
        >
          + {spec.addLabel}
        </Button>
      </div>

      {error ? (
        <p className="mb-2 text-xs text-red-700">{error}</p>
      ) : (
        spec.hint && <p className="mb-2 text-xs text-ink-500">{spec.hint}</p>
      )}

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
          {spec.emptyLabel}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((row, index) => (
            <li key={index} className="rounded-lg border border-ink-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Dòng {index + 1}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label="Đưa lên trên"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled || index === list.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label="Đưa xuống dưới"
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onChange(list.filter((_, i) => i !== index))}
                    className="text-red-700 hover:bg-red-50"
                  >
                    Xoá
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {spec.fields.map((child) => (
                  <div key={child.name} className={child.full ? "sm:col-span-2" : undefined}>
                    <FieldRenderer
                      spec={child}
                      disabled={disabled}
                      value={row[child.name] ?? child.default ?? null}
                      onChange={(next) => replace(index, { ...row, [child.name]: next })}
                    />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
