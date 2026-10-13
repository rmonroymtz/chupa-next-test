import { isCsrfOriginAllowed } from 'next/dist/server/app-render/csrf-protection';
import { describe, expect, it } from 'vitest';
import { parseServerActionsAllowedOrigins } from '@/shared/config/server-actions';

describe('parseServerActionsAllowedOrigins', () => {
  it('is empty when unset or blank, so only same-origin actions are accepted', () => {
    expect(parseServerActionsAllowedOrigins(undefined)).toEqual([]);
    expect(parseServerActionsAllowedOrigins(' , ')).toEqual([]);
  });

  it('parses comma-separated hosts, lower-cased, with optional port and wildcard', () => {
    expect(
      parseServerActionsAllowedOrigins(
        ' WWW.Chupaprecios.com.mx, *.chupaprecios.com.mx,localhost:3000 ',
      ),
    ).toEqual(['www.chupaprecios.com.mx', '*.chupaprecios.com.mx', 'localhost:3000']);
  });

  it('accepts origins written as urls and keeps only the host', () => {
    expect(parseServerActionsAllowedOrigins('https://www.chupaprecios.com.mx/')).toEqual([
      'www.chupaprecios.com.mx',
    ]);
  });

  it.each([['chupaprecios.com.mx/path'], ['*'], ['bad host'], ['https://']])(
    'rejects %s so a typo fails the build instead of every action',
    (raw) => {
      expect(() => parseServerActionsAllowedOrigins(raw)).toThrow(/SERVER_ACTIONS_ALLOWED_ORIGINS/);
    },
  );

  it('produces entries Next matches against the browser origin host', () => {
    const allowed = parseServerActionsAllowedOrigins('*.chupaprecios.com.mx');
    expect(isCsrfOriginAllowed('www.chupaprecios.com.mx', allowed)).toBe(true);
    expect(isCsrfOriginAllowed('evil.example', allowed)).toBe(false);
  });
});
