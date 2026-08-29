import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Users,
  Package,
  ShoppingCart,
  MessageSquareText,
  ShieldCheck,
  AlertTriangle,
  Activity,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { api, Customer, Product, Recommendation } from "./api";

interface DashboardData {
  products: Product[];
  customers: Customer[];
  purchases: { id: number; customerId: number; productReference: string; qty: number; purchasedAt: string }[];
  conversations: { id: number; customerId: number; createdAt: string }[];
  recommendations: Recommendation[];
}

/** SQLite datetime "YYYY-MM-DD HH:MM:SS" -> Date (safe across browsers). */
function parseDT(s: string): Date {
  return new Date(s.replace(" ", "T"));
}

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function lastNDays(n: number) {
  const today = new Date();
  const out: { key: string; label: string; registros: number; recomendaciones: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push({
      key: dayKey(d),
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      registros: 0,
      recomendaciones: 0,
    });
  }
  return out;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.listProducts(),
      api.listCustomers(),
      api.listPurchases(),
      api.listConversations(),
      api.listRecommendations(),
    ])
      .then(([p, cu, pu, co, r]) => {
        if (!active) return;
        setData({
          products: p.products,
          customers: cu.customers,
          purchases: pu.purchases,
          conversations: co.conversations,
          recommendations: r.recommendations,
        });
        setUpdatedAt(new Date());
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Error de red");
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const view = useMemo(() => {
    if (!data) return null;

    const byId = new Map(data.customers.map((c) => [c.id, c.name]));
    const productName = new Map(data.products.map((p) => [p.reference, p.name]));

    // 14-day trend buckets.
    const trend = lastNDays(14);
    const trendIndex = new Map(trend.map((t) => [t.key, t]));
    data.customers.forEach((c) => {
      const k = dayKey(parseDT(c.registeredAt));
      const bucket = trendIndex.get(k);
      if (bucket) bucket.registros += 1;
    });
    data.recommendations.forEach((r) => {
      const k = dayKey(parseDT(r.createdAt));
      const bucket = trendIndex.get(k);
      if (bucket) bucket.recomendaciones += 1;
    });

    // Top recommended products (across all recommendation logs).
    const refCount = new Map<string, number>();
    data.recommendations.forEach((r) => {
      try {
        const refs = JSON.parse(r.productReferences) as string[];
        refs.forEach((ref) => refCount.set(ref, (refCount.get(ref) ?? 0) + 1));
      } catch {
        /* ignore malformed productReferences */
      }
    });
    const topProducts = [...refCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ref, count]) => ({
        ref,
        name: productName.get(ref) ?? ref,
        count,
      }));

    // Conversion funnel: registered → chatted → recommended → purchased.
    const chatted = new Set(data.conversations.map((c) => c.customerId));
    const recommended = new Set(data.recommendations.map((r) => r.customerId));
    const purchased = new Set(data.purchases.map((p) => p.customerId));
    const funnel = [
      { label: "Registrados", value: data.customers.length },
      { label: "Con conversación", value: [...chatted].filter((id) => byId.has(id)).length },
      { label: "Con recomendación", value: [...recommended].filter((id) => byId.has(id)).length },
      { label: "Con compra", value: [...purchased].filter((id) => byId.has(id)).length },
    ];

    // Top symptoms (what visitors ask about most).
    const symptomCount = new Map<string, number>();
    data.recommendations.forEach((r) => {
      const s = r.symptom.trim().toLowerCase();
      if (!s) return;
      symptomCount.set(s, (symptomCount.get(s) ?? 0) + 1);
    });
    const topSymptoms = [...symptomCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Purchases by product (units sold).
    const qtyByRef = new Map<string, number>();
    data.purchases.forEach((p) => {
      qtyByRef.set(p.productReference, (qtyByRef.get(p.productReference) ?? 0) + p.qty);
    });
    const purchasesByProduct = [...qtyByRef.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ref, qty]) => ({ name: productName.get(ref) ?? ref, qty }));

    // Recent activity: latest recommendations with customer + products.
    const recent = [...data.recommendations]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6)
      .map((r) => {
        let refs: string[] = [];
        try {
          refs = JSON.parse(r.productReferences) as string[];
        } catch {
          /* ignore */
        }
        return {
          id: r.id,
          customer: byId.get(r.customerId) ?? `Cliente #${r.customerId}`,
          symptom: r.symptom,
          products: refs.map((ref) => productName.get(ref) ?? ref).join(", ") || "—",
          blocked: r.guardBlocked,
          at: r.createdAt.slice(0, 16),
        };
      });

    // Latest registered customers (with referral info — Amway network).
    const recentCustomers = [...data.customers]
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
      .slice(0, 6);

    const blocked = data.recommendations.filter((r) => r.guardBlocked).length;

    return {
      counts: {
        products: data.products.length,
        customers: data.customers.length,
        purchases: data.purchases.length,
        conversations: data.conversations.length,
        recommendations: data.recommendations.length,
        blocked,
      },
      funnel,
      topSymptoms,
      purchasesByProduct,
      trend,
      topProducts,
      recent,
      recentCustomers,
    };
  }, [data]);

  if (error) {
    return (
      <div className="max-w-2xl p-6 bg-amber-50 border border-amber-300 text-amber-900">
        <h2 className="font-serif text-xl">Acceso restringido</h2>
        <p className="mt-2 text-sm">
          El panel /admin solo está disponible en desarrollo
          (<code>NODE_ENV=development</code>). Respuesta del backend: {error}
        </p>
      </div>
    );
  }

  if (!view) {
    return <p className="text-stone-500">Cargando…</p>;
  }

  const kpis = [
    {
      label: "Clientes",
      value: view.counts.customers,
      to: "/admin/customers",
      icon: Users,
      accent: "text-emerald-900 bg-emerald-50",
    },
    {
      label: "Productos",
      value: view.counts.products,
      to: "/admin/catalog",
      icon: Package,
      accent: "text-emerald-800 bg-emerald-50",
    },
    {
      label: "Compras",
      value: view.counts.purchases,
      to: "/admin/purchases",
      icon: ShoppingCart,
      accent: "text-stone-700 bg-stone-100",
    },
    {
      label: "Conversaciones",
      value: view.counts.conversations,
      to: "/admin/conversations",
      icon: MessageSquareText,
      accent: "text-stone-700 bg-stone-100",
    },
    {
      label: "Recomendaciones",
      value: view.counts.recommendations,
      to: "/admin/recommendations",
      icon: ShieldCheck,
      accent: "text-emerald-800 bg-emerald-50",
    },
  ];

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid #d6d3d1",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  };

  const funnelMax = Math.max(view.funnel[0]?.value ?? 1, 1);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Dashboard</h1>
          <p className="mt-1 text-sm text-stone-500">
            Resumen del CRM interno de vitaminas (recomendador Nutrilite).
            {updatedAt && (
              <span className="ml-1 text-stone-400">
                · Actualizado {updatedAt.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view.counts.blocked > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 text-amber-900 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              {view.counts.blocked} respuesta{view.counts.blocked === 1 ? "" : "s"} bloqueada
              {view.counts.blocked === 1 ? "" : "s"} por el guard legal
            </div>
          )}
          <button
            onClick={() => setReload((n) => n + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 text-sm text-stone-700 hover:border-emerald-800 hover:text-emerald-900 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className="block p-5 bg-white border border-stone-200 hover:border-emerald-800 transition-colors"
          >
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${k.accent}`}>
              <k.icon className="w-4.5 h-4.5" />
            </div>
            <p className="mt-3 text-sm uppercase tracking-wider text-stone-500">{k.label}</p>
            <p className="mt-1 text-3xl font-medium text-emerald-900">{k.value}</p>
          </Link>
        ))}
      </div>

      {/* Trend charts */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 p-5">
          <h2 className="text-sm font-medium text-stone-700">Registros de clientes · 14 días</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trend} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRegistros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#064e3b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#064e3b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="registros"
                  name="Registros"
                  stroke="#064e3b"
                  strokeWidth={2}
                  fill="url(#gRegistros)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-5">
          <h2 className="text-sm font-medium text-stone-700">Recomendaciones · 14 días</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trend} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRecom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#047857" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="recomendaciones"
                  name="Recomendaciones"
                  stroke="#047857"
                  strokeWidth={2}
                  fill="url(#gRecom)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Business insight row: funnel + symptoms + purchases */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-5">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-800" />
            <h2 className="text-sm font-medium text-stone-700">Embudo de conversión</h2>
          </div>
          <div className="mt-4 space-y-3">
            {view.funnel.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-600">{f.label}</span>
                  <span className="font-medium text-stone-800">{f.value}</span>
                </div>
                <div className="mt-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-900 rounded-full"
                    style={{ width: `${Math.max((f.value / funnelMax) * 100, f.value > 0 ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-stone-400">
            Cuántos registrados llegan a conversar, recibir recomendación y comprar.
          </p>
        </div>

        <div className="bg-white border border-stone-200 p-5">
          <h2 className="text-sm font-medium text-stone-700">Top síntomas consultados</h2>
          {view.topSymptoms.length === 0 ? (
            <p className="mt-6 text-sm text-stone-400">Sin síntomas registrados todavía.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {view.topSymptoms.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-stone-600 truncate">“{s.name}”</span>
                  <span className="shrink-0 font-medium text-emerald-900">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-stone-400">
            Qué motivos de consulta aparecen más en el chat.
          </p>
        </div>

        <div className="bg-white border border-stone-200 p-5">
          <h2 className="text-sm font-medium text-stone-700">Compras por producto</h2>
          {view.purchasesByProduct.length === 0 ? (
            <p className="mt-6 text-sm text-stone-400">Sin compras registradas todavía.</p>
          ) : (
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.purchasesByProduct} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#78716c" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-12}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f4" }} />
                  <Bar dataKey="qty" name="Unidades" fill="#047857" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: recent customers + recent activity */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 p-5">
          <h2 className="text-sm font-medium text-stone-700">Clientes recientes</h2>
          {view.recentCustomers.length === 0 ? (
            <p className="mt-6 text-sm text-stone-400">Sin clientes registrados todavía.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-stone-400 border-b border-stone-100">
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Email</th>
                    <th className="py-2 pr-3 font-medium">Teléfono</th>
                    <th className="py-2 font-medium">Referido por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {view.recentCustomers.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3 text-stone-800">{c.name}</td>
                      <td className="py-2 pr-3 text-stone-500">{c.email}</td>
                      <td className="py-2 pr-3 text-stone-500">{c.phone}</td>
                      <td className="py-2 text-stone-500">{c.referrerPhone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-stone-200 p-5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-800" />
            <h2 className="text-sm font-medium text-stone-700">Actividad reciente</h2>
          </div>
          {view.recent.length === 0 ? (
            <p className="mt-6 text-sm text-stone-400">
              Aún no hay recomendaciones. Cuando un cliente chatee con el asistente, verás aquí la
              actividad.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {view.recent.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-stone-800">{r.customer}</span>
                    <span className="text-xs text-stone-400">{r.at}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500 italic">“{r.symptom}”</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-emerald-900">{r.products}</span>
                    {r.blocked && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium">
                        <AlertTriangle className="w-3 h-3" /> guard
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}