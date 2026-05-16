/**
 * loading.tsx — Skeleton UI para el segmento /dashboard.
 *
 * Se muestra automáticamente mientras los RSC del dashboard están cargando
 * (Suspense boundary que Next.js crea implícitamente por este archivo).
 *
 * Layout: refleja la estructura de dashboard/page.tsx — sidebar + main content.
 * Palette: slate/indigo, consistente con el tema del proyecto (LUMINA Light Premium).
 * Animación: animate-pulse de Tailwind. Sin dependencias externas.
 */

export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar skeleton */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-4 gap-3">
        {/* Logo placeholder */}
        <div className="h-8 w-36 rounded-md bg-slate-200 animate-pulse mb-4" />

        {/* Nav items */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <div className="h-5 w-5 rounded bg-slate-200 animate-pulse" />
            <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
          </div>
        ))}

        {/* Spacer + user pill at bottom */}
        <div className="mt-auto flex items-center gap-3 pt-4 border-t border-slate-100">
          <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="h-8 w-48 rounded-lg bg-slate-200 animate-pulse mb-2" />
          <div className="h-4 w-72 rounded bg-slate-100 animate-pulse" />
        </div>

        {/* KPI cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-24 rounded bg-slate-200 animate-pulse" />
                <div className="h-8 w-8 rounded-lg bg-indigo-100 animate-pulse" />
              </div>
              <div className="h-7 w-20 rounded bg-slate-200 animate-pulse mb-1" />
              <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-indigo-100 animate-pulse" />
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-5 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100">
            {['w-16', 'w-32', 'w-20', 'w-24', 'w-16'].map((w, i) => (
              <div key={i} className={`h-3 ${w} rounded bg-slate-200 animate-pulse`} />
            ))}
          </div>

          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-slate-50 last:border-0"
            >
              <div className="h-4 w-12 rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-full max-w-xs rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-indigo-100 animate-pulse" />
              <div className="h-4 w-10 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Action tiles row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-100 animate-pulse mb-4" />
              <div className="h-5 w-32 rounded bg-slate-200 animate-pulse mb-2" />
              <div className="h-3 w-full rounded bg-slate-100 animate-pulse mb-1" />
              <div className="h-3 w-3/4 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
