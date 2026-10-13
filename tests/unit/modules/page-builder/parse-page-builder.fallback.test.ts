import { describe, expect, it, vi } from 'vitest';
import { parsePageBuilder } from '@/modules/page-builder/parser/parse-page-builder';

// Forces the `video` aggregator to throw, so the parser's never-throws
// fallback (node becomes `unknown` + one warning) is exercised for real.
vi.mock('@/modules/page-builder/domain/video-source', () => ({
  parseVideoSource: () => {
    throw new Error('boom');
  },
  toEmbedUrl: () => '',
}));

describe('parsePageBuilder: aggregator failure', () => {
  it('degrades a throwing content type to unknown, keeps siblings and children, warns once', () => {
    const video =
      '<div data-content-type="video" data-element="main"><div data-element="inner"><div data-element="wrapper"><div data-element="container"><iframe src="https://www.youtube.com/embed/a"></iframe></div></div></div></div>';
    const doc = parsePageBuilder(
      video + video + '<div data-content-type="text" data-element="main"><p>ok</p></div>',
    );
    expect(doc.nodes.map((node) => node.type)).toEqual(['unknown', 'unknown', 'text']);
    expect(doc.nodes[0]).toEqual({
      type: 'unknown',
      contentType: 'video',
      box: { style: {}, styleId: null, mediaStyles: [], classes: [], hidden: false },
      children: [],
    });
    expect(doc.warnings).toEqual(['unreadable content type: video']);
  });
});
