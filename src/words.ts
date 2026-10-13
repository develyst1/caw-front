// Every user-facing word of REQ-011's table, verbatim — never typed in a screen. The operator may change any word here.
import type { CardStatus, Mode, StopReason } from "@/api/caw";

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

/** The project's workspace folders (`workspace.roots`) — the folders the team may write in. */
export const workspace = {
  heading: "โฟลเดอร์ที่ทีมเขียนได้",
  add: "เพิ่มโฟลเดอร์",
  remove: "เอาออก",
  hint: "ใส่ path เต็ม เช่น /Users/…/my-repo",
  none: "ยังไม่ได้กำหนดโฟลเดอร์ — ทีมจะยังเริ่มทำงานไม่ได้",
} as const;
