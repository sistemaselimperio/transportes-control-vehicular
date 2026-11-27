/** Caja del día: header, expenses, incomes and the arqueo panel. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-11 w-24" />
      <div className="skeleton h-9 w-64" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <div className="skeleton h-64 w-full rounded-2xl" />
          <div className="skeleton h-40 w-full rounded-2xl" />
        </div>
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
