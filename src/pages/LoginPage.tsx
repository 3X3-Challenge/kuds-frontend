import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { Button, FieldShell, Input, Loading } from "../components/ui";

export function LoginPage() {
  const { admin, loading, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading label="Đang kiểm tra phiên đăng nhập…" />;
  if (admin) return <Navigate to={from} replace />;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không kết nối được tới máy chủ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-maroon-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-amber-brand">KÝ ỨC DI SẢN</h1>
          <p className="mt-1 text-sm text-cream/70">Bảng điều khiển quản trị</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-ink-200 bg-white p-6 shadow-xl"
        >
          <FieldShell label="Email" required>
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FieldShell>

          <FieldShell label="Mật khẩu" required>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FieldShell>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full" loading={submitting}>
            Đăng nhập
          </Button>

          <p className="text-center text-xs text-ink-500">
            Phiên quản trị sống 8 tiếng và không tự gia hạn — hết hạn thì đăng nhập lại.
          </p>
        </form>
      </div>
    </div>
  );
}
