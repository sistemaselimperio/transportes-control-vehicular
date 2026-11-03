/** Preoperacional detail: title and the sheet. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-8 w-56" />
      <div className="skeleton h-96 w-full max-w-4xl" />
    </div>
  );
}
