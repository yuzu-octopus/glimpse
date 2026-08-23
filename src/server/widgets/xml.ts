export function getBXML(): { parse(s: string): unknown } {
  const b = (globalThis as unknown as { Bun?: { XML?: { parse(s: string): unknown } } }).Bun?.XML;
  if (b) return b;
  // src/test/setup.ts polyfills Bun.XML for vitest; this DOMParser fallback
  // only runs on plain Node without the Bun runtime.
  return { parse: fallbackXmlParse };
}

export function fallbackXmlParse(xml: string): unknown {
  const DP = (globalThis as unknown as { DOMParser?: new () => { parseFromString(s: string, t: string): Document } }).DOMParser;
  if (!DP) throw new Error('Bun.XML not available and DOMParser missing');
  const doc = new DP().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root) return {};
  const out: Record<string, unknown> = {};
  out[root.tagName] = domToObj(root);
  return out;
}

export function domToObj(el: Element): unknown {
  const obj: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) obj[`@${attr.name}`] = attr.value;
  const children = Array.from(el.children);
  if (children.length === 0) {
    const text = el.textContent?.trim() ?? '';
    if (Object.keys(obj).length === 0) return text || '';
    if (text) obj['#text'] = text;
    return obj;
  }
  for (const child of children) {
    const val = domToObj(child);
    const key = child.tagName;
    if (key in obj) {
      const existing = obj[key];
      if (Array.isArray(existing)) (existing as unknown[]).push(val);
      else obj[key] = [existing, val];
    } else obj[key] = val;
  }
  // preserve text if mixed content (richer behavior)
  const textNodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent?.trim());
  if (textNodes.length && children.length) {
    const t = textNodes.map((n) => n.textContent!.trim()).join(' ');
    if (t) obj['#text'] = t;
  }
  return obj;
}
