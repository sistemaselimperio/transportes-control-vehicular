/** Vehicle file: plate header, expiration strip, tabs and a first panel. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-5 w-16" />
      <div className="flex items-center gap-4">
        <div className="skeleton h-12 w-44" />
        <div className="space-y-2">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-6 w-20" />
        </div>
      </div>
      <div className="skeleton h-14 w-full" />
      <div className="flex gap-3 border-b-2 border-secondary pb-2.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-6 w-24" />
        ))}
      </div>
      <div className="panel">
        <div className="plate-head">
          <div className="skeleton h-3 w-20" />
        </div>
        <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
