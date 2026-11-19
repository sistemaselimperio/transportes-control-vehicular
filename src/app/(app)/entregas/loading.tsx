/** Entregas: header, tabs and the shift panels. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="skeleton h-11 w-full max-w-xl" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="panel">
            <div className="plate-head">
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="space-y-3 p-4">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
