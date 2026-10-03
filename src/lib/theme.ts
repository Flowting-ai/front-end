/**
 * Theme preference helpers — pure, framework-free, unit-tested.
 *
 * The root element gets `data-theme="dark"` ONLY when the dark theme is active.
 * Light is represented by the ABSENCE of the attribute, so the light theme is
 * literally the unmodified token files (see src/styles/tokens/theme.css).
 */

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'souvenir-theme'
export const THEME_ATTRIBUTE = 'data-theme'
/** Fired on `window` after the stored preference changes in this tab. */
export const THEME_CHANGE_EVENT = 'souvenir-theme-change'
/** What a user gets until they choose — keeps today's look. */
export const DEFAULT_THEME_MODE: ThemeMode = 'light'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

/** Reads the stored preference. Anything missing or unrecognised → the default. */
export function readStoredMode(storage: Pick<Storage, 'getItem'> | null | undefined): ThemeMode {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY)
    return isThemeMode(raw) ? raw : DEFAULT_THEME_MODE
  } catch {
    return DEFAULT_THEME_MODE
  }
}

/** Applies a resolved theme to the root element: set for dark, remove for light. */
export function applyResolvedTheme(root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>, resolved: ResolvedTheme): void {
  if (resolved === 'dark') root.setAttribute(THEME_ATTRIBUTE, 'dark')
  else root.removeAttribute(THEME_ATTRIBUTE)
}

/**
 * Inline script run before first paint so a stored Dark/System choice doesn't
 * flash light. It only ever SETS data-theme="dark"; it never touches anything
 * for light. Mirrors readStoredMode + resolveTheme above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(m!=='dark'&&m!=='system')return;var d=m==='dark'||window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},'dark')}catch(e){}})()`
