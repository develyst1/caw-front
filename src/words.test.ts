// REQ-011's wording table, row by row: each word is here, verbatim.
import { describe, expect, test } from "bun:test";
import { blueprintBuild, budget, card, cardMark, column, columnOrder, mode, refusedHandoff, runRunning, section, stopReason, workspace } from "./words";

describe("REQ-011 wording table", () => {
  test("columns, in the order they are drawn", () => {
    expect(columnOrder.map((c) => column[c])).toEqual(["รอทำ", "กำลังทำ", "รอตรวจ", "เสร็จ", "ติดอยู่"]);
  });
  test("card marks", () => { expect([cardMark.specChanged, cardMark.waitingAnswer]).toEqual(["spec เปลี่ยน", "รอคำตอบ"]); });
  test("mode (manual / dispatcher) and budget", () => {
    expect([mode.manual, mode.dispatcher]).toEqual(["แบบสั่งทีละขั้น", "อัตโนมัติ"]);
    expect(budget(40, 7)).toBe("งบ 40 ก้าว · ใช้ไป 7");
  });
  test("sections", () => {
    expect(Object.values(section)).toEqual(["โปรเจกต์", "บอร์ด", "ทีม", "สายงาน", "การรัน", "แชต"]);
  });
  test("card: where in the spec, hand-off, and the refused hand-off sentence", () => {
    expect([card.whereInSpec, card.handoff]).toEqual(["อยู่ตรงไหนใน spec", "ส่งต่อ"]);
    expect(refusedHandoff("มิ้นท์", "ปลา")).toBe("ส่งต่อไม่ได้: มิ้นท์ ไม่ได้อยู่ต่อจาก ปลา ในสายงาน");
  });
  test("Blueprint's Build button", () => { expect(blueprintBuild).toBe("ส่งไปสร้างที่ CAW"); });
  test("run stop reasons — one word per stopReason, none missing — and a run still going", () => {
    expect(stopReason).toEqual({
      budget_spent: "ใช้งบครบแล้ว",
      nothing_workable: "ไม่มีงานที่ทำต่อได้",
      failed_review_twice: "การ์ดนี้ไม่ผ่านตรวจสองครั้ง",
      limit_reached: "ถึงลิมิตการใช้งาน Claude",
      operator_stopped: "คุณสั่งหยุด",
      error: "หยุดเพราะเกิดข้อผิดพลาด",
    });
    expect(runRunning).toBe("กำลังรัน");
  });
  test("workspace folders: heading, add, remove, field hint, and the warning when there are none", () => {
    expect(workspace).toEqual({
      heading: "โฟลเดอร์ที่ทีมเขียนได้", add: "เพิ่มโฟลเดอร์", remove: "เอาออก", hint: "ใส่ path เต็ม เช่น /Users/…/my-repo",
      none: "ยังไม่ได้กำหนดโฟลเดอร์ — ทีมจะยังเริ่มทำงานไม่ได้",
    });
  });
});
