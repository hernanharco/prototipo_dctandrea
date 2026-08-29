import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, Conversation, Customer } from "./api";

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listConversations(), api.listCustomers()])
      .then(([co, cu]) => {
        setConversations(co.conversations);
        setCustomers(cu.customers);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error de red"))
      .finally(() => setLoading(false));
  }, []);

  const customerName = (id: number) =>
    customers.find((c) => c.id === id)?.name ?? `cliente #${id}`;

  if (loading) return <p className="text-stone-500">Cargando…</p>;
  if (error) {
    return (
      <div className="max-w-2xl p-6 bg-amber-50 border border-amber-300 text-amber-900">
        <h2 className="font-serif text-xl">Acceso restringido</h2>
        <p className="mt-2 text-sm">Respuesta del backend: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl">Conversaciones</h1>
      <p className="mt-1 text-sm text-stone-500">
        Hilos del chat con memoria. Haz clic para ver los mensajes.
      </p>
      <div className="mt-6 overflow-x-auto bg-white border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-stone-600 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-right">Creada</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id} className="border-t border-stone-200">
                <td className="px-4 py-3">{c.id}</td>
                <td className="px-4 py-3">{customerName(c.customerId)}</td>
                <td className="px-4 py-3 text-right text-xs text-stone-500">
                  {new Date(c.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/admin/conversations/${c.id}`} className="text-emerald-800 hover:underline">
                    Ver mensajes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}