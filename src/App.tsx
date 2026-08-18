import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Layout } from "./components/Layout";
import { Card, Loading, PageHeader } from "./components/ui";
import { useAuth } from "./lib/auth";
import type { AdminRole } from "./lib/types";
import { ADMIN_ROLE } from "./lib/labels";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ContentListPage } from "./pages/ContentListPage";
import { ContentEditPage } from "./pages/ContentEditPage";
import { PlayersPage } from "./pages/PlayersPage";
import { PlayerDetailPage } from "./pages/PlayerDetailPage";
import { MailPage } from "./pages/MailPage";
import { PublishPage } from "./pages/PublishPage";
import { AuditPage } from "./pages/AuditPage";
import { AdminsPage } from "./pages/AdminsPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Đang kiểm tra phiên đăng nhập…" />;
  // Nhớ chỗ đang đứng để sau khi đăng nhập quay lại đúng trang, thay vì luôn về
  // trang chủ — token 8h hết hạn giữa lúc đang sửa dở là chuyện thường ngày.
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}

/** Chặn ở tầng route cho những trang mà cả trang đều cần quyền cao. */
function RequireRole({ minRole, children }: { minRole: AdminRole; children: ReactNode }) {
  const { can } = useAuth();
  if (can(minRole)) return <>{children}</>;

  return (
    <>
      <PageHeader title="Không đủ quyền" />
      <Card>
        <p className="px-5 py-6 text-sm text-ink-600">
          Trang này cần quyền <strong>{ADMIN_ROLE[minRole]}</strong> trở lên. Liên hệ một tài khoản
          có quyền xuất bản nếu bạn cần thao tác ở đây.
        </p>
      </Card>
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        <Route path="content/:resource" element={<ContentListPage />} />
        <Route path="content/:resource/new" element={<ContentEditPage mode="create" />} />
        <Route path="content/:resource/:id" element={<ContentEditPage mode="edit" />} />

        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:playerId" element={<PlayerDetailPage />} />
        <Route
          path="mail"
          element={
            <RequireRole minRole="publisher">
              <MailPage />
            </RequireRole>
          }
        />

        <Route path="publish" element={<PublishPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route
          path="admins"
          element={
            <RequireRole minRole="publisher">
              <AdminsPage />
            </RequireRole>
          }
        />

        <Route
          path="*"
          element={
            <>
              <PageHeader title="Không có trang này" />
              <Card>
                <p className="px-5 py-6 text-sm text-ink-600">
                  Đường dẫn không tồn tại. Dùng thanh bên để quay lại.
                </p>
              </Card>
            </>
          }
        />
      </Route>
    </Routes>
  );
}
