import { Inter, Roboto_Flex } from 'next/font/google';

/*
 * Design system fonts, self-hosted: `next/font/google` downloads the files at
 * build time and serves them from this app, so pages make no request to
 * Google. Both variable (one file covers every weight), latin subset (covers
 * Spanish), `swap` plus Next's metric-adjusted fallback to keep layout shift
 * minimal.
 *
 * - Inter: DS body font (`font-sans`, the page default), preloaded.
 * - Roboto Flex: DS display font (`font-display`, Display XL…H2), preloaded:
 *   page titles and headings use it above the fold.
 */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--next-font-inter',
});

export const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  display: 'swap',
  variable: '--next-font-roboto-flex',
});

/** Classes for <html>: they define the font variables the theme reads. */
export const fontVariables = [inter, robotoFlex].map((font) => font.variable).join(' ');
