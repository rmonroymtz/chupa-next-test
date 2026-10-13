import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';

/**
 * Minimal DOM helpers over parse5 (the WHATWG HTML parser). parse5 builds the
 * same tree a browser's `DOMParser` builds, which is what the legacy PWA
 * Studio parser ran on, so malformed content is repaired the same way.
 */

export type Element = DefaultTreeAdapterMap['element'];
export type ChildNode = DefaultTreeAdapterMap['childNode'];
export type ParentNode = DefaultTreeAdapterMap['parentNode'];

export function parseHtml(html: string): DefaultTreeAdapterMap['documentFragment'] {
  return parseFragment(html);
}

export function isElement(node: ChildNode | ParentNode): node is Element {
  return 'tagName' in node;
}

export function attr(element: Element, name: string): string | null {
  return element.attrs.find((attribute) => attribute.name === name)?.value ?? null;
}

export function setAttr(element: Element, name: string, value: string): void {
  const existing = element.attrs.find((attribute) => attribute.name === name);
  if (existing) existing.value = value;
  else element.attrs.push({ name, value });
}

export function removeAttr(element: Element, name: string): void {
  element.attrs = element.attrs.filter((attribute) => attribute.name !== name);
}

export function classList(element: Element): string[] {
  return (attr(element, 'class') ?? '').split(/\s+/).filter((name) => name !== '');
}

export function hasClass(element: Element, name: string): boolean {
  return classList(element).includes(name);
}

/** Element children (template contents included), skipping text and comments. */
export function childElements(node: ParentNode): Element[] {
  const children =
    'content' in node && node.nodeName === 'template' ? node.content.childNodes : node.childNodes;
  return children.filter(isElement);
}

/** Depth-first descendants matching a predicate, in document order. */
export function findAll(node: ParentNode, predicate: (element: Element) => boolean): Element[] {
  const found: Element[] = [];
  const visit = (parent: ParentNode) => {
    for (const child of childElements(parent)) {
      if (predicate(child)) found.push(child);
      visit(child);
    }
  };
  visit(node);
  return found;
}

export function findFirst(
  node: ParentNode,
  predicate: (element: Element) => boolean,
): Element | null {
  for (const child of childElements(node)) {
    if (predicate(child)) return child;
    const nested = findFirst(child, predicate);
    if (nested) return nested;
  }
  return null;
}

/** `[data-element="name"]` descendant. */
export function byDataElement(node: ParentNode, name: string): Element | null {
  return findFirst(node, (element) => attr(element, 'data-element') === name);
}

export function textContent(node: ChildNode | ParentNode): string {
  if (node.nodeName === '#text' && 'value' in node) return node.value;
  if (!('childNodes' in node)) return '';
  return node.childNodes.map(textContent).join('');
}

export function innerHtml(node: ParentNode): string {
  return serialize(node);
}
