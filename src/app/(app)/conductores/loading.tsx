/** Conductores: header and table rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="panel">
        <div className="plate-head">
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-6 w-20" />
              <div className="skeleton h-5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
