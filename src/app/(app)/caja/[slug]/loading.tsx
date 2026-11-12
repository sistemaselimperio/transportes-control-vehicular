/** Planilla: header, balance summary, actions and the expense list. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-11 w-32" />
      <div className="skeleton h-9 w-56" />
      <div className="skeleton h-48 w-full rounded-2xl md:h-40" />
      <div className="skeleton hidden h-10 w-96 md:block" />
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
