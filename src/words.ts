// Every user-facing word of REQ-011's table, verbatim — never typed in a screen. The operator may change any word here.
import type { CardStatus, HopOutcome, Mode, StopReason } from "@/api/caw";

/** Board columns (a card's `status`), in the order they are drawn. */
export const columnOrder: CardStatus[] = ["todo", "doing", "review", "done", "stuck"];
export const column: Record<CardStatus, string> = { todo: "รอทำ", doing: "กำลังทำ", review: "รอตรวจ", done: "เสร็จ", stuck: "ติดอยู่" };

export const cardMark = { specChanged: "spec เปลี่ยน", waitingAnswer: "รอคำตอบ" } as const;

/** The project's `mode`: manual → one step at a time, dispatcher → automatic. */
export const mode: Record<Mode, string> = { manual: "แบบสั่งทีละขั้น", dispatcher: "อัตโนมัติ" };
export const budget = (n: number, m: number) => `งบ ${n} ก้าว · ใช้ไป ${m}`;

export const section = { projects: "โปรเจกต์", board: "บอร์ด", team: "ทีม", chain: "สายงาน", runs: "การรัน", chat: "แชต" } as const;

export const card = { whereInSpec: "อยู่ตรงไหนใน spec", handoff: "ส่งต่อ" } as const;
export const refusedHandoff = (who: string, from: string) => `ส่งต่อไม่ได้: ${who} ไม่ได้อยู่ต่อจาก ${from} ในสายงาน`;

// ---- the card screen (TASK-B-041 Q2), words already approved in Blueprint, same meaning — SA-B 2026-10-13: use now ----
/** A spec part's kind (Blueprint `partKind`). */
export const partKind: Record<string, string> = {
  work: "งาน", step: "ขั้นตอน", interaction: "การโต้ตอบ", role: "คน", screen: "หน้าจอ", api: "API", system: "ระบบ", data: "ข้อมูล",
  decision: "การตัดสินใจ", question: "คำถาม",
};
/** How a neighbour is linked to the part, read from the part (`out`) or towards it (`in`) — Blueprint `linkKind`. */
export const linkKind: Record<string, { out: string; in: string }> = {
  has_step: { out: "มีขั้นตอน", in: "เป็นขั้นตอนของ" },
  next: { out: "ไปต่อที่", in: "มาจาก" },
  has_interaction: { out: "มีการโต้ตอบ", in: "อยู่ในขั้นตอน" },
  from: { out: "ส่งโดย", in: "เป็นผู้ส่งใน" },
  to: { out: "ส่งถึง", in: "เป็นผู้รับใน" },
  carries: { out: "ส่งข้อมูล", in: "ถูกส่งใน" },
  reads: { out: "อ่าน", in: "ถูกอ่านโดย" },
  writes: { out: "เขียน", in: "ถูกเขียนโดย" },
  shows: { out: "แสดง", in: "แสดงอยู่ใน" },
  covers: { out: "ใช้กับ", in: "ถูกกำหนดโดย" },
  about: { out: "ถามเรื่อง", in: "มีคำถาม" },
};
export const linkedWith = "เชื่อมกับ";
export const toSpec = "ดู spec";       // opens the part in Blueprint
export const operatorName = "คุณ";     // the operator as an actor in a timeline
export const send = "ส่ง";
export const proposedAnswer = "คำตอบที่เสนอ";
export const acceptAnswer = "ตามนั้น";
export const answerOwn = "ตอบเอง…";

// ---- the card screen, REQ-011 table rows added by the PM 2026-10-13 (TASK-B-041 Q2) ----
export const decisionsHeading = "เรื่องที่ตัดสินแล้ว";
export const todoHeading = "ต้องทำอะไร";
export const timelineHeading = "ความเคลื่อนไหว";
export const handoffLine = (from: string, to: string) => `${from} ส่งต่อให้ ${to}`;
export const dependsOnHeading = "ต้องรอการ์ดเหล่านี้ก่อน";
export const commentPlaceholder = "เขียนความเห็น…";
export const statusLabel = "สถานะ";
export const assigneeLabel = "ผู้รับงาน";

// ---- a card action the back end refused — REQ-011 rows added by the PM 2026-10-13 (TASK-B-041 Q3) ----
// (not_a_member cannot happen: re-assign lists only the chain's members; `กำลังทำ` is disabled while a dependency is open)
export const cardRefused: Record<string, string> = {
  waiting_on_question: "ยังเริ่มไม่ได้ ต้องรอการ์ดเหล่านี้ก่อน",
  already_answered: "คำถามนี้ตอบไปแล้ว",
  unreachable: "ต่อระบบไม่ได้ตอนนี้", // = startRefused.unreachable, Blueprint's own sentence
  other: "ทำไม่สำเร็จ ลองอีกครั้ง",
};

// ---- the team + chain screen (TASK-B-042 Q1) — carried-over: `โมเดล` (Blueprint chat), `เอาออก` (workspace.remove), `ยกเลิก`
// (Blueprint chat), `ส่งต่อให้` (handoffLine); the rest are REQ-011 rows added by the PM 2026-10-14 (TASK-B-042 Q1). ----
export const team = {
  name: "ชื่อ",                                  
  role: "บทบาท",                                 
  model: "โมเดล",                                 // carried-over
  effort: "ความลึกในการคิด",                      
  skills: "สกิล",                                 
  skillsHint: "ใส่หลายสกิลคั่นด้วยจุลภาค",          
  roleOther: "อื่นๆ",                              // the `other` role
  effortLevel: { low: "น้อย", medium: "กลาง", high: "มาก" } as Record<string, string>,
  addWorker: "เพิ่มคนทำงาน",                       // the form's heading and its button
  combine: "รวมสองคน",                            
  combinePick: (n: number) => `คนที่ ${n}`,          // the two picks in combine (PM 2026-10-14)
  combinedName: "ชื่อคนที่รวมแล้ว",                 
  combinedFrom: (a: string, b: string) => `รวมจาก ${a} กับ ${b}`,
  addToChain: "เพิ่มเข้าสายงาน",                   
  remove: "เอาออก",                                // carried-over (workspace.remove)
  cancel: "ยกเลิก",                                // carried-over (Blueprint chat)
  entry: "รับงานคนแรก",                            // the entry worker's mark
  setEntry: "ให้รับงานคนแรก",                      
  pickHint: "กดคนส่ง แล้วกดคนรับ เพื่อเพิ่มเส้นส่งต่อ",
  from: "คนส่ง",                                   // the edge form's two fields
  to: "คนรับ",                                    
  addEdge: "เพิ่มเส้นส่งต่อ",                      
  removeEdge: "ลบเส้นนี้",                         
  reassign: (name: string, n: number) => `${name} ยังถือการ์ดอยู่ ${n} ใบ ให้ใครรับต่อ`,
} as const;
/** A team/chain write the back end refused — REQ-011 rows added by the PM 2026-10-14 (TASK-B-042 Q1); `other` = cardRefused.other. */
export const teamRefused: Record<string, string> = {
  name_taken: "มีคนชื่อนี้แล้ว",
  edge_exists: "มีเส้นนี้อยู่แล้ว",
  is_entry: "เอาคนที่รับงานคนแรกออกไม่ได้ ให้คนอื่นรับงานคนแรกก่อน",
  validation: "ข้อมูลยังไม่ครบ",
  unreachable: "ต่อระบบไม่ได้ตอนนี้",
  other: "ทำไม่สำเร็จ ลองอีกครั้ง",
};

/** The label of Blueprint's Build button (screen ④) once it opens CAW — it was "CAW ยังไม่พร้อม". */
export const blueprintBuild = "ส่งไปสร้างที่ CAW";

/** A run's `stopReason` (same words as REQ-012), and the word for a run that has not stopped. */
export const stopReason: Record<StopReason, string> = {
  budget_spent: "ใช้งบครบแล้ว",
  nothing_workable: "ไม่มีงานที่ทำต่อได้",
  failed_review_twice: "การ์ดนี้ไม่ผ่านตรวจสองครั้ง",
  limit_reached: "ถึงลิมิตการใช้งาน Claude",
  operator_stopped: "คุณสั่งหยุด",
  error: "หยุดเพราะเกิดข้อผิดพลาด",
};
export const runRunning = "กำลังรัน";
/** Switching to อัตโนมัติ while a run is still open (REQ-011 table, TASK-B-047 DEF-2) — nothing changes. */
export const runStillOpen = "ยังมีการรันที่ค้างอยู่ — รอให้จบหรือสั่งหยุดก่อน";
/** Stop the open run (REQ-011 table "Stop an open run", D-056, TASK-B-055). */
export const stopThisRun = "หยุดการรันนี้";
/** Mode อัตโนมัติ whose run has stopped (REQ-011 row added by the PM 2026-10-14, TASK-B-047 D-052): the reason and how to start again. */
export const runStopped = (reason: string) => `การรันหยุดแล้ว: ${reason} · กด อัตโนมัติ เพื่อเริ่มรอบใหม่`;

// ---- the chat panel (TASK-B-050): REQ-013's table; carried-over from Blueprint: `กด Enter เพื่อส่ง` (its chat), plus `send`,
// `proposedAnswer`, `operatorName`, `partKind` above; the rest REQ-013 "Chat page" rows (PM 2026-10-14, TASK-B-050 Q1) ----
export const chat = {
  createCards: "สร้างการ์ด",                                                  // REQ-013
  failed: "ทีมยังตอบข้อความนี้ไม่ได้",                                          // REQ-013 (D-057)
  retry: "ลองอีกครั้ง",                                                       // REQ-013 (D-057)
  estimate: (n: number, h: number) => `${n} งาน ใช้ประมาณ ${h} ก้าว`,           // REQ-013
  notInSpec: "เรื่องนี้ยังไม่มีใน spec — ส่งไปเพิ่มใน Blueprint แล้ว",           // REQ-013
  enterHint: "กด Enter เพื่อส่ง",                                              // carried-over (Blueprint chat)
  placeholder: "เล่างานให้ทีมฟัง…",                                             // REQ-013 (PM 2026-10-14) — the box (and its accessible name)
  empty: "ยังไม่มีข้อความ — เล่างานให้ทีมฟังได้เลย",                             // REQ-013 (PM 2026-10-14) — an empty thread
  waitsFor: (items: string) => `รอข้อ ${items} ก่อน`,                            // REQ-013 (PM 2026-10-14) — an item's dependencies, by their numbers
  superseded: "ข้อเสนอเก่า — มีข้อเสนอใหม่แทนแล้ว",                             // REQ-013 (PM 2026-10-14) — a superseded proposal (no button)
  accepted: "สร้างการ์ดแล้ว",                                                  // REQ-013 (PM 2026-10-14) — an accepted proposal
  openAmendment: "ดูใน Blueprint",                                             // REQ-013 (PM 2026-10-14) — the amendment's link
} as const;
/** A chat write the back end refused — REQ-013 (PM 2026-10-14); `other` = cardRefused.other. */
export const chatRefused: Record<string, string> = {
  not_open: "ข้อเสนอนี้ปิดไปแล้ว",
  anchor_not_in_version: "บางงานในข้อเสนอนี้ไม่มีใน spec เวอร์ชันนี้แล้ว — สร้างการ์ดไม่ได้",
  validation: "ข้อความยาวเกินไป หรือยังว่างอยู่",
  unreachable: "ต่อระบบไม่ได้ตอนนี้",
  other: "ทำไม่สำเร็จ ลองอีกครั้ง",
};

/** The project's workspace folders (`workspace.roots`) — the folders the team may write in. */
export const workspace = {
  heading: "โฟลเดอร์ที่ทีมเขียนได้",
  add: "เพิ่มโฟลเดอร์",
  remove: "เอาออก",
  hint: "ใส่ path เต็ม เช่น /Users/…/my-repo",
  none: "ยังไม่ได้กำหนดโฟลเดอร์ — ทีมจะยังเริ่มทำงานไม่ได้",
} as const;

// ---- the projects list and the start page (TASK-B-040 Q1: the PM approved them 2026-10-13; the card's version line is hers) ----
/** The projects list. `เสร็จ` and `ติดอยู่` are the table's column words. */
export const projectCard = {
  blueprintVersion: (n: number) => `spec เวอร์ชัน ${n}`,
  done: (done: number, total: number) => `เสร็จ ${done} จาก ${total}`,
  stuck: (n: number) => `ติดอยู่ ${n}`,
  none: "ยังไม่มีโปรเจกต์ — เริ่มจากปุ่ม ส่งไปสร้างที่ CAW ในหน้าพร้อมสร้างของ Blueprint",
} as const;

/** On sample data (CAW_API=mock), every page says so (REQ-011 l.59, D-058). */
export const sampleData = "ข้อมูลตัวอย่าง — ไม่ได้ต่อกับ CAW จริง";
/** After the mark (REQ-011 l.60, TASK-B-060); the command part is shown as code. */
export const sampleDataHint = "ใช้ข้อมูลจริง: bun run dev:http";

/** The start-project page, when it cannot start. `apiDown` is Blueprint's own sentence, so the two apps say it the same way. */
export const startRefused = {
  blueprint_project_not_found: "ไม่พบโปรเจกต์นี้ใน Blueprint",
  version_not_confirmed: "เวอร์ชันนี้ยังไม่ได้ยืนยันใน Blueprint",
  unreachable: "ต่อระบบไม่ได้ตอนนี้",
  incomplete: "ลิงก์นี้ไม่ครบ ต้องมีโปรเจกต์และเวอร์ชัน",
  other: "เริ่มโปรเจกต์ไม่สำเร็จ",
} as const;

// ---- the runs screen (TASK-B-043 Q1: the PM approved them 2026-10-13; the outcomes `commented` and `stopped` are hers, as in REQ-012) ----
/** The runs screen. `ก้าว` is the table's own unit (งบ {n} ก้าว), `แบบสั่งทีละขั้น` is the manual group's heading, `กำลังรัน` the table's. */
export const runWords = {
  none: "ยังไม่มีการรัน",
  hops: (n: number) => `${n} ก้าว`,
  tokens: (n: number) => `${n.toLocaleString("en-US")} โทเค็น`,
  tokensInOut: (tokensIn: number, tokensOut: number) => `เข้า ${tokensIn.toLocaleString("en-US")} · ออก ${tokensOut.toLocaleString("en-US")}`,
  /** A wall time: `2 ชั่วโมง 5 นาที`, `1 นาที 12 วินาที`, `38 วินาที` — the largest two units that are not zero. */
  duration: (ms: number) => {
    const total = Math.max(0, Math.round(ms / 1000));
    const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
    if (h > 0) return m > 0 ? `${h} ชั่วโมง ${m} นาที` : `${h} ชั่วโมง`;
    if (m > 0) return s > 0 ? `${m} นาที ${s} วินาที` : `${m} นาที`;
    return `${s} วินาที`;
  },
} as const;

/** What a hop ended in (`outcome`). `handed_off` is the table's `ส่งต่อ`. */
export const hopOutcome: Record<HopOutcome, string> = {
  commented: "แสดงความเห็น", handed_off: "ส่งต่อ", status: "เปลี่ยนสถานะ", asked: "ถามคุณ", failed: "ไม่สำเร็จ", stopped: "หยุดไว้", interrupted: "ถูกขัดจังหวะ",
};
