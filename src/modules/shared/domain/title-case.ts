/** Connectors that stay lowercase inside a name, e.g. "San Pedro de los Milagros". */
const CONNECTORS = new Set(["de", "del", "la", "las", "los", "y"]);

/** Capitalizes the first letter of each word: "BOGOTÁ, D.C." becomes "Bogotá, D.C.". */
export function titleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i > 0 && CONNECTORS.has(word)) return word;
      if (word.includes(".")) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
