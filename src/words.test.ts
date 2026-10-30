// REQ-011's wording table, row by row: each word is here, verbatim.
import { describe, expect, test } from "bun:test";
import { agreeStart, chatRefused, redesign, blueprintBuild, budget, card, cardMark, chatWaits, codeMapWords, distill, folderKind, labelWords, oneAnswer, column, columnOrder, hopOutcome, mode, projectCard, refusedHandoff, runRunning, runWords, screen, section, startRefused, stopReason, workspace } from "./words";

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
      heading: "โฟลเดอร์ของทีม", add: "เพิ่มโฟลเดอร์", remove: "เอาออก", hint: "ใส่ path เต็ม เช่น /Users/…/my-repo",
      none: "ยังไม่ได้กำหนดโฟลเดอร์ — ทีมจะยังเริ่มทำงานไม่ได้",
    });
  });

  // the projects list and start page words (approved by the PM, TASK-B-040 Q1) — pinned so a change is a decision, not an accident
  test("the projects list's words", () => {
    expect([projectCard.done(3, 12), projectCard.stuck(4)]).toEqual(["เสร็จ 3 จาก 12", "ติดอยู่ 4"]);
    expect(projectCard.none).toBe("ยังไม่มีโปรเจกต์ — เริ่มจากปุ่ม ส่งไปสร้างที่ CAW ในหน้าพร้อมสร้างของ Blueprint");
  });
  test("the start page's refusals", () => {
    expect(startRefused).toEqual({
      blueprint_project_not_found: "ไม่พบโปรเจกต์นี้ใน Blueprint",
      unreachable: "ต่อระบบไม่ได้ตอนนี้", incomplete: "ลิงก์นี้ไม่ครบ ต้องมีโปรเจกต์", other: "เริ่มโปรเจกต์ไม่สำเร็จ", // REQ-105 Q3: no version in the link, none refused
    });
  });
  test("REQ-105: the label words (PM, REQ-105 § User-facing wording and Q4) — pinned", () => {
    expect([labelWords.tag("ฉบับร่างแรก"), labelWords.none, labelWords.cutAt("ฉบับร่างแรก"), labelWords.cutBefore]).toEqual(["ป้าย ฉบับร่างแรก", "ยังไม่มีป้าย", "ตัดงานที่ป้าย ฉบับร่างแรก", "ตัดงานก่อนมีป้าย"]);
    expect([labelWords.tagOf({ version: 3, label: null }), labelWords.tagOf({ version: 1, label: "v1" })]).toEqual(["ป้าย 3", "ป้าย v1"]); // Q6: no name → the version
    expect(labelWords.blueprintUnreachable).toBe("ติดต่อ Blueprint ไม่ได้ตอนนี้ — ทำงานต่อจาก spec ล่าสุดที่อ่านได้");
    expect(labelWords.anchorRemoved).toBe("ส่วนนี้ถูกลบออกจาก spec แล้ว — งานนี้ทำต่อไม่ได้จนกว่าจะย้ายไปส่วนอื่นหรือปิดงาน");
    expect(chatRefused.anchor_not_in_version).toBe("บางงานในข้อเสนอนี้ไม่มีใน spec แล้ว — เริ่มงานไม่ได้");
  });

  // the runs screen's words (approved by the PM, TASK-B-043 Q1) — pinned
  test("the runs screen's words: units, durations, outcomes", () => {
    expect([runWords.none, runWords.hops(3), runWords.tokens(10300), runWords.tokensInOut(4500, 1600)]).toEqual(["ยังไม่มีการรัน", "3 ก้าว", "10,300 โทเค็น", "เข้า 4,500 · ออก 1,600"]);
    expect([0, 38_000, 60_000, 72_000, 3_600_000, 7_500_000, 90_000].map(runWords.duration)).toEqual(
      ["0 วินาที", "38 วินาที", "1 นาที", "1 นาที 12 วินาที", "1 ชั่วโมง", "2 ชั่วโมง 5 นาที", "1 นาที 30 วินาที"]);
    expect(hopOutcome).toEqual({ commented: "แสดงความเห็น", handed_off: "ส่งต่อ", status: "เปลี่ยนสถานะ", asked: "ถามคุณ", failed: "ไม่สำเร็จ", stopped: "หยุดไว้", interrupted: "ถูกขัดจังหวะ" });
  });
});

describe("D-094 § 0 — the board's chat notice, as approved", () => {
  test("{entry} รอคุณอยู่ในแชต · ไปที่แชต", () => {
    expect(chatWaits.line("Paul")).toBe("Paul รอคุณอยู่ในแชต");
    expect(chatWaits.go).toBe("ไปที่แชต");
  });
});

describe("D-094 — the distill's other words, as approved (TASK-B-100)", () => {
  test("B-2 · C-1 · T-1 · K-4 · S-1", () => {
    expect(distill.tellEntry("Paul")).toBe("เล่างานให้ Paul ในแชต");
    expect(distill.placeholder("Paul")).toBe("เล่างานให้ Paul…");
    expect([distill.chainReady, distill.answer, distill.backToProjects]).toEqual(["สายงานพร้อม", "ตอบ", "กลับไปที่โปรเจกต์"]);
  });
});

describe("the code map's words (TASK-B-106, team-proposed until the PM's table)", () => {
  test("kinds, the empty list, confirm and the chat link", () => {
    expect(codeMapWords.kind).toEqual({ fe: "FE", be: "BE", other: "ไม่ใช่ของเรา" });
    expect([codeMapWords.none, codeMapWords.confirm, codeMapWords.fixInChat, codeMapWords.see]).toEqual(["ไม่มี", "ยืนยัน", "แก้ผ่านแชต", "ดูผังโค้ด"]);
    expect(codeMapWords.confirmed("20 ต.ค. 2569")).toBe("ยืนยันแล้ว 20 ต.ค. 2569");
  });
});

describe("folder kinds (TASK-B-108, team-proposed until the PM's table)", () => {
  test("เขียนได้ · อ่านได้อย่างเดียว · the help line", () => {
    expect([folderKind.writable, folderKind.readOnly]).toEqual(["เขียนได้", "อ่านได้อย่างเดียว"]);
    expect(folderKind.help).toBe('ทีมอ่านได้ทุกโฟลเดอร์ เขียนได้เฉพาะที่ "เขียนได้"');
  });
});

describe("D-105 P1 — one answer pair (TASK-B-119)", () => {
  test("ตามนั้นทุกข้อ · ตามนั้น — {answer} · {entry} ถาม {n} ข้อ · ตอบแล้ว (· {answer})", () => {
    expect(oneAnswer.acceptAll).toBe("ตามนั้นทุกข้อ");
    expect(oneAnswer.posted("ไม่นับ")).toBe("ตามนั้น — ไม่นับ");
    expect(oneAnswer.asks("Paul", 2)).toBe("Paul ถาม 2 ข้อ");
    expect([oneAnswer.answered("ไม่นับ"), oneAnswer.answered(null)]).toEqual(["ตอบแล้ว · ไม่นับ", "ตอบแล้ว"]);
  });
});

describe("D-105 P2 / D-106 — agree and start (TASK-B-120)", () => {
  test("ตกลง เริ่มงาน · the reason · the two mode lines · the board's line · the empty board", () => {
    expect(agreeStart.agree).toBe("ตกลง เริ่มงาน");
    expect(agreeStart.answerFirst("Paul")).toBe("ตอบคำถามของ Paul ก่อน");
    expect([agreeStart.manual(3), agreeStart.dispatcher(3)]).toEqual(["จะได้ 3 การ์ดบนบอร์ด แล้วคุณกดให้ทีละขั้น", "ทีมจะเริ่มทำ 3 การ์ดเองจนครบงบ"]);
    expect(agreeStart.waiting("Paul")).toBe("Paul เสนองานไว้ รอคุณตกลง");
    expect(redesign.emptyBoard).toBe("บอร์ดยังว่าง — การ์ดจะขึ้นที่นี่เมื่อคุณกดตกลง เริ่มงานในแชต");
  });
});

describe("D-110 — a refused proposal follows D-105's rename (TASK-B-121)", () => {
  test("anchor_not_in_version ends — เริ่มงานไม่ได้", () => {
    expect(chatRefused.anchor_not_in_version).toMatch(/— เริ่มงานไม่ได้$/);
    expect(chatRefused.anchor_not_in_version).not.toContain("สร้างการ์ด");
  });
});

describe("REQ-104 — a worker's read-only screen (the PM's wording table)", () => {
  test("every row, verbatim", () => {
    expect(screen.watch).toBe("ดูหน้าจอ");
    expect(screen.title("ฝน")).toBe("หน้าจอของ ฝน");
    expect(screen.empty).toBe("ยังไม่ได้เริ่มทำงาน");
    expect(screen.live).toBe("สด");
    expect(screen.gap(12)).toBe("ขาดช่วง 12 วินาที — ระหว่างนี้ไม่ได้รับข้อมูล");
    expect(screen.finished("14:05")).toBe("จบงานเมื่อ 14:05");
    expect(screen.started("14:00")).toBe("เริ่มเมื่อ 14:00");
    expect(screen.truncated).toBe("ยาวเกิน 5,000 บรรทัด — ส่วนที่เกินไม่ได้แสดง");
  });
});
