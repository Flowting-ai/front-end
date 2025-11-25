# Clash Grotesk Font Setup

## How to get Clash Grotesk Variable font:

1. **Option 1: Purchase/Download from official source**
   - Visit: https://www.fontshare.com/fonts/clash-grotesk
   - Download the free version for web use
   - Extract the variable font files (ClashGrotesk-Variable.woff2, .woff, .ttf)
   - Place them in this folder

2. **Option 2: Use locally installed font**
   - If Clash Grotesk is installed on your system, the CSS will automatically use it via `local()` directive

3. **Option 3: Use CDN (if available)**
   - Some CDNs may host Clash Grotesk for web use

## Required files:
- ClashGrotesk-Variable.woff2 (best performance)
- ClashGrotesk-Variable.woff (fallback)
- ClashGrotesk-Variable.ttf (fallback)

## Current Status:
The @font-face declaration is set up in `src/app/globals.css` with fallback fonts.
The app will use the system fonts until the Clash Grotesk files are added.

## Fallback chain:
1. Clash Grotesk Variable (if font files present)
2. Clash Grotesk (if installed locally)
3. System fonts (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue)
