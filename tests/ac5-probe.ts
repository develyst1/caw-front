// The AC-5 probe (TASK-B-084, polish-plan § 2.7): the measuring code that runs INSIDE the page. `probe` is passed to `page.evaluate`, so it must be
// self-contained — no imports, no outer variables; every helper lives in its body. It reports what it measured; it fixes nothing.
//
// Rules (each failure is one `{ rule, selector, text }`):
//   text-overflow   an element's text is wider than its box (scrollWidth > clientWidth) and it has neither `text-overflow: ellipsis` + `overflow: hidden` nor a line clamp
//   outside-clip    an element sits outside its nearest clipping ancestor, on an axis where that ancestor does NOT scroll (auto / scroll is fine)
//   svg-stroke      an SVG shape's stroke reaches outside its svg
//   svg-covered     the middle of an svg is under another node (one that is neither its ancestor nor inside it)
//   thai-broken     a Thai word of a name element is split across two lines (Intl.Segmenter('th') against the client rects of each word)
//   page-overflow-x the page scrolls sideways
// Console errors and the stored-dark cold start are measured by the spec (they need the page's events, not its DOM).

export interface Failure { rule: string; selector: string; text: string }

/** The elements that hold a person's name: `data-name` where a screen has added it, else the `.name` class of the screens' CSS modules (class hashes keep `__name`). */
export const NAME_SELECTOR = '[data-name], [class*="__name"]';

export function probe(nameSelector: string): Failure[] {
  const out: Failure[] = [];
  const seen = new Set<string>();
  const short = (el: Element): string => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).map((c) => `.${c.replace(/^.*__/, "")}`).join("") : "";
    const data = [...el.attributes].filter((a) => a.name.startsWith("data-")).slice(0, 1).map((a) => `[${a.name}]`).join("");
    return `${tag}${id}${cls}${data}`;
  };
  const textOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const add = (rule: string, el: Element) => {
    const f = { rule, selector: short(el), text: textOf(el) };
    const key = `${f.rule}|${f.selector}|${f.text}`;
    if (!seen.has(key)) { seen.add(key); out.push(f); }
  };
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && cs.position !== "fixed";
  };
  const all = [...document.body.querySelectorAll("*")].filter((el) => !el.closest("svg") && shown(el));

  // 1 · text wider than its box
  for (const el of all) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim())) continue;
    if (el.clientWidth <= 0 || el.scrollWidth <= el.clientWidth + 1) continue;
    const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitLineClamp?: string };
    const ellipsis = cs.textOverflow === "ellipsis" && (cs.overflowX === "hidden" || cs.overflowX === "clip");
    const clamp = !!cs.webkitLineClamp && cs.webkitLineClamp !== "none" && cs.overflow !== "visible";
    if (ellipsis || clamp) continue; // truncated on purpose; its full text stays in the DOM / accessible name
    add("text-overflow", el);
  }

  // 2 · outside the nearest clipping ancestor
  for (const el of all) {
    let a = el.parentElement;
    while (a && a !== document.documentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") break;
      a = a.parentElement;
    }
    if (!a || a === document.documentElement || a === document.body) continue;
    const cs = getComputedStyle(a), er = el.getBoundingClientRect(), ar = a.getBoundingClientRect();
    const clips = (v: string) => v === "hidden" || v === "clip"; // auto / scroll scroll on that axis: not a clip
    const outX = clips(cs.overflowX) && (er.left < ar.left - 1 || er.right > ar.right + 1);
    const outY = clips(cs.overflowY) && (er.top < ar.top - 1 || er.bottom > ar.bottom + 1);
    if (outX || outY) add("outside-clip", el);
  }

  // 3 · svg strokes and what covers an svg
  for (const svg of document.querySelectorAll("svg")) {
    if (!shown(svg)) continue;
    const sr = svg.getBoundingClientRect();
    const vb = svg.viewBox?.baseVal;
    const scale = vb && vb.width > 0 ? sr.width / vb.width : 1;
    for (const shape of svg.querySelectorAll("path, line, circle, rect, polyline, polygon, ellipse")) {
      const cs = getComputedStyle(shape);
      if (cs.stroke === "none" || !(parseFloat(cs.strokeWidth) > 0)) continue;
      const r = shape.getBoundingClientRect(), half = (parseFloat(cs.strokeWidth) * scale) / 2;
      if (r.left - half < sr.left - 0.5 || r.right + half > sr.right + 0.5 || r.top - half < sr.top - 0.5 || r.bottom + half > sr.bottom + 0.5) { add("svg-stroke", svg); break; }
    }
    const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
    if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
      for (const top of document.elementsFromPoint(cx, cy)) {
        if (top === svg || svg.contains(top) || top.contains(svg)) break; // reached the svg (or something that holds it) first: nothing is on top of it
        if (getComputedStyle(top).pointerEvents === "none") continue;
        add("svg-covered", svg);
        break;
      }
    }
  }

  // 4 · a Thai word split across two lines
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  for (const el of document.querySelectorAll(nameSelector)) {
    if (!shown(el)) continue;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      for (const seg of segmenter.segment(text)) {
        if (!seg.isWordLike || !/[฀-๿]/.test(seg.segment)) continue;
        const range = document.createRange();
        range.setStart(node, seg.index);
        range.setEnd(node, seg.index + seg.segment.length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        if (rects.length > 1 && Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top)) > Math.min(...rects.map((r) => r.height)) * 0.5) { add("thai-broken", el); break; }
      }
    }
  }

  // 5 · the page scrolls sideways
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) add("page-overflow-x", document.documentElement);

  return out;
}
