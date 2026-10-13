import { describe, expect, it } from 'vitest';
import { parseVideoSource, toEmbedUrl } from '@/modules/page-builder/domain/video-source';

describe('parseVideoSource', () => {
  it.each([
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', { kind: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1', { kind: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ', { kind: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', { kind: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://player.vimeo.com/video/76979871?h=x', { kind: 'vimeo', id: '76979871' }],
    ['https://vimeo.com/76979871', { kind: 'vimeo', id: '76979871' }],
    [
      'https://chupaprecios.com.mx/media/v.mp4',
      { kind: 'file', url: 'https://chupaprecios.com.mx/media/v.mp4' },
    ],
  ] as const)('%s', (url, expected) => {
    expect(parseVideoSource(url)).toEqual(expected);
  });

  it.each([
    null,
    '',
    'javascript:alert(1)',
    'http://insecure.test/v.mp4',
    'https://evil.test/embed.html',
    'https://www.youtube.com/embed/<x>',
  ])('rejects %s', (url) => {
    expect(parseVideoSource(url)).toBeNull();
  });
});

describe('toEmbedUrl', () => {
  it('uses privacy-friendly players', () => {
    expect(toEmbedUrl({ kind: 'youtube', id: 'abc' }, { autoplay: false, muted: false })).toBe(
      'https://www.youtube-nocookie.com/embed/abc',
    );
    expect(toEmbedUrl({ kind: 'vimeo', id: '1' }, { autoplay: true, muted: true })).toBe(
      'https://player.vimeo.com/video/1?dnt=1&autoplay=1&muted=1',
    );
  });
});
