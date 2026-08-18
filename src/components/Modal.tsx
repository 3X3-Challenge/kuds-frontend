import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "./ui";

/**
 * Hộp thoại đơn giản: overlay + khung trắng, đóng bằng Esc hoặc bấm ra ngoài.
 * Không dùng <dialog> để giữ hành vi giống nhau trên mọi trình duyệt cũ.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 pt-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${width} rounded-xl border border-ink-200 bg-white shadow-xl`}>
        <header className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}

/**
 * Xác nhận cho hành động không hoàn tác được: cấm tài khoản, xuất bản, xoá.
 * `confirmText` bắt gõ đúng một chuỗi trước khi mở nút — dành cho những nút mà
 * bấm nhầm là hỏng thật (gửi thư toàn server, xuất bản bỏ qua lỗi).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Xác nhận",
  danger = false,
  loading = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  /** Khoá nút xác nhận cho tới khi người dùng gõ đúng chuỗi yêu cầu. */
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Huỷ
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink-700">
        <div>{message}</div>
        {children}
      </div>
    </Modal>
  );
}
