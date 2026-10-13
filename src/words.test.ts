// REQ-011's wording table, row by row: each word is here, verbatim.
import { describe, expect, test } from "bun:test";
import { blueprintBuild, budget, card, cardMark, column, columnOrder, hopOutcome, mode, projectCard, refusedHandoff, runRunning, runWords, section, startRefused, stopReason, workspace } from "./words";

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

  // the projects list and start page words (approved by the PM, TASK-B-040 Q1) — pinned so a change is a decision, not an accident
  test("the projects list's words", () => {
    expect([projectCard.blueprintVersion(3), projectCard.done(3, 12), projectCard.stuck(4)]).toEqual(["spec เวอร์ชัน 3", "เสร็จ 3 จาก 12", "ติดอยู่ 4"]);
    expect(projectCard.none).toBe("ยังไม่มีโปรเจกต์ — เริ่มจากปุ่ม ส่งไปสร้างที่ CAW ในหน้าพร้อมสร้างของ Blueprint");
  });
  test("the start page's refusals", () => {
    expect(startRefused).toEqual({
      blueprint_project_not_found: "ไม่พบโปรเจกต์นี้ใน Blueprint", version_not_confirmed: "เวอร์ชันนี้ยังไม่ได้ยืนยันใน Blueprint",
      unreachable: "ต่อระบบไม่ได้ตอนนี้", incomplete: "ลิงก์นี้ไม่ครบ ต้องมีโปรเจกต์และเวอร์ชัน", other: "เริ่มโปรเจกต์ไม่สำเร็จ",
    });
  });

  // the runs screen's words (approved by the PM, TASK-B-043 Q1) — pinned
  test("the runs screen's words: units, durations, outcomes", () => {
    expect([runWords.none, runWords.hops(3), runWords.tokens(10300), runWords.tokensInOut(4500, 1600)]).toEqual(["ยังไม่มีการรัน", "3 ก้าว", "10,300 โทเค็น", "เข้า 4,500 · ออก 1,600"]);
    expect([0, 38_000, 60_000, 72_000, 3_600_000, 7_500_000, 90_000].map(runWords.duration)).toEqual(
      ["0 วินาที", "38 วินาที", "1 นาที", "1 นาที 12 วินาที", "1 ชั่วโมง", "2 ชั่วโมง 5 นาที", "1 นาที 30 วินาที"]);
    expect(hopOutcome).toEqual({ commented: "แสดงความเห็น", handed_off: "ส่งต่อ", status: "เปลี่ยนสถานะ", asked: "ถามคุณ", failed: "ไม่สำเร็จ", stopped: "หยุดไว้", interrupted: "ถูกขัดจังหวะ" });
  });
});
