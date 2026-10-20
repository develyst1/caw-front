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
  failed: "ทีมยังตอบข้อความนี้ไม่ได้",                                          // REQ-013 (D-057)
  retry: "ลองอีกครั้ง",                                                       // REQ-013 (D-057)
  estimate: (n: number, h: number) => `${n} งาน ใช้ประมาณ ${h} ก้าว`,           // REQ-013
  notInSpec: "เรื่องนี้ยังไม่มีใน spec — ส่งไปเพิ่มใน Blueprint แล้ว",           // REQ-013
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
  anchor_not_in_version: "บางงานในข้อเสนอนี้ไม่มีใน spec เวอร์ชันนี้แล้ว — เริ่มงานไม่ได้",  // D-110 (was — สร้างการ์ดไม่ได้; follows D-105's rename)
  validation: "ข้อความยาวเกินไป หรือยังว่างอยู่",
  unreachable: "ต่อระบบไม่ได้ตอนนี้",
  other: "ทำไม่สำเร็จ ลองอีกครั้ง",
};

/** The project's workspace folders (`workspace.roots`) — the folders the team may write in. */
export const workspace = {
  heading: "โฟลเดอร์ของทีม",                                                   // PM 2026-10-20 (TASK-B-113): it lists read-only folders too since D-100
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

// ---- REQ-014 redesign (D-061): the 24 words of TASK-B-061 § 3, as written; the starting team's names are in Bob's startingTeam.ts ----
export const redesign = {
  workingCount: (n: number) => `กำลังทำ ${n} คน`,                                   // REQ-014 (D-061) home card
  noTeam: "ยังไม่มีทีม",                                                               // REQ-014 (D-061) home card
  setUpTeam: "จัดทีม",                                                                 // REQ-014 (D-061) home card action · step 1 title
  openBlueprint: "เปิด Blueprint",                                                     // REQ-014 (D-061) home empty state
  stepsHeading: "เริ่มงานใน 3 ขั้น",                                                    // REQ-014 (D-061)
  stepTeamText: "ทีมเริ่มต้นห้าคน รับงานจากคุณที่ PM แล้วส่งต่อกันตามสายงาน เปลี่ยนคนหรือบทบาททีหลังได้", // REQ-014 (D-061)
  useStartingTeam: "ใช้ทีมเริ่มต้น",                                                    // REQ-014 (D-061)
  ownTeam: "จัดทีมเอง",                                                               // REQ-014 (D-061)
  startingChain: "PM → SA → FE และ BE → QA → PM",                                      // REQ-014 (D-061)
  stepChatTitle: "เล่างานแรกให้ทีมฟัง",                                                  // REQ-014 (D-061)
  stepChatText: "พิมพ์ในแชต ทีมจะเสนอการ์ดให้คุณกดสร้าง",                                  // REQ-014 (D-061)
  emptyBoard: "บอร์ดยังว่าง — การ์ดจะขึ้นที่นี่เมื่อคุณกดตกลง เริ่มงานในแชต",          // D-106 (PM 2026-10-20, approved as written)
  teamIncomplete: "ทีมยังไม่ครบ",                                                       // REQ-014 (D-061) chat head
  entryLine: (name: string, role: string) => `${name} · ${role} ${team.entry}`,          // REQ-014 (D-061) chat head
  seatWorking: (card: string) => `${column.doing}: ${card}`,                           // REQ-014 (D-061) crew seat
  seatStuck: (card: string) => `${column.stuck}: ${card}`,                             // REQ-014 (D-061) crew seat
  seatWaiting: "รอคำตอบจากคุณ",                                                        // REQ-014 (D-061) crew seat
  seatFree: "ว่าง",                                                                    // REQ-014 (D-061) crew seat
  workingNow: column.doing,                                                             // carried-over word, new place (a tag)
  asks: (name: string, part: string) => `${name} ถาม · ${part}`,                        // REQ-014 (D-061) question card meta
} as const;

// ---- REQ-014 after STUDY-002 (D-063, D-064, D-065, D-066): as written in the REQ / B-066 § 3 / SPEC-B-003 answers. The readiness rules
// `ทุกคนมีบทบาท` and `ตั้งงบไว้แล้ว` are NOT here: dropped by the review (SPEC-B-003 A3, A4) before the build ----
/** The light / dark toggle's accessible name (D-063). */
export const themeToggle = "สลับโหมดมืด / สว่าง";
/** What is missing, as a link to its fix (D-063): the sentence, then the link words. ทีม's readiness line (the chat head's use went with the panel, TASK-B-098). */
export const missing = {
  entry: { text: "ยังไม่มีคนรับงานคนแรก", fix: "เลือกที่หน้าทีม" },
  folder: { text: "ยังไม่ได้กำหนดโฟลเดอร์", fix: "เพิ่มโฟลเดอร์" },
} as const;
/** The mode switch explains itself (D-063): one line per mode — the toggle's title, and the budget dialog's line (TASK-B-099, H-2). */
export const modeLine: Record<Mode, string> = {
  manual: "แบบสั่งทีละขั้น — คุณกดให้แต่ละคนทำทีละก้าว",
  dispatcher: "อัตโนมัติ — ทีมทำต่อกันเองจนครบงบที่คุณตั้ง",
};
export const live = {
  readyCount: (done: number) => `พร้อมเริ่ม ${done}/3`,                 // D-063 first steps
  quiet: (min: number) => `เงียบไป ${min} นาที`,                       // D-064 (only from Hop.lastActivityAt — SPEC-B-003 C7)
  linkHere: "ต่อที่นี่",                                                   // D-064 chain picture
  freeWithCards: (n: number) => `ว่าง · งานค้าง ${n}`,                   // D-066 crew seat
  waitingOnYou: (n: number) => `รอคุณตอบ ${n}`,                         // D-066 home row
  linkHint: "แตะจุดที่คนส่ง แล้วแตะ ต่อที่นี่ ที่คนรับ",                      // D-066 chain hint (≥ 768)
  rolesNextJob: "มีผลตั้งแต่งานถัดไป",
  answeringChat: "กำลังตอบแชต",                                               // REQ-014 2026-10-16 (C7, PM): a seat whose running step is a chat answer                                       // D-066 under the role picker while working
  teamFact: (n: number) => `ทีม ${n} คน`,                               // D-065 step 1 fact
  folderFact: (n: number) => `${n} โฟลเดอร์`,                            // D-065 step 2 fact
  carryOn: "ทำต่อ",                                                        // D-065 home: a project not started yet
  youLine: "สั่งงาน · ตอบคำถาม",                                            // D-065 the คุณ node
} as const;
/** The readiness checklist (D-065, minus A3 / A4): each rule's line, and its fix when it is not met. */
export const readiness = {
  heading: "ความพร้อม",
  entry: { ok: "มีคนรับงานคนแรก" },                                        // fix = missing.entry
  reachable: { ok: "ทุกคนอยู่ในสายงาน", fix: (names: string) => `ต่อ ${names} เข้ากับสายงาน` },
  handOff: { ok: "FE และ BE ทุกคนส่งงานต่อได้", fix: (name: string, qa: string) => `ต่อเส้นจาก ${name} ไปหา ${qa}` },
  qaNotBuilder: { ok: "QA ไม่ได้สร้างงานที่ตัวเองตรวจ", fix: (role: string, name: string) => `เอา ${role} ออกจาก ${name}` },
  folder: { ok: "มีโฟลเดอร์ที่ทีมเขียนได้" },                                // fix = missing.folder
} as const;
/** The role picker (D-065): heading, hint, and one duty line per role (`other` has none — SPEC-B-003 A5). */
export const rolePicker = {
  heading: (name: string) => `บทบาทของ ${name}`,
  hint: "เลือกได้หลายบทบาท",
  details: "รายละเอียด",
  duty: { other: "บทบาทที่สร้างไว้เอง — ดูสกิลในรายละเอียด", PM: "รับเรื่องจากคุณ แบ่งเป็นงาน", BA: "เขียนความต้องการให้ชัด", SA: "ออกแบบวิธีทำ ส่งงานให้ FE และ BE", FE: "ทำหน้าจอ", BE: "ทำระบบหลังบ้าน", QA: "ตรวจงานก่อนส่งถึงคุณ" } as Record<string, string>,
} as const;
/** Undo instead of a confirm (D-065): the toast's sentence and its button. */
export const undo = {
  button: "เลิกทำ",
  cut: (from: string, to: string) => `ตัดเส้น ${from} → ${to} แล้ว`,
  removed: (name: string) => `เอา ${name} ออกจากทีมแล้ว`,
  folderRemoved: (path: string) => `เอาโฟลเดอร์ ${path} ออกแล้ว`,           // REQ-014 2026-10-16 (PM)
  linkFailed: (from: string, to: string) => `ต่อ ${from} → ${to} ไม่สำเร็จ`,     // REQ-014 2026-10-16 (A7, PM): an undo's line that did not come back
} as const;
/** The face picker (D-071, TASK-B-070 § words as written): heading, its three rows, and every part's name (each option's accessible name). */
export const faces = {
  heading: (name: string) => `หน้าตาของ ${name}`,
  rows: { body: "รูปร่าง", color: "สี", eyes: "ตา" },
  body: { pebble: "ก้อนกลม", dome: "โดม", egg: "ไข่", gem: "เพชร", cape: "ผ้าคลุม", hex: "หกเหลี่ยม" } as Record<string, string>,
  color: { violet: "ม่วง", plum: "ม่วงพลัม", magenta: "บานเย็น", rose: "กุหลาบ", olive: "มะกอก", teal: "เขียวหัวเป็ด", slate: "เทาฟ้า", ink: "หมึก" } as Record<string, string>,
  eyes: { dots: "จุด", beans: "เมล็ดถั่ว", smile: "ยิ้ม", sleepy: "ง่วง", one: "ตาเดียว" } as Record<string, string>, // read as `ตา{name}`
} as const;

/** On sample data (CAW_API=mock), every page says so (REQ-011 l.59, D-058). */
export const sampleData = "ข้อมูลตัวอย่าง — ไม่ได้ต่อกับ CAW จริง";
/** After the mark (REQ-011 l.60, TASK-B-060); the command part is shown as code. */
export const sampleDataHint = "ใช้ข้อมูลจริง: bun run dev"; // D-089: plain dev is the real app (TASK-B-095, F-124)

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

/** The team page rebuild (TASK-B-086, D-081, OD-12). Approved by the PM (D-086, 2026-10-16). */
export const teamPage = {
  addPerson: `+ ${team.addWorker}`,                                              // D-086 (the "+" mark only; the words are team.addWorker)
  close: "ปิด",                                                                   // D-086 — the drawer's and the modal's close button
  removeFromProject: "เอาออกจากโปรเจกต์นี้",                                       // D-086 (D-081 item 1)
  bench: "คนที่ไม่ได้อยู่ในโปรเจกต์นี้",                                              // D-086 — the bench's heading (D-081 item 2)
  deleteWorker: "ลบคนนี้",                                                        // D-086 — only on the bench (D-081 item 2)
  inProjects: (names: string) => `ลบไม่ได้ ยังอยู่ในโปรเจกต์ ${names}`,               // D-086 — 409 worker_in_chain
  hopRunning: (name: string) => `${name} กำลังทำงานอยู่ เอาออกได้เมื่องานนี้จบ`,       // D-086 — 409 hop_running (D-081 item 3)
  entryFirst: (name: string) => `${name} ${team.entry}อยู่ — ให้ใคร${team.entry}แทน?`,  // D-086 — removing the entry person
  chainHint: "ลูกศรคือการส่งงานต่อ — คนหนึ่งทำเสร็จ งานไปที่คนถัดไป",                  // D-086 — under the chain picture
  noQa: { text: "ยังไม่มี QA", fix: "เพิ่ม QA" },                                    // D-086 — readiness fix (B10 / OD-3)
  returnLine: (from: string, to: string) => `↩ ${handoffLine(from, to)}`,          // D-086 (the "↩" mark only) — the 390 list
} as const;

/** The chat panel's head (D-083 (3), final: PM 2026-10-16, SPEC-B-003 Decision 8 / REQ-014 § User-facing). */
export const chatHead = {
  title: (entry: string) => `แชตกับ ${entry}`,
} as const;

export const errorPage = {
  notFound: "ไม่พบหน้านี้ — ลิงก์อาจเก่าหรือถูกลบไปแล้ว",                           // team-proposed B-088
  failed: "หน้านี้เปิดไม่สำเร็จ ลองอีกครั้ง หรือกลับไปที่โปรเจกต์",                    // team-proposed B-088
  retry: "ลองอีกครั้ง",                                                            // carried-over (chat.retry)
} as const;
export const runPage = {
  chatStep: (text: string) => `ตอบแชต: ${text}`,                                // team-proposed B-088 — a chat step in the runs list
} as const;
export const cardPage = {
  noActivity: "ยังไม่มีความเคลื่อนไหว — ความเห็นและการส่งต่อจะขึ้นที่นี่", // team-proposed B-088 — an empty timeline
} as const;

/** caw-back is down (D-089, TASK-B-093). `team-proposed B-093` until the PM approves. */
export const backendDown = {
  text: "ยังต่อ caw-back ไม่ได้ — เปิด caw-back ก่อน แล้วกดลองอีกครั้ง",   // team-proposed B-093
  command: "คำสั่งเปิด caw-back",                                            // team-proposed B-093 — the label above the command line
  tried: (url: string) => `ลองต่อที่ ${url}`,                               // team-proposed B-093
} as const;

/** The board's one line while the team waits on you in the chat (TASK-B-098, D-094 § 0 — approved as written). */
export const chatWaits = {
  line: (entry: string) => `${entry} รอคุณอยู่ในแชต`,                       // D-094 § 0
  go: "ไปที่แชต",                                                            // D-094 § 0
} as const;

/** The folders row on ทีม (TASK-B-099, D-094 H-3 / T-4 — approved as written): `โฟลเดอร์ของทีม` (workspace.heading, renamed TASK-B-113), the paths, and this button. */
export const folderEdit = "แก้";                                               // D-094 H-3

/** The distill's other new words (TASK-B-100, D-094 — approved as written in studies/REQ-014-distill-PM.md). */
export const distill = {
  tellEntry: (entry: string) => `เล่างานให้ ${entry} ในแชต`,                    // D-094 B-2 — the empty board's one button
  placeholder: (entry: string) => `เล่างานให้ ${entry}…`,                       // D-094 C-1 — the chat box (and its accessible name)
  chainReady: "สายงานพร้อม",                                                   // D-094 T-1 — shown after a ✓ when every check passes
  answer: "ตอบ",                                                              // D-094 K-4 — the question card's own-answer button
  backToProjects: "กลับไปที่โปรเจกต์",                                          // D-094 S-1 — the start page's one button
} as const;

/** The team is not running (REQ-015 R1, SPEC-A-009 § 1b, TASK-B-104). `team-proposed B-104` until the PM approves — the PM's table. */
export const teamDown = {
  line: "ทีมยังไม่ได้ทำงาน — เปิดด้วยคำสั่งนี้",                                  // team-proposed B-104 — board + chat, before the start command
  waits: "ข้อความนี้จะรอจนทีมเริ่มทำงาน",                                         // team-proposed B-104 — under the chat box while the team is down
} as const;

/** The code map on ทีม (REQ-015 R2, SPEC-A-009 § 2c, TASK-B-106). `team-proposed B-106` until the PM approves — the PM's table. */
export const codeMapWords = {
  heading: "ผังโค้ด",                                                            // team-proposed B-106 — the section's h2 (#code-map)
  folders: "โฟลเดอร์",                                                          // team-proposed B-106
  kind: { fe: "FE", be: "BE", other: "ไม่ใช่ของเรา" },                          // team-proposed B-106 (TASK's own words)
  stack: "เทคโนโลยี",                                                           // team-proposed B-106
  run: "คำสั่งรัน",                                                              // team-proposed B-106
  test: "คำสั่งทดสอบ",                                                          // team-proposed B-106
  rules: "กฎของโค้ด",                                                           // team-proposed B-106
  none: "ไม่มี",                                                                // team-proposed B-106 (TASK's own word) — an empty list
  questions: "คำถามที่ยังเปิด",                                                  // team-proposed B-106
  notes: "บันทึก",                                                              // team-proposed B-106
  confirm: "ยืนยัน",                                                            // team-proposed B-106 (SPEC-A-009 § 2c)
  confirmed: (date: string) => `ยืนยันแล้ว ${date}`,                             // team-proposed B-106 (TASK's own words)
  fixInChat: "แก้ผ่านแชต",                                                       // team-proposed B-106 (TASK's own words)
  see: "ดูผังโค้ด",                                                              // team-proposed B-106 (TASK's own words) — under the chat reply
} as const;

/** Folder kinds (REQ-015 R4a, D-099 / D-100, TASK-B-108). `team-proposed B-108` until the PM approves — the PM's table. */
export const folderKind = {
  writable: "เขียนได้",                                                          // team-proposed B-108 (TASK's own word)
  readOnly: "อ่านได้อย่างเดียว",                                                  // team-proposed B-108 (TASK's own word)
  help: 'ทีมอ่านได้ทุกโฟลเดอร์ เขียนได้เฉพาะที่ "เขียนได้"',                         // team-proposed B-108 (TASK's own words) — the dialog's one help line
} as const;

/** One question, one way to answer (REQ-016 P1, TASK-B-119) — approved by D-105. */
export const oneAnswer = {
  acceptAll: "ตามนั้นทุกข้อ",                                                    // D-105 — the board's primary when the entry person asks 2+
  posted: (answer: string) => `ตามนั้น — ${answer}`,                            // D-105 — the line ตามนั้น posts for him
  asks: (entry: string, n: number) => `${entry} ถาม ${n} ข้อ`,                   // D-105 — the board's header row over 2+ questions
  answered: (answer: string | null) => (answer ? `ตอบแล้ว · ${answer}` : "ตอบแล้ว"), // D-105 — an answered question in the chat
} as const;

/** One clear moment the work starts (REQ-016 P2, TASK-B-120) — approved by D-105. */
export const agreeStart = {
  agree: "ตกลง เริ่มงาน",                                                         // D-105 — the proposal's button (was สร้างการ์ด)
  answerFirst: (entry: string) => `ตอบคำถามของ ${entry} ก่อน`,                     // D-105 — beside the button while a question is open
  manual: (n: number) => `จะได้ ${n} การ์ดบนบอร์ด แล้วคุณกดให้ทีละขั้น`,             // D-105 — above the button, mode แบบสั่งทีละขั้น
  dispatcher: (n: number) => `ทีมจะเริ่มทำ ${n} การ์ดเองจนครบงบ`,                   // D-105 — above the button, mode อัตโนมัติ
  waiting: (entry: string) => `${entry} เสนองานไว้ รอคุณตกลง`,                     // D-105 — the board's line while the proposal waits
} as const;
