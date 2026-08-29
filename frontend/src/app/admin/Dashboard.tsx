import { useEffect, useState } from "react";
import { api } from "./api";

interface Counts {
  products: number;
  customers: number;
  purchases: number;
  conversations: number;
  recommendations: number;
}

export function Dashboard() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setCounts({
          products: p.products.length,
          customers: cu.customers.length,
          purchases: pu.purchases.length,
          conversations: co.conversations.length,
          recommendations: r.recommendations.length,
        });
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Error de red");
      });
    return () => {
      active = false;
    };
  }, []);

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

  if (!counts) {
    return <p className="text-stone-500">Cargando…</p>;
  }

  const cards = [
    { label: "Productos (catálogo)", value: counts.products, to: "/admin/catalog" },
    { label: "Clientes", value: counts.customers, to: "/admin/customers" },
    { label: "Compras", value: counts.purchases, to: "/admin/purchases" },
    { label: "Conversaciones", value: counts.conversations, to: "/admin/conversations" },
    { label: "Recomendaciones (log)", value: counts.recommendations, to: "/admin/recommendations" },
  ];

  return (
    <div>
      <h1 className="font-serif text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-stone-500">
        Resumen del CRM interno de vitaminas (recomendador Nutrilite).
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <a
            key={c.label}
            href={c.to}
            className="block p-6 bg-white border border-stone-200 hover:border-emerald-800 transition-colors"
          >
            <p className="text-sm uppercase tracking-wider text-stone-500">{c.label}</p>
            <p className="mt-2 text-3xl font-medium text-emerald-900">{c.value}</p>
          </a>
        ))}
      </div>
    </div>
  );
}