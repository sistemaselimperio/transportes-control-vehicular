/** Hoy: header, counter strip and the three urgency blocks. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="skeleton h-8 w-24" />
        <div className="skeleton h-4 w-64" />
      </div>
      <div className="panel grid grid-cols-2 divide-x">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3 px-5 py-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-9 w-14" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="panel">
          <div className="plate-head">
            <div className="skeleton h-3 w-28" />
          </div>
          <div className="divide-y">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-4 px-4 py-4">
                <div className="skeleton h-6 w-20" />
                <div className="skeleton h-4 flex-1" />
                <div className="skeleton h-7 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
