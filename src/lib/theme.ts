/**
 * Color theme. `yellow` is the brand palette (`:root` in globals.css); `sky` and `orange`
 * override it through `[data-theme="…"]` on <html>. Each person picks it in the sidebar and it
 * lives in their browser (localStorage): no server or database work involved.
 */
export type Theme = "yellow" | "sky" | "orange";

export const THEME_STORAGE_KEY = "theme";

export const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string; swatch: string }> = [
  { value: "yellow", label: "Amarillo", swatch: "#ffff00" },
  { value: "sky", label: "Cielo", swatch: "#87ceeb" },
  { value: "orange", label: "Naranja", swatch: "#fb923c" },
];

/** Themes that override the default palette, so they need a `data-theme` attribute. */
const OVERRIDE_THEMES: readonly Theme[] = THEME_OPTIONS.map((o) => o.value).filter((t) => t !== "yellow");

/** Anything that is not exactly a known non-default theme is the default one. */
export function parseTheme(value: unknown): Theme {
  return OVERRIDE_THEMES.find((t) => t === value) ?? "yellow";
}

/**
 * Inline <head> script: applies the stored theme before the first paint, so there is no yellow
 * flash. Only known non-default values reach the DOM; blocked storage leaves the default.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(OVERRIDE_THEMES)}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;

/** Applies and remembers a theme picked in this browser. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "yellow") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice still applies for this page view.
  }
}
