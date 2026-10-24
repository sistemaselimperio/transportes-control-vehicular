/** Alertas: header, kind tabs, filters and rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="skeleton h-11 w-full" />
      <div className="flex gap-3">
        <div className="skeleton h-9 w-64" />
        <div className="skeleton ml-auto h-9 w-64" />
      </div>
      <div className="panel">
        <div className="plate-head">
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="skeleton h-6 w-24" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-6 w-20" />
              <div className="skeleton h-9 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
