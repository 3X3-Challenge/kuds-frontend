import { useState } from "react";
import type { FieldSpec } from "../resources/types";
import { changedValues, stripUnsetNulls } from "../resources/form";
import { Button, Card } from "./ui";
import { FieldRenderer } from "./FormFields";

/**
 * Biểu mẫu chung cho mọi bảng danh mục.
 *
 * `mode` quyết định hai chuyện: khoá chính có sửa được không, và gửi cả biểu mẫu
 * (tạo) hay chỉ phần đã đổi (sửa — xem ghi chú ở resources/form.ts).
 */
export function ResourceForm({
  fields,
  initialValues,
  mode,
  submitting,
  fieldErrors,
  submitLabel,
  onSubmit,
  onCancel,
  footerNote,
}: {
  fields: FieldSpec[];
  initialValues: Record<string, unknown>;
  mode: "create" | "edit";
  submitting: boolean;
  fieldErrors: Record<string, string>;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
  footerNote?: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);

  const changed = changedValues(initialValues, values);
  const changedCount = Object.keys(changed).length;
  const nothingToSave = mode === "edit" && changedCount === 0;

  const setValue = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(mode === "create" ? stripUnsetNulls(values, fields) : changed);
      }}
    >
      <Card>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.name}
              className={field.full || field.kind === "list" ? "sm:col-span-2" : undefined}
            >
              <FieldRenderer
                spec={field}
                value={values[field.name] ?? null}
                error={fieldErrors[field.name]}
                disabled={submitting || (mode === "edit" && field.createOnly)}
                onChange={(value) => setValue(field.name, value)}
              />
            </div>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-4">
          <span className="text-xs text-ink-500">
            {mode === "edit"
              ? changedCount === 0
                ? "Chưa có thay đổi nào."
                : `${changedCount} trường sẽ được gửi đi.`
              : (footerNote ?? "")}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
              Huỷ
            </Button>
            <Button type="submit" variant="primary" loading={submitting} disabled={nothingToSave}>
              {submitLabel}
            </Button>
          </div>
        </footer>
      </Card>
    </form>
  );
}
