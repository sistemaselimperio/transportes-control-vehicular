/** Vehicle file: header, the document ledger and maintenance on the left, people and ficha on the right. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-3 border-b pb-4">
        <div className="skeleton h-5 w-16" />
        <div className="flex items-center gap-4">
          <div className="skeleton h-12 w-44" />
          <div className="space-y-2">
            <div className="skeleton h-5 w-48" />
            <div className="skeleton h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="space-y-8">
          <div>
            <div className="skeleton mb-2 h-6 w-32" />
            <div className="divide-y border-y">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-2 py-3">
                  <div className="flex items-center gap-4">
                    <div className="skeleton h-4 w-24 shrink-0" />
                    <div className="skeleton h-px flex-1" />
                    <div className="skeleton h-4 w-28 shrink-0" />
                  </div>
                  <div className="skeleton h-4 w-56" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="skeleton mb-2 h-6 w-36" />
            <div className="skeleton h-14 w-full" />
          </div>
        </div>
        <div className="space-y-8">
          {[2, 2].map((rows, s) => (
            <div key={s}>
              <div className="skeleton mb-2 h-6 w-24" />
              <div className="divide-y border-y">
                {Array.from({ length: rows }, (_, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="skeleton h-4 w-20" />
                    <div className="skeleton h-4 w-28" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
