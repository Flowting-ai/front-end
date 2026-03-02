/**
 * Highlight.js Theme Configuration
 * 
 * Available themes for code syntax highlighting.
 * To change the theme, update the activeTheme value in globals.css
 * 
 * Instructions:
 * 1. Choose a theme from the list below
 * 2. Update the @import statement in globals.css to use your chosen theme
 * 3. Example: @import "highlight.js/styles/github-dark.css";
 */

export const HIGHLIGHT_THEMES = {
  // Light Themes
  GITHUB: 'highlight.js/styles/github.css',
  ATOM_ONE_LIGHT: 'highlight.js/styles/atom-one-light.css',
  XCODE: 'highlight.js/styles/xcode.css',
  VS: 'highlight.js/styles/vs.css',
  STACKOVERFLOW_LIGHT: 'highlight.js/styles/stackoverflow-light.css',
  GITHUB_LIGHT: 'highlight.js/styles/github.css',
  INTELLIJ_LIGHT: 'highlight.js/styles/intellij-light.css',
  
  // Dark Themes
  GITHUB_DARK: 'highlight.js/styles/github-dark.css',
  ATOM_ONE_DARK: 'highlight.js/styles/atom-one-dark.css',
  VS_CODE_DARK: 'highlight.js/styles/vs2015.css',
  MONOKAI: 'highlight.js/styles/monokai.css',
  DRACULA: 'highlight.js/styles/dracula.css',
  NORD: 'highlight.js/styles/nord.css',
  NIGHT_OWL: 'highlight.js/styles/night-owl.css',
  TOMORROW_NIGHT: 'highlight.js/styles/tomorrow-night-blue.css',
  TOKYO_NIGHT_DARK: 'highlight.js/styles/tokyo-night-dark.css',
  STACKOVERFLOW_DARK: 'highlight.js/styles/stackoverflow-dark.css',
  
  // Popular Themes
  MONOKAI_SUBLIME: 'highlight.js/styles/monokai-sublime.css',
  SOLARIZED_DARK: 'highlight.js/styles/solarized-dark.css',
  SOLARIZED_LIGHT: 'highlight.js/styles/solarized-light.css',
  RAINBOW: 'highlight.js/styles/rainbow.css',
  GRUVBOX_DARK: 'highlight.js/styles/gruvbox-dark.css',
  GRUVBOX_LIGHT: 'highlight.js/styles/gruvbox-light.css',
  ZENBURN: 'highlight.js/styles/zenburn.css',
  AGATE: 'highlight.js/styles/agate.css',
  
  // Base16 Themes
  BASE16_DEFAULT_DARK: 'highlight.js/styles/base16/default-dark.css',
  BASE16_DEFAULT_LIGHT: 'highlight.js/styles/base16/default-light.css',
  BASE16_OCEAN: 'highlight.js/styles/base16/oceanicnext.css',
  BASE16_MONOKAI: 'highlight.js/styles/base16/monokai.css',
} as const;

export type HighlightTheme = typeof HIGHLIGHT_THEMES[keyof typeof HIGHLIGHT_THEMES];

/**
 * Current active theme
 * Change this value to switch themes programmatically
 */
export const ACTIVE_THEME = HIGHLIGHT_THEMES.GITHUB;

/**
 * Theme categories for easy selection
 */
export const THEME_CATEGORIES = {
  light: [
    { name: 'GitHub Light', value: HIGHLIGHT_THEMES.GITHUB },
    { name: 'Atom One Light', value: HIGHLIGHT_THEMES.ATOM_ONE_LIGHT },
    { name: 'Xcode', value: HIGHLIGHT_THEMES.XCODE },
    { name: 'Visual Studio', value: HIGHLIGHT_THEMES.VS },
    { name: 'Stack Overflow Light', value: HIGHLIGHT_THEMES.STACKOVERFLOW_LIGHT },
    { name: 'IntelliJ Light', value: HIGHLIGHT_THEMES.INTELLIJ_LIGHT },
    { name: 'Solarized Light', value: HIGHLIGHT_THEMES.SOLARIZED_LIGHT },
    { name: 'Gruvbox Light', value: HIGHLIGHT_THEMES.GRUVBOX_LIGHT },
  ],
  dark: [
    { name: 'GitHub Dark', value: HIGHLIGHT_THEMES.GITHUB_DARK },
    { name: 'Atom One Dark', value: HIGHLIGHT_THEMES.ATOM_ONE_DARK },
    { name: 'VS Code Dark', value: HIGHLIGHT_THEMES.VS_CODE_DARK },
    { name: 'Monokai', value: HIGHLIGHT_THEMES.MONOKAI },
    { name: 'Dracula', value: HIGHLIGHT_THEMES.DRACULA },
    { name: 'Nord', value: HIGHLIGHT_THEMES.NORD },
    { name: 'Night Owl', value: HIGHLIGHT_THEMES.NIGHT_OWL },
    { name: 'Tomorrow Night', value: HIGHLIGHT_THEMES.TOMORROW_NIGHT },
    { name: 'Tokyo Night Dark', value: HIGHLIGHT_THEMES.TOKYO_NIGHT_DARK },
    { name: 'Stack Overflow Dark', value: HIGHLIGHT_THEMES.STACKOVERFLOW_DARK },
    { name: 'Monokai Sublime', value: HIGHLIGHT_THEMES.MONOKAI_SUBLIME },
    { name: 'Solarized Dark', value: HIGHLIGHT_THEMES.SOLARIZED_DARK },
    { name: 'Gruvbox Dark', value: HIGHLIGHT_THEMES.GRUVBOX_DARK },
    { name: 'Zenburn', value: HIGHLIGHT_THEMES.ZENBURN },
    { name: 'Agate', value: HIGHLIGHT_THEMES.AGATE },
  ],
} as const;

export default HIGHLIGHT_THEMES;
