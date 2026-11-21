import { searchKey } from "@/modules/shared/domain/search-key";

/** Port: the id of every reference by `key` (see `searchKey`), creating the ones that do not exist yet. */
export type EnsureReferences = (refs: ReadonlyArray<{ name: string; key: string }>) => Promise<Map<string, number>>;

/**
 * Ids of the reference catalog for the typed `names`, creating the unknown ones. The first spelling
 * typed for a name wins; the map is keyed by `searchKey(name)`.
 */
export async function resolveReferenceIds(ensure: EnsureReferences, names: readonly string[]): Promise<Map<string, number>> {
  const wanted = new Map<string, string>();
  for (const name of names) {
    const key = searchKey(name);
    if (!wanted.has(key)) wanted.set(key, name);
  }
  return ensure([...wanted].map(([key, name]) => ({ name, key })));
}
