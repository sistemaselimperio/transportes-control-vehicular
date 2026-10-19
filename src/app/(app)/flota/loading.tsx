/** Flota: tabs, filter bar and table rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-24" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="flex gap-2 border-b-2 border-secondary pb-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-8 w-24" />
        ))}
      </div>
      <div className="skeleton h-9 w-full max-w-xl" />
      <div className="panel">
        <div className="plate-head">
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="skeleton h-5 w-28" />
              <div className="skeleton h-6 w-20" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-6 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
