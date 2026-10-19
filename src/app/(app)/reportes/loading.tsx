/** Reportes: KPI strip and four chart blocks. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="panel grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 bg-card px-5 py-4">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-9 w-14" />
            <div className="skeleton h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel">
            <div className="plate-head">
              <div className="skeleton h-3 w-32" />
            </div>
            <div className="p-4">
              <div className="skeleton h-44 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
