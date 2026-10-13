import { Montserrat, Noto_Sans, Roboto_Flex } from 'next/font/google';

/*
 * Legacy fonts, self-hosted: `next/font/google` downloads the files at build
 * time and serves them from this app, so pages make no request to Google.
 * Only the families the shared layout and base styles use, all variable
 * (one file covers every weight), latin subset (covers Spanish), `swap`
 * plus Next's metric-adjusted fallback to keep layout shift minimal.
 *
 * - Roboto Flex: base font (legacy `html { font-family }`), preloaded.
 * - Noto Sans: desktop megamenu (legacy `font-noto`).
 * - Montserrat: footer text (legacy `font-montserrat`), below the fold.
 *
 * Inter (legacy product-card prices) is not loaded until a component uses it.
 */
export const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  display: 'swap',
  variable: '--next-font-roboto-flex',
});

export const notoSans = Noto_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--next-font-noto-sans',
  preload: false,
});

export const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--next-font-montserrat',
  preload: false,
});

/** Classes for <html>: they define the font variables the theme reads. */
export const fontVariables = [robotoFlex, notoSans, montserrat]
  .map((font) => font.variable)
  .join(' ');
