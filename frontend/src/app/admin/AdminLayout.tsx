import { NavLink, Outlet, Link } from "react-router";
import { Leaf, Home, LayoutDashboard } from "lucide-react";

const sections = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/catalog", label: "Catálogo", end: false },
  { to: "/admin/customers", label: "Clientes", end: false },
  { to: "/admin/purchases", label: "Compras", end: false },
  { to: "/admin/conversations", label: "Conversaciones", end: false },
  { to: "/admin/recommendations", label: "Recomendaciones", end: false },
];

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-emerald-950 text-stone-100 flex flex-col">
        <div className="flex items-center gap-2 px-6 py-6">
          <Leaf className="w-6 h-6" />
          <span className="font-serif text-lg tracking-wide">Dra. Andrea · Admin</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 text-sm tracking-wide transition-colors ${
                  isActive
                    ? "bg-emerald-900 text-white"
                    : "text-stone-300 hover:bg-emerald-900/60 hover:text-white"
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-emerald-900/60 text-xs text-stone-400">
          Panel dev-only · sin autenticación
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-stone-200">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-stone-600 hover:text-emerald-900"
          >
            <Home className="w-4 h-4" /> Volver a la landing
          </Link>
          <span className="text-xs uppercase tracking-wider text-stone-400">
            CRM interno
          </span>
        </div>
        <div className="px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}