import {
  attr,
  childElements,
  innerHtml,
  parseHtml,
  setAttr,
  type Element,
  type ParentNode,
} from '@/modules/page-builder/parser/dom';

const REMOVED_ELEMENTS = new Set(['script', 'noscript', 'base', 'meta', 'link']);
// Qualified names: parse5 stores SVG `xlink:href` as name `href` with prefix `xlink`.
const URL_ATTRIBUTES = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'poster']);
// Ignores whitespace and control characters browsers skip in schemes.
const SCRIPT_URL = /^[\s\u0000-\u001f]*(?:j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t|vbscript)\s*:/i;

/**
 * Prepares trusted admin HTML (CMS content) for server rendering.
 *
 * Legacy PWA Studio inserted this HTML client-side with `innerHTML`, where
 * `<script>` never runs. Server-rendered HTML would execute it, so scripts,
 * inline event handlers and `javascript:` urls are removed to keep the legacy
 * behavior. Everything else (inline styles, iframes, classes) stays: this is
 * not a filter for untrusted input. Images are lazy-loaded unless the admin
 * set `loading`, and new-tab links get `rel="noopener noreferrer"`.
 */
export function sanitizeTrustedHtml(html: string): string {
  const fragment = parseHtml(html);
  clean(fragment);
  return innerHtml(fragment);
}

function clean(node: ParentNode): void {
  // `<template>` keeps its children in `content`, not in `childNodes`.
  const container = 'content' in node && node.nodeName === 'template' ? node.content : node;
  container.childNodes = container.childNodes.filter(
    (child) => !('tagName' in child) || !REMOVED_ELEMENTS.has(child.tagName),
  );
  for (const element of childElements(node)) {
    removeUnsafeAttributes(element);
    if (element.tagName === 'img' && attr(element, 'loading') === null) {
      setAttr(element, 'loading', 'lazy');
      if (attr(element, 'decoding') === null) setAttr(element, 'decoding', 'async');
    }
    if (element.tagName === 'a' && attr(element, 'target') === '_blank' && !attr(element, 'rel')) {
      setAttr(element, 'rel', 'noopener noreferrer');
    }
    clean(element);
  }
}

/** Event handlers and script urls, checked per attribute (prefixed names included). */
function removeUnsafeAttributes(element: Element): void {
  element.attrs = element.attrs.filter((attribute) => {
    if (attribute.name.toLowerCase().startsWith('on')) return false;
    const name = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
    return !(URL_ATTRIBUTES.has(name.toLowerCase()) && SCRIPT_URL.test(attribute.value));
  });
}
