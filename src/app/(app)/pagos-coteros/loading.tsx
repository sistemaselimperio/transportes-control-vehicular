/** Pagos a coteros: header, filters and receipt cards. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-72 max-w-full" />
        </div>
        <div className="skeleton h-11 w-40" />
      </div>
      <div className="skeleton h-11 w-full max-w-md" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
