import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ADMIN_ROLE } from "../lib/labels";
import { RESOURCE_SPECS } from "../resources";
import { Badge, Button } from "./ui";

/**
 * Khung của trang quản trị: thanh bên cố định + vùng nội dung cuộn riêng.
 *
 * Mục nào cần quyền cao hơn quyền đang có thì KHÔNG hiện — backend vẫn chặn
 * bằng 403, đây chỉ là để không mời người ta bấm vào chỗ chắc chắn bị từ chối.
 */

interface NavItem {
  to: string;
  label: string;
  icon: string;
  minRole?: "viewer" | "editor" | "publisher";
  end?: boolean;
}

const OPS_ITEMS: NavItem[] = [
  { to: "/publish", label: "Xuất bản", icon: "🚀" },
  { to: "/audit", label: "Nhật ký thao tác", icon: "🧾" },
  { to: "/admins", label: "Tài khoản quản trị", icon: "🔑", minRole: "publisher" },
];

const PLAYER_ITEMS: NavItem[] = [
  { to: "/players", label: "Người chơi", icon: "👥" },
  { to: "/mail", label: "Gửi thư GM", icon: "📮", minRole: "publisher" },
];

export function Layout() {
  const { admin, logout, can } = useAuth();
  const [open, setOpen] = useState(false);

  const contentItems: NavItem[] = RESOURCE_SPECS.map((spec) => ({
    to: `/content/${spec.name}`,
    label: spec.label,
    icon: spec.icon,
  }));

  const close = () => setOpen(false);

  return (
    <div className="flex min-h-screen bg-ink-50">
      {open && (
        <div className="fixed inset-0 z-20 bg-ink-900/40 lg:hidden" onClick={close} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col overflow-y-auto bg-maroon-900 text-cream transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-maroon-800 px-5 py-5">
          <p className="text-sm font-semibold tracking-wide text-amber-brand">KÝ ỨC DI SẢN</p>
          <p className="mt-0.5 text-xs text-cream/60">Bảng điều khiển quản trị</p>
        </div>

        <nav className="flex-1 space-y-6 px-3 py-4 text-sm">
          <NavGroup>
            <NavRow item={{ to: "/", label: "Tổng quan", icon: "📊", end: true }} onClick={close} />
          </NavGroup>

          <NavGroup title="Nội dung">
            {contentItems.map((item) => (
              <NavRow key={item.to} item={item} onClick={close} />
            ))}
          </NavGroup>

          <NavGroup title="Người chơi">
            {PLAYER_ITEMS.filter((item) => !item.minRole || can(item.minRole)).map((item) => (
              <NavRow key={item.to} item={item} onClick={close} />
            ))}
          </NavGroup>

          <NavGroup title="Vận hành">
            {OPS_ITEMS.filter((item) => !item.minRole || can(item.minRole)).map((item) => (
              <NavRow key={item.to} item={item} onClick={close} />
            ))}
          </NavGroup>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <Button variant="ghost" className="lg:hidden" onClick={() => setOpen((v) => !v)}>
            ☰
          </Button>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-ink-900">
                {admin?.displayName || admin?.email}
              </p>
              <p className="text-xs text-ink-500">{admin?.email}</p>
            </div>
            <Badge tone={admin?.role === "publisher" ? "success" : "info"}>
              {admin ? ADMIN_ROLE[admin.role] : ""}
            </Badge>
            <Button variant="secondary" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div>
      {title && (
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-cream/40">
          {title}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavRow({ item, onClick }: { item: NavItem; onClick: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
          isActive ? "bg-maroon-800 text-amber-brand" : "text-cream/80 hover:bg-maroon-800/60"
        }`
      }
    >
      <span aria-hidden="true">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}
