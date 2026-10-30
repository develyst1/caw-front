// REQ-112 (TASK-122): the uncovered-parts notice — the PM's sentence per part, the key linked, nothing for an empty list.
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { uncovered } from "@/words";
import { Uncovered } from "./Uncovered";

const item = (key: string, title: string) => ({ key, title, href: `http://bp.test/p/x/web?part=${key}` });

describe("Uncovered", () => {
  test("the PM's sentence, as written (SPEC-109 D3)", () => {
    expect(uncovered.part("STEP-002 เลือกห้องและเวลา")).toBe("ส่วนนี้ใน spec ยังไม่มีงานไหนรับไป: STEP-002 เลือกห้องและเวลา");
  });
  test("an empty list renders nothing", () => {
    expect(renderToStaticMarkup(<Uncovered items={[]} />)).toBe("");
  });
  test("one line per part: the sentence's words, the key as the Blueprint link, then the title", () => {
    const html = renderToStaticMarkup(<Uncovered items={[item("STEP-002", "เลือกห้องและเวลา"), item("API-003", "อนุมัติ <การจอง>")]} />);
    expect(html.match(/data-uncovered-part=/g)).toHaveLength(2);
    expect(html).toContain(`<span>${uncovered.lead}</span> <a href="http://bp.test/p/x/web?part=STEP-002"`);
    expect(html).toContain(">STEP-002</a> <span");
    expect(html).toContain("เลือกห้องและเวลา");
    expect(html).toContain("อนุมัติ &lt;การจอง&gt;"); // a title is text, never markup
    // the visible words of each line are exactly the PM's sentence with {part} = key + title
    const text = (html.match(/<li[^>]*>(.*?)<\/li>/g) ?? []).map((l) => l.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()); // tags removed with nothing put in their place: the spaces must be in the text itself
    expect(text[0]).toBe(uncovered.part("STEP-002 เลือกห้องและเวลา"));
  });
});
