/** Enturnamientos: header, jornada card and queue rows. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-72 max-w-full" />
        </div>
        <div className="skeleton h-10 w-40" />
      </div>
      <div className="skeleton h-20 w-full rounded-2xl" />
      <div className="skeleton h-32 w-full rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
