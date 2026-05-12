"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardNav } from "../_nav";

type Cliente = {
  rfc: string;
  nombre: string;
  [key: string]: unknown;
};

type ClientesResponse = {
  clientes: Cliente[];
  total: number;
  fecha_actualizacion: string;
};

export default function ClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [fechaActualizacion, setFechaActualizacion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function loadClientes() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clientes");
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
      const data: ClientesResponse = await res.json();
      setClientes(data.clientes ?? []);
      setTotal(data.total ?? 0);
      setFechaActualizacion(data.fecha_actualizacion ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClientes();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.rfc.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q)
    );
  }, [clientes, query]);

  return (
    <main className="min-h-screen bg-slate-50">
      <DashboardNav active="clientes" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Mis clientes ({total} total)
            </h2>
            {fechaActualizacion && (
              <p className="text-sm text-slate-500 mt-1">
                Actualizado: {new Date(fechaActualizacion).toLocaleString("es-MX")}
              </p>
            )}
          </div>
          <button
            onClick={() => void loadClientes()}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => void loadClientes()}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por RFC o nombre..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : !error && clientes.length === 0 ? (
            <div className="p-12 text-center text-slate-600">
              Aún no tienes clientes en cartera. Cuando agregues uno desde el portal del operador aparecerá aquí.
            </div>
          ) : !error && filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          ) : !error ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">RFC</th>
                  <th className="text-left px-4 py-3 font-medium">Nombre</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.rfc}
                    onClick={() =>
                      router.push(`/dashboard/cliente/${encodeURIComponent(c.rfc)}`)
                    }
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    title="Ver detalle del cliente"
                  >
                    <td className="px-4 py-3 font-mono text-slate-900">{c.rfc}</td>
                    <td className="px-4 py-3 text-slate-700">{c.nombre}</td>
                    <td className="px-4 py-3 text-right">
                      {/* stopPropagation: el botón hace su propia acción
                          (cotizar) sin disparar la navegación de la fila. */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `/dashboard/cotizar?rfc=${encodeURIComponent(c.rfc)}`
                          );
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
                      >
                        Cotizar para este cliente
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </main>
  );
}
