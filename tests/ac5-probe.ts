// The AC-5 probe (TASK-B-084, polish-plan § 2.7): the measuring code that runs INSIDE the page. `probe` is passed to `page.evaluate`, so it must be
// self-contained — no imports, no outer variables; every helper lives in its body. It reports what it measured; it fixes nothing.
//
// Rules (each failure is one `{ rule, selector, text }`):
//   text-overflow   an element's text is wider than its box (scrollWidth > clientWidth) and it has neither `text-overflow: ellipsis` + `overflow: hidden` nor a line clamp
//   truncated-no-full-text  a box cut short on purpose (ellipsis or line clamp, and really cut) whose whole text is NOT in a title / aria-label (its own or an ancestor's) or an aria-labelledby target
//   outside-clip    an element sits outside its nearest clipping ancestor, on an axis where that ancestor does NOT scroll (auto / scroll is fine)
//   svg-stroke      an SVG shape's stroke reaches outside its svg
//   svg-covered     the middle of an svg is under another node (one that is neither its ancestor nor inside it) — unless the svg is scrolled out of its own scroll box, or
//                   (TASK-B-118, D-105) the svg scrolls with the document and its cover is, or is inside, a position sticky / fixed BAR (under half the viewport tall): a pinned
//                   header or footer over scrolled content. A pinned element that covers the screen (a modal's scrim) is still a cover.
//   thai-broken     a name is split across two lines: for `[data-name]` any space-separated part of it that would fit on one line (TASK-B-089; a part wider than its box may wrap inside itself, Q1 of B-091); for the other name elements any Thai word (Intl.Segmenter('th'))
//   title-cut       (inside an open layer only) the layer's title is cut by an ellipsis or a line clamp — a drawer or dialog must show the whole of what it is about
//   page-overflow-x the page scrolls sideways
// Console errors and the stored-dark cold start are measured by the spec (they need the page's events, not its DOM).

export interface Failure { rule: string; selector: string; text: string }

/** The elements that hold a person's name: `data-name` where a screen has added it, else the `.name` class of the screens' CSS modules (class hashes keep `__name`). */
export const NAME_SELECTOR = '[data-name], [class*="__name"]';

/** `probe(nameSelector)` measures the whole page. `probe([nameSelector, root])` measures **inside `root` only** — an open dialog or sheet (D-088): the page behind it is inert
 *  and its overlay is not a defect, so nothing outside the layer is looked at (the page-level sideways-scroll rule still reads the document). */
export function probe(arg: string | [string, Element | null | undefined]): Failure[] {
  const [nameSelector, given] = typeof arg === "string" ? [arg, undefined] : arg;
  const scope: Element = given ?? document.body;
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
  const add = (rule: string, el: Element, text = textOf(el)) => {
    const f = { rule, selector: short(el), text };
    const key = `${f.rule}|${f.selector}|${f.text}`;
    if (!seen.has(key)) { seen.add(key); out.push(f); }
  };
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && cs.position !== "fixed";
  };
  const all = [...scope.querySelectorAll("*")].filter((el) => !el.closest("svg") && shown(el));

  // 1 · text wider than its box — and, when a box is cut short ON PURPOSE, its whole text must still be there for the reader
  const norm = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
  /** the text a screen reader or a hover can reach: the element's own title / aria-label, an ancestor's, or what its aria-labelledby points to */
  const carriers = (el: Element): string[] => {
    const out: string[] = [];
    const own = el.closest("[title], [aria-label]");
    if (own) out.push(norm(own.getAttribute("title")), norm(own.getAttribute("aria-label")));
    const by = el.closest("[aria-labelledby]")?.getAttribute("aria-labelledby");
    if (by) for (const id of by.split(/\s+/)) { const t = document.getElementById(id); if (t) out.push(norm(t.textContent), norm(t.getAttribute("aria-label")), norm(t.getAttribute("title"))); }
    return out;
  };
  for (const el of all) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim())) continue;
    if (el.clientWidth <= 0) continue;
    const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitLineClamp?: string };
    const ellipsis = cs.textOverflow === "ellipsis" && (cs.overflowX === "hidden" || cs.overflowX === "clip");
    const clamp = !!cs.webkitLineClamp && cs.webkitLineClamp !== "none" && cs.overflow !== "visible";
    if (ellipsis || clamp) {
      const cut = ellipsis ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1;
      const whole = norm(el.textContent);
      if (cut && whole && !carriers(el).some((c) => c.includes(whole))) add("truncated-no-full-text", el);
      continue; // truncated on purpose: not a text-overflow
    }
    if (el.scrollWidth > el.clientWidth + 1) add("text-overflow", el);
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
    // an inline element's box is its FONT's box (a Thai font's ascent + descent), taller than a tight line box: against a clipping parent it overshoots by a few px with nothing
    // cut — so the vertical axis is judged on the block / inline-block boxes and on the lines themselves, not on an inline wrapper
    const inline = getComputedStyle(el).display === "inline";
    const outX = clips(cs.overflowX) && (er.left < ar.left - 1 || er.right > ar.right + 1);
    const outY = !inline && clips(cs.overflowY) && (er.top < ar.top - 1 || er.bottom > ar.bottom + 1);
    if (outX || outY) add("outside-clip", el);
  }

  // 3 · svg strokes and what covers an svg
  for (const svg of scope.querySelectorAll("svg")) {
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
    // an svg scrolled out of its OWN scroll box is scrolled away, not covered: its centre then lies over whatever sits outside the box (a panel head). Skip it when the
    // centre is outside the box's visible rectangle (the box's rect cut to the viewport); an svg in view, or in no scroll box at all, is measured as before
    let scroller: Element | null = svg.parentElement;
    while (scroller && scroller !== document.documentElement) {
      const cs = getComputedStyle(scroller);
      if (/auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY)) break;
      scroller = scroller.parentElement;
    }
    if (scroller && scroller !== document.documentElement) {
      const b = scroller.getBoundingClientRect();
      const left = Math.max(b.left, 0), top = Math.max(b.top, 0), right = Math.min(b.right, innerWidth), bottom = Math.min(b.bottom, innerHeight);
      if (cx < left || cx > right || cy < top || cy > bottom) continue;
    }
    if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
      for (const top of document.elementsFromPoint(cx, cy)) {
        if (top === svg || svg.contains(top) || top.contains(svg)) break; // reached the svg (or something that holds it) first: nothing is on top of it
        if (getComputedStyle(top).pointerEvents === "none") continue;
        // TASK-B-118: when the DOCUMENT is the svg's scroll box (no own scroller above), a pinned BAR (sticky / fixed, under half the viewport tall) over it is the page
        // scrolled, not a cover; a pinned element as tall as the screen (a modal's scrim) still covers
        if (!scroller || scroller === document.documentElement) {
          let bar = false;
          for (let e: Element | null = top; e && e !== document.documentElement; e = e.parentElement) {
            const p = getComputedStyle(e).position;
            if (p === "sticky" || p === "fixed") { bar = e.getBoundingClientRect().height < innerHeight / 2; break; }
          }
          if (bar) break;
        }
        add("svg-covered", svg, `under ${short(top)}`); // what covers it, in place of the svg's (empty) text
        break;
      }
    }
  }

  // 4 · a name split across two lines. For `[data-name]` the reader's word is each space-separated PART of the name (`Intl.Segmenter` would split a compound Thai
  // surname into dictionary words, so a browser wrapping inside the surname would pass): every part must stay on one line. The other name elements the selector
  // matches (the screens' `__name` class, no `data-name` yet) keep the word-by-word check with `Intl.Segmenter('th')`.
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  /** the width of `text` on ONE line, in `el`'s own font — measured with a throw-away nowrap span inside it */
  const oneLineWidth = (el: Element, text: string) => {
    const ruler = document.createElement("span");
    ruler.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0";
    ruler.textContent = text;
    el.appendChild(ruler);
    const w = ruler.getBoundingClientRect().width;
    ruler.remove();
    return w;
  };
  /** the width the name's lines can use: the content box of the nearest block box (an inline wrapper has none of its own) */
  const contentWidth = (el: Element) => {
    let box: Element | null = el;
    while (box && getComputedStyle(box).display === "inline") box = box.parentElement;
    if (!box) return el.getBoundingClientRect().width;
    const cs = getComputedStyle(box);
    return box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  };
  /** the line boxes of a character range are on more than one line */
  const onTwoLines = (node: Node, start: number, end: number) => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    return rects.length > 1 && Math.max(...rects.map((r) => r.top)) - Math.min(...rects.map((r) => r.top)) > Math.min(...rects.map((r) => r.height)) * 0.5;
  };
  for (const el of scope.querySelectorAll(nameSelector)) {
    if (!shown(el)) continue;
    const byPart = el.hasAttribute("data-name");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let broken = false;
    for (let node = walker.nextNode(); node && !broken; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (byPart) {
        for (const part of text.matchAll(/\S+/g)) {
          if (!onTwoLines(node, part.index!, part.index! + part[0].length)) continue;
          // a part that is wider than the box even on ONE line cannot fit anywhere: it may wrap inside itself as a last resort (`overflow-wrap: anywhere`, polish-plan § 2.4).
          // Every part that would fit on one line must not wrap.
          if (oneLineWidth(el, part[0]) > contentWidth(el) + 0.5) continue;
          broken = true; break;
        }
      } else {
        for (const seg of segmenter.segment(text)) {
          if (!seg.isWordLike || !/[฀-๿]/.test(seg.segment)) continue;
          if (onTwoLines(node, seg.index, seg.index + seg.segment.length)) { broken = true; break; }
        }
      }
    }
    if (broken) add("thai-broken", el);
  }

  // 4b · the TITLE of an open layer is not cut (only when measuring inside a layer): what `aria-labelledby` names, else the first heading. An ellipsis with an accessible name passes
  // `truncated-no-full-text` for a list row; for the title of a drawer or dialog the whole text must be on screen (D-088, DEF-3: the person drawer at 390 showed "วิริยะกุลพัฒ…")
  if (given) {
    const named = given.getAttribute("aria-labelledby");
    const title = (named ? document.getElementById(named.split(/\s+/)[0]!) : null) ?? given.querySelector("h1, h2, h3, [role=heading]");
    if (title && shown(title)) {
      for (const el of [title, ...title.querySelectorAll("*")]) {
        if (!shown(el)) continue;
        const cs = getComputedStyle(el) as CSSStyleDeclaration & { webkitLineClamp?: string };
        const ellipsis = cs.textOverflow === "ellipsis" && (cs.overflowX === "hidden" || cs.overflowX === "clip");
        const clamp = !!cs.webkitLineClamp && cs.webkitLineClamp !== "none" && cs.overflow !== "visible";
        // a clamp is cut when a whole line or more is hidden (the line box overshoots by a pixel or two: not a cut)
        const cut = (ellipsis && el.scrollWidth > el.clientWidth + 1) || (clamp && el.scrollHeight > el.clientHeight + parseFloat(cs.fontSize) * 0.5);
        if (cut) { add("title-cut", title); break; }
      }
    }
  }

  // 5 · the page scrolls sideways
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) add("page-overflow-x", document.documentElement);

  return out;
}
