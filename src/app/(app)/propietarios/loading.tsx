/** Propietarios: header, view tabs, search and table. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-44" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="skeleton h-11 w-full" />
      <div className="skeleton h-9 w-72" />
      <div className="panel">
        <div className="plate-head">
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="skeleton h-4 w-56" />
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-6 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
