import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_MEDIA_QUERY } from '@/shared/ui/breakpoints';

describe('desktop breakpoint (PWA header switch)', () => {
  it('the media query and the Tailwind `desktop` variant are both 1160px', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const rem = /--breakpoint-desktop:\s*([\d.]+)rem;/.exec(css)?.[1];
    expect(Number(rem) * 16).toBe(1160);
    expect(DESKTOP_MEDIA_QUERY).toBe('(min-width: 1160px)');
  });
});
