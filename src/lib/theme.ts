/**
 * Per-user color theme. `yellow` is the brand palette (`:root` in globals.css); `sky` overrides it
 * through `[data-theme="sky"]`. Chosen by seed/admin tooling, never by the client.
 */
export type Theme = "yellow" | "sky";

/** Anything that is not exactly a known non-default theme is the default one. */
export function parseTheme(value: unknown): Theme {
  return value === "sky" ? "sky" : "yellow";
}
