/** Hoy: header, status counters, kind chips + search, vehicle list and side panel. */
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
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
        <div className="flex min-w-0 flex-1 gap-2 overflow-hidden border-b-2 border-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton mb-2 h-7 w-24 shrink-0" />
          ))}
        </div>
        <div className="skeleton h-11 w-full md:w-64" />
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          {[0, 1].map((i) => (
            <div key={i} className="panel">
              <div className="plate-head px-5">
                <div className="skeleton h-3 w-28" />
              </div>
              <div className="divide-y">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-4 px-5 py-4">
                    <div className="skeleton h-6 w-20 flex-none" />
                    <div className="skeleton h-6 w-28 flex-none" />
                    <div className="skeleton h-6 w-24 flex-none" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="panel hidden md:block">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div className="skeleton h-6 w-20" />
            <div className="skeleton h-4 w-16" />
          </div>
          <div className="space-y-3 border-b px-5 py-4">
            <div className="skeleton h-9 w-full" />
            <div className="skeleton h-9 w-full" />
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="skeleton h-9 w-full" />
            <div className="skeleton h-9 w-2/3" />
            <div className="skeleton h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
