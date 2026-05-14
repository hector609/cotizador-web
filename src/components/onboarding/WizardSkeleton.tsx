"use client";

/**
 * WizardSkeleton — placeholder de carga para el wizard.
 * Se muestra mientras se carga el estado del servidor (GET /onboarding/state).
 */

export function WizardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-pulse">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 h-14 flex items-center px-6 gap-4">
        <div className="h-5 w-24 bg-slate-200 rounded-full" />
        <div className="ml-auto h-4 w-40 bg-slate-100 rounded-full" />
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-slate-100 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200" />
              {i < 6 && <div className="h-0.5 w-8 bg-slate-100 rounded-full" />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-8 px-4 sm:px-6 flex flex-col items-center">
        <div className="w-full max-w-2xl">
          <div className="h-8 w-52 bg-slate-200 rounded-xl mb-6" />
          <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded-full" />
                <div className="h-10 w-full bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 h-16 flex items-center justify-between px-6">
        <div className="h-8 w-20 bg-slate-100 rounded-full" />
        <div className="h-9 w-28 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
}
