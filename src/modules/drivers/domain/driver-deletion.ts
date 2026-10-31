export type DriverDeletionCheck = { ok: true } | { ok: false; message: string };

/**
 * A driver can be deleted only when no vehicle currently has them assigned (an open assignment).
 * `currentPlates` are the plates of those open assignments.
 */
export function checkDriverDeletion(name: string, currentPlates: readonly string[]): DriverDeletionCheck {
  if (currentPlates.length === 0) return { ok: true };
  const where =
    currentPlates.length === 1
      ? `a un vehículo (${currentPlates[0]})`
      : `a ${currentPlates.length} vehículos (${currentPlates.join(", ")})`;
  return { ok: false, message: `No se puede eliminar: ${name} está asignado ${where}. Desasígnalo primero.` };
}
