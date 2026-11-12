/** Caja: header and ledger cards / rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-4 w-64 max-w-full" />
        </div>
        <div className="skeleton h-11 w-40" />
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-36 rounded-2xl" />
        ))}
      </div>
      <div className="panel hidden md:block">
        <div className="divide-y">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
