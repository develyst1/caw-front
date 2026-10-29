// `CawApi` in memory, seeded with SPEC-A-008's shapes (REQ-010 contract v1.0 + v1.1): one project from Blueprint's worked example
// (จองห้องประชุม; its part keys and titles), 12 cards across the five statuses incl. one open question card, 4 workers, a chain
// with an entry worker, two finished runs (3 + 2 hops) and one manual hop, and a project with no workspace folders yet. Every operator
// write of SPEC-A-008 follows the back end's rules (chain_broken, run_open, has_open_cards, already_exists, ...); creating a project
// from the one Blueprint project the mock knows makes a second, empty one.
// Each `createMockApi()` is a fresh copy, so tests never share state; the app uses the one `index.ts` makes.
// Anything the real server computes (workable, the counts, hopsUsed) is computed here on read, never stored.
import { STARTING_FACES } from "@/lib/faces"; // the one list of faces: the seed's starting-team workers carry the approved ones (TASK-B-072)
import {
  CawError, type Avatar, type Card, type CardContext, type CardStatus, type CawApi, type CodeMap, type Chain, type CawEvent, type ChatMessage, type Effort, type Hop, type HopOutcome, type HopOutputEntry, type Mode,
  type ModelName, type Note, type PartContext, type ProjectSummary, type Proposal, type ProposalItem, type Run, type Worker, type WorkerRole,
} from "./caw";

const BLUEPRINT_VERSION = 3;        // the confirmed version the project was made from
const BLUEPRINT_LATEST = 4;         // the newest version CAW has seen (two cards' parts changed in it)
const BLUEPRINT_PROJECT = "11111111-2222-4333-8444-555555555555"; // a stand-in id: the mock has no Blueprint behind it

// deterministic uuid-shaped ids: a prefix per kind, then a counter
const PREFIX = { p: "10000000", w: "20000000", c: "30000000", n: "40000000", r: "50000000", h: "60000000", m: "70000000", q: "80000000" } as const;
const id = (kind: keyof typeof PREFIX, n: number) => `${PREFIX[kind]}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PROJECT_ID = id("p", 1);
export const MOCK_NEW_PROJECT_ID = id("p", 2); // the second project of the `new-project` state: nothing in it yet (TASK-B-062)
export const MOCK_PROJECT_ID = PROJECT_ID; // for the tests and the screens' first links, until a project list picks one

const W = { ploy: id("w", 1), fern: id("w", 2), bank: id("w", 3), mint: id("w", 4) };
const WORKERS: Worker[] = [
  { id: W.ploy, name: "ปลา", role: "PM", roles: ["PM"], skills: ["role-pm"], model: "opus", effort: "high", combinedFrom: null, avatar: STARTING_FACES["ปลา"]!, deletedAt: null },
  { id: W.fern, name: "ฝน", role: "FE", roles: ["FE"], skills: ["role-fe", "frontend-finish"], model: "sonnet", effort: "medium", combinedFrom: null, avatar: STARTING_FACES["ฝน"]!, deletedAt: null },
  { id: W.bank, name: "แบงค์", role: "BE", roles: ["BE"], skills: ["role-be"], model: "sonnet", effort: "medium", combinedFrom: null, avatar: STARTING_FACES["แบงค์"]!, deletedAt: null },
  { id: W.mint, name: "มิ้นท์", role: "QA", roles: ["QA"], skills: ["role-qa"], model: "sonnet", effort: "high", combinedFrom: null, avatar: STARTING_FACES["มิ้นท์"]!, deletedAt: null },
];
const ENTRY = W.ploy;
const EDGES = [
  { from: W.ploy, to: W.fern }, { from: W.ploy, to: W.bank }, { from: W.fern, to: W.bank },
  { from: W.fern, to: W.mint }, { from: W.bank, to: W.mint },
];

type Seed = Omit<Card, "projectId" | "workable" | "createdAt" | "updatedAt">;
const C = (n: number) => id("c", n);
const seed = (n: number, title: string, todo: string, status: CardStatus, assigneeId: string | null, key: string, rest: Partial<Seed> = {}): Seed => ({
  id: C(n), number: n, kind: "work", title, todo, status, assigneeId, anchor: { key, version: BLUEPRINT_VERSION },
  specChangedVersion: null, dependsOn: [], question: null, answer: null, ...rest,
});
const SEEDS: Seed[] = [
  seed(1, "ออกแบบหน้าค้นหาห้อง", "ออกแบบหน้าค้นหาห้องว่างตาม spec: เลือกวันที่ แล้วเลือกห้องและช่วงเวลา", "todo", W.fern, "SCR-001"),
  seed(2, "ทำ API ค้นหาห้องว่าง", "ทำ endpoint ค้นหาห้องว่างจากปฏิทิน อ่านข้อมูล Room", "todo", W.bank, "API-001", { specChangedVersion: BLUEPRINT_LATEST }),
  seed(3, "ทำหน้ายืนยันการจอง", "ทำหน้ายืนยันพร้อมห้องที่เลือก และปุ่มกดยืนยันการจอง", "todo", W.fern, "SCR-002", { dependsOn: [C(2)] }),
  seed(4, "ทำ API สร้างการจอง", "ตรวจเวลาว่างและบันทึก Booking แล้วตอบ 201 พร้อมสถานะ", "doing", W.bank, "API-002"),
  seed(5, "ต่อขั้นส่งคำขอจองเข้ากับกฎห้องใหญ่", "ขั้นส่งคำขอจองต้องใช้กฎห้องที่จุเกิน 10 คน", "doing", W.ploy, "STEP-003", { dependsOn: [C(12)] }),
  seed(6, "ทำ API อนุมัติการจอง", "ผู้ดูแลอนุมัติหรือปฏิเสธคำขอ แล้วอัปเดตสถานะการจอง", "review", W.bank, "API-003", { specChangedVersion: BLUEPRINT_LATEST }),
  seed(7, "ทำหน้าอนุมัติคำขอ", "ทำหน้าเปิดคำขอและปุ่มอนุมัติ/ปฏิเสธ แสดง Booking", "review", W.fern, "SCR-003"),
  seed(8, "ตั้งข้อมูล Room", "กำหนดข้อมูล Room ที่ API ค้นหาห้องว่างอ่าน", "done", W.bank, "DATA-001"),
  seed(9, "ขั้นค้นหาห้องว่าง", "ต่อขั้นค้นหาห้องว่างเข้ากับขั้นเลือกห้องและเวลา", "done", W.ploy, "STEP-001"),
  seed(10, "ขั้นเลือกห้องและเวลา", "ทำขั้นเลือกห้องและช่วงเวลา", "done", W.fern, "STEP-002"),
  seed(11, "ผู้ดูแลไม่ตอบใน 24 ชม. ทำอย่างไร", "", "todo", null, "Q-001", {
    kind: "question",
    question: { text: "ถ้าผู้ดูแลไม่ตอบใน 24 ชม. ให้ปฏิเสธคำขอเอง หรือเตือนผู้ดูแลก่อน?", proposedDefault: "เตือนผู้ดูแลก่อน แล้วค่อยปฏิเสธเมื่อครบ 48 ชม.", cases: ["ปฏิเสธเอง", "เตือนก่อน", "ปล่อยค้างไว้"] },
  }),
  seed(12, "ตรวจกฎห้องที่จุเกิน 10 คน", "ตรวจว่าทุกขั้นที่เกี่ยวข้องใช้กฎห้องใหญ่ถูกต้อง", "stuck", W.mint, "DEC-001", { specChangedVersion: BLUEPRINT_LATEST, dependsOn: [C(11)] }),
];

const part = (key: string, kind: string, title: string): PartContext["part"] => ({ key, kind, title, body: {}, origin: { stamp: "operator", date: "2026-10-12" } });
const ref = (key: string, kind: string, title: string) => ({ key, kind, title });
const nb = (linkKind: string, key: string, kind: string, title: string): PartContext["neighbours"][number] =>
  ({ direction: "out", linkKind, label: null, position: null, part: ref(key, kind, title) });
// the part of each card, with neighbours as Blueprint's worked example links them
const SPECS: Record<string, { part: PartContext["part"]; neighbours: PartContext["neighbours"] }> = {
  "SCR-001": { part: part("SCR-001", "screen", "หน้าค้นหาห้อง"), neighbours: [nb("to", "INT-001", "interaction", "เลือกวันที่"), nb("to", "INT-004", "interaction", "เลือกห้องและช่วงเวลา")] },
  "SCR-002": { part: part("SCR-002", "screen", "หน้ายืนยันการจอง"), neighbours: [nb("to", "INT-005", "interaction", "เปิดหน้ายืนยันพร้อมห้องที่เลือก"), nb("to", "INT-006", "interaction", "กดยืนยันการจอง")] },
  "SCR-003": { part: part("SCR-003", "screen", "หน้าอนุมัติคำขอ"), neighbours: [nb("to", "INT-010", "interaction", "เปิดคำขอแล้วกดอนุมัติหรือปฏิเสธ"), nb("shows", "DATA-002", "data", "Booking")] },
  "API-001": { part: part("API-001", "api", "ค้นหาห้องว่าง"), neighbours: [nb("reads", "DATA-001", "data", "Room"), nb("to", "INT-002", "interaction", "ขอรายการห้องว่าง")] },
  "API-002": { part: part("API-002", "api", "สร้างการจอง"), neighbours: [nb("writes", "DATA-002", "data", "Booking"), nb("to", "INT-007", "interaction", "ส่ง Booking")] },
  "API-003": { part: part("API-003", "api", "อนุมัติการจอง"), neighbours: [nb("writes", "DATA-002", "data", "Booking"), nb("to", "INT-011", "interaction", "ส่งผลการพิจารณา")] },
  "DATA-001": { part: part("DATA-001", "data", "Room"), neighbours: [nb("reads", "API-001", "api", "ค้นหาห้องว่าง"), nb("shows", "SCR-001", "screen", "หน้าค้นหาห้อง")] },
  "STEP-001": { part: part("STEP-001", "step", "ค้นหาห้องว่าง"), neighbours: [nb("has_interaction", "INT-001", "interaction", "เลือกวันที่"), nb("next", "STEP-002", "step", "เลือกห้องและเวลา")] },
  "STEP-002": { part: part("STEP-002", "step", "เลือกห้องและเวลา"), neighbours: [nb("next", "STEP-001", "step", "ค้นหาห้องว่าง"), nb("next", "STEP-003", "step", "ส่งคำขอจอง")] },
  "STEP-003": { part: part("STEP-003", "step", "ส่งคำขอจอง"), neighbours: [nb("covers", "DEC-001", "decision", "ห้องที่จุเกิน 10 คนต้องให้ผู้ดูแลอนุมัติ"), nb("next", "STEP-002", "step", "เลือกห้องและเวลา")] },
  "Q-001": { part: part("Q-001", "question", "ผู้ดูแลไม่ตอบใน 24 ชม. ทำอย่างไร"), neighbours: [nb("about", "STEP-004", "step", "ผู้ดูแลพิจารณา")] },
  "DEC-001": { part: part("DEC-001", "decision", "ห้องที่จุเกิน 10 คนต้องให้ผู้ดูแลอนุมัติ"), neighbours: [nb("covers", "STEP-003", "step", "ส่งคำขอจอง"), nb("covers", "STEP-004", "step", "ผู้ดูแลพิจารณา")] },
};

const actor = (w: string) => `worker:${w}`;
const NOTES: Record<string, Note[]> = {
  [C(6)]: [
    { id: id("n", 1), type: "comment", actor: actor(W.bank), text: "ทำ endpoint อนุมัติเสร็จแล้ว ส่งให้ตรวจ", fromWorkerId: null, toWorkerId: null, allowed: null, at: "2026-10-13T09:10:00+07:00" },
    { id: id("n", 2), type: "handoff", actor: actor(W.bank), text: "ตรวจกฎห้องใหญ่ด้วย", fromWorkerId: W.bank, toWorkerId: W.mint, allowed: null, at: "2026-10-13T09:12:00+07:00" },
    // v1.3: มิ้นท์ tried to hand it to ฝน — the chain has no มิ้นท์ → ฝน edge (มิ้นท์ hands to nobody), so it was refused and recorded
    { id: id("n", 5), type: "handoff_refused", actor: actor(W.mint), text: "ขอให้ฝนดูหน้าอนุมัติด้วย", fromWorkerId: W.mint, toWorkerId: W.fern, allowed: [], at: "2026-10-13T09:20:00+07:00" },
    { id: id("n", 3), type: "comment", actor: "operator", text: "spec ขั้นอนุมัติเพิ่งเปลี่ยน ช่วยดูอีกรอบ", fromWorkerId: null, toWorkerId: null, allowed: null, at: "2026-10-13T09:30:00+07:00" },
  ],
  [C(11)]: [
    { id: id("n", 4), type: "comment", actor: actor(W.ploy), text: "ถามคุณ: ถ้าผู้ดูแลไม่ตอบภายใน 24 ชม. ให้ปฏิเสธเองหรือเตือนก่อน?", fromWorkerId: null, toWorkerId: null, allowed: null, at: "2026-10-13T08:40:00+07:00" },
  ],
};

const RUN_1 = id("r", 1), RUN_2 = id("r", 2); // r-2 is the older one
const HOPS: Omit<Hop, "lastActivityAt" | "messageId">[] = [
  { id: id("h", 1), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(9), workerId: W.ploy, startedAt: "2026-10-13T08:00:10+07:00", endedAt: "2026-10-13T08:00:48+07:00", outcome: "status", tokensIn: 3100, tokensOut: 1100, note: "ตัดการ์ดจาก spec และปิดขั้นแรก" },
  { id: id("h", 2), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(10), workerId: W.fern, startedAt: "2026-10-13T08:02:00+07:00", endedAt: "2026-10-13T08:02:52+07:00", outcome: "handed_off", tokensIn: 4500, tokensOut: 1600, note: "ทำขั้นเลือกห้องและเวลา ส่งต่อให้แบงค์" },
  { id: id("h", 3), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(8), workerId: W.bank, startedAt: "2026-10-13T08:05:30+07:00", endedAt: "2026-10-13T08:05:59+07:00", outcome: "commented", tokensIn: 2400, tokensOut: 900, note: "ตั้งข้อมูล Room" },
  // an older run (the day before) that ran out of things to do
  { id: id("h", 5), projectId: PROJECT_ID, runId: RUN_2, claimedBy: "runner-1", cardId: C(9), workerId: W.ploy, startedAt: "2026-10-12T17:00:10+07:00", endedAt: "2026-10-12T17:01:00+07:00", outcome: "commented", tokensIn: 2600, tokensOut: 800, note: "ไล่ spec ขั้นแรกกับทีม" },
  { id: id("h", 6), projectId: PROJECT_ID, runId: RUN_2, claimedBy: "runner-1", cardId: C(10), workerId: W.fern, startedAt: "2026-10-12T17:03:00+07:00", endedAt: "2026-10-12T17:03:41+07:00", outcome: "asked", tokensIn: 3900, tokensOut: 1300, note: "ถามเรื่องห้องที่จุเกิน 10 คน" },
  // a manual hop: no run, no runner
  { id: id("h", 4), projectId: PROJECT_ID, runId: null, claimedBy: null, cardId: C(6), workerId: W.bank, startedAt: "2026-10-13T09:10:00+07:00", endedAt: "2026-10-13T09:11:11+07:00", outcome: "commented", tokensIn: 6400, tokensOut: 2400, note: "ทำ API อนุมัติการจอง" },
];
// v1.11: a hop's `lastActivityAt` starts as its `startedAt`; v1.4: no seeded hop answers a chat message (those are `chatHops`); the mock has no runner, so a heartbeat never moves it
const SEEDED_HOPS: Hop[] = HOPS.map((h) => ({ ...h, lastActivityAt: h.startedAt, messageId: null }));

// ---- what a hop's CLI showed (REQ-104, SPEC-103 § caw-front): worked out on read from the hop, never stored ----
// A running hop gets one more line every SCREEN_TICK_MS since its start, so a watcher sees it grow. One seeded finished hop has a 12 s gap between lines,
// one has no output at all, the other finished hops have three lines. The text is a terminal's own output, shaped like the runner's `screenLines`.
const SCREEN_TICK_MS = 2000;
const SCREEN_MAX = 5000;          // the runner's `maxLines`: the mock never grows past it
const GAP_HOP = id("h", 1);
const SILENT_HOP = id("h", 5);
function screenOutput(hop: Hop, nowMs: number): HopOutputEntry[] {
  const t0 = Date.parse(hop.startedAt);
  const line = (seq: number, ms: number, text: string): HopOutputEntry => ({ seq, at: new Date(t0 + ms).toISOString(), kind: "line", text, gapSeconds: null });
  const text = (i: number) => (i === 0 ? "● session mock" : `▸ Read src/step-${i}.ts`);
  if (hop.endedAt === null) {
    const n = Math.min(SCREEN_MAX, 1 + Math.max(0, Math.floor((nowMs - t0) / SCREEN_TICK_MS)));
    return Array.from({ length: n }, (_, i) => line(i, i * SCREEN_TICK_MS, text(i)));
  }
  if (hop.id === SILENT_HOP) return [];
  if (hop.id === GAP_HOP) {
    return [line(0, 0, text(0)), line(1, 2000, "▸ Bash bun test"), { seq: 2, at: new Date(t0 + 16000).toISOString(), kind: "gap", text: "", gapSeconds: 12 },
      line(3, 17000, "▸ Edit src/step-3.ts"), line(4, 19000, "■ success · turns 3")];
  }
  return [line(0, 0, text(0)), line(1, 2000, text(1)), line(2, 4000, "■ success · turns 2")];
}

// ---- the chat and the card proposals (SPEC-A-008 § v1.4): a thread with two asks; the first was answered with questions and a proposal
// (an older proposal on the same message is superseded), the second with a proposal whose one anchor has since gone from Blueprint ----
// M(4) proposed one card and sent the part Blueprint does not have yet to Blueprint's chat (the proposed_and_amended case): the link is
// `<BLUEPRINT_WEB_URL>/p/<blueprintProjectId>/chat` (SPEC-A-008 § v1.4) — the default web address, a fixed value so the seed is the same everywhere.
const AMENDMENT = { blueprintMessageId: id("m", 91), link: `http://127.0.0.1:3100/p/${BLUEPRINT_PROJECT}/chat` };

const M = (n: number) => id("m", n), Q = (n: number) => id("q", n);
/** A message as the mock keeps it: `chatHop` is never stored, it is worked out from the project's chat hops whenever the thread is read (v1.9). */
type StoredMessage = Omit<ChatMessage, "chatHop">;
const CHAT: StoredMessage[] = [
  { id: M(1), projectId: PROJECT_ID, author: "operator", text: "อยากให้ทีมทำหน้าอนุมัติคำขอจอง และแจ้งผู้ขอเมื่อมีผล", replyTo: null, replyHopId: id("h", 7), questions: null, proposalId: null, amendment: null, retryRequestedAt: null, at: "2026-10-14T09:00:00+07:00" },
  { id: M(2), projectId: PROJECT_ID, author: `worker:${W.ploy}`, text: "ตัดเป็น 3 งานแล้ว: API แจ้งผล → หน้าอนุมัติ → ตรวจ ขอถามเรื่องการแจ้งผู้ขอก่อนเริ่ม", replyTo: M(1), replyHopId: null,
    questions: [{ text: "ผู้ขอจองต้องได้รับแจ้งผลทางไหน", proposedDefault: "อีเมล", cases: ["อีเมล", "ในแอป", "ทั้งสองทาง"] }], proposalId: Q(2), amendment: null, retryRequestedAt: null, at: "2026-10-14T09:01:30+07:00" },
  { id: M(3), projectId: PROJECT_ID, author: "operator", text: "ขอเพิ่มหน้าสรุปรายงานรายวันด้วย", replyTo: null, replyHopId: id("h", 8), questions: null, proposalId: null, amendment: null, retryRequestedAt: null, at: "2026-10-14T09:20:00+07:00" },
  { id: M(4), projectId: PROJECT_ID, author: `worker:${W.ploy}`, text: "เสนอหน้าสรุปรายงานหนึ่งงาน", replyTo: M(3), replyHopId: null, questions: null, proposalId: Q(3), amendment: AMENDMENT, retryRequestedAt: null, at: "2026-10-14T09:21:00+07:00" },
];

const item = (title: string, todo: string, key: string, workerId: string, dependsOn: number[], hops: number): ProposalItem =>
  ({ title, todo, anchor: { key, version: BLUEPRINT_VERSION }, workerId, dependsOn, hops });
type StoredProposal = Omit<Proposal, "hopsTotal">;
const PROPOSALS: StoredProposal[] = [
  { id: Q(1), projectId: PROJECT_ID, messageId: M(1), version: BLUEPRINT_VERSION, status: "superseded", cardIds: null, createdAt: "2026-10-14T09:00:40+07:00", items: [
    item("ทำหน้าอนุมัติคำขอ", "ทำหน้าอนุมัติตาม spec", "SCR-003", W.fern, [], 2), item("ตรวจหน้าอนุมัติ", "ตรวจหน้าอนุมัติกับกฎห้องใหญ่", "DEC-001", W.mint, [0], 1),
  ] },
  { id: Q(2), projectId: PROJECT_ID, messageId: M(1), version: BLUEPRINT_VERSION, status: "open", cardIds: null, createdAt: "2026-10-14T09:01:30+07:00", items: [
    item("ทำ API แจ้งผลการจอง", "แจ้งผู้ขอเมื่อผู้ดูแลอนุมัติหรือปฏิเสธ", "API-003", W.bank, [], 2),
    item("ทำหน้าอนุมัติคำขอ (แจ้งผล)", "หน้าอนุมัติเรียก API แจ้งผล แล้วแสดงว่าแจ้งแล้ว", "SCR-003", W.fern, [0], 3),
    item("ตรวจการแจ้งผล", "ตรวจว่าแจ้งผลครบทุกกรณีของกฎห้องใหญ่", "DEC-001", W.mint, [0, 1], 1),
  ] },
  // its one anchor was a part of version 3 that is not in Blueprint's newest version any more: accepting it is refused, nothing is written
  { id: Q(3), projectId: PROJECT_ID, messageId: M(3), version: BLUEPRINT_VERSION, status: "open", cardIds: null, createdAt: "2026-10-14T09:21:00+07:00", items: [
    item("ทำหน้าสรุปรายงานรายวัน", "หน้าสรุปจำนวนการจองต่อวัน", "STEP-099", W.fern, [], 2),
  ] },
];

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;
const NOW = "2026-10-13T10:00:00+07:00";
const STRENGTH: Record<ModelName, number> = { haiku: 0, sonnet: 1, opus: 2 };
const ROLE_WORDS: readonly WorkerRole[] = ["PM", "BA", "SA", "FE", "BE", "QA", "other"];
/** a role's default model (v1.10): the thinking roles — PM · BA · SA · QA — on opus, the rest on sonnet */
const roleModel = (r: WorkerRole): ModelName => (r === "PM" || r === "BA" || r === "SA" || r === "QA" ? "opus" : "sonnet");
const strongest = (models: ModelName[]): ModelName => models.reduce((a, b) => (STRENGTH[b] > STRENGTH[a] ? b : a));
/** `avatar` as the back end takes it (v1.12): `null` / not sent = not chosen; an object must have exactly `body`, `color`, `eyes`, each `^[a-z0-9-]{1,24}$` — the SHAPE, not a list. */
const FACE_ID = /^[a-z0-9-]{1,24}$/;
const avatarOf = (a: unknown): Avatar | null => {
  if (a === undefined || a === null) return null;
  const o = a as Record<string, unknown>;
  const keys = typeof a === "object" && !Array.isArray(a) ? Object.keys(o).sort().join() : "";
  if (keys !== "body,color,eyes" || !["body", "color", "eyes"].every((k) => typeof o[k] === "string" && FACE_ID.test(o[k] as string))) {
    return refuse(400, "validation", "avatar: body, color and eyes — each 1–24 of a–z 0–9 -, all three or null");
  }
  return { body: o.body as string, color: o.color as string, eyes: o.eyes as string };
};
/** `roles` as the back end takes it: at least one, no repeats, only known words */
const rolesOf = (roles: WorkerRole[]): WorkerRole[] => {
  if (roles.length < 1 || new Set(roles).size !== roles.length || roles.some((r) => !ROLE_WORDS.includes(r))) refuse(400, "validation", "roles: one or more distinct roles");
  return [...roles];
};
const LEVEL: Record<Effort, number> = { low: 0, medium: 1, high: 2 };
const STATUSES: CardStatus[] = ["todo", "doing", "review", "done", "stuck"];

/** One project's state. Workers are global (below); a project uses them through its chain. */
interface Proj {
  id: string; name: string; blueprintProjectId: string; version: number; latestSeenVersion: number;
  mode: Mode; hopBudget: number; roots: string[]; readOnly: string[]; codeMap: CodeMap | null; createdAt: string;
  cards: Seed[]; notes: Record<string, Note[]>; hops: Hop[]; runs: Omit<Run, "hopsUsed">[]; chat: StoredMessage[]; proposals: StoredProposal[];
  /** the hops of the chat steps (SPEC-A-008 § v1.4 puts them in the hop list, `Hop.messageId`; the mock keeps them apart — `Hop` does not model it yet) */
  chatHops: { id: string; messageId: string; endedAt: string | null; outcome: HopOutcome | null }[];
  members: string[]; edges: { from: string; to: string }[]; entry: string | null;
}

const refuse = (status: number, code: string, message: string, details?: unknown): never => { throw new CawError(status, code, message, details); };

/** a project with nothing in it yet (what `createProject` makes; also the `new-project` state) */
const blank = (version: number, n: number): Proj => ({
  id: id("p", n), name: "จองห้องประชุม", blueprintProjectId: BLUEPRINT_PROJECT, version, latestSeenVersion: BLUEPRINT_LATEST,
  mode: "manual", hopBudget: 0, roots: [], readOnly: [], codeMap: null, createdAt: NOW, cards: [], notes: {}, hops: [], runs: [], chat: [], proposals: [], chatHops: [], members: [], edges: [], entry: null,
});

/** Variants of the seed the e2e can ask for (POST /test-reset?state=…): states the screens reach only when the real runner acts by itself. */
export const MOCK_STATES = ["dispatcher-stopped", "manual-open-run", "chat-failed", "chat-running", "new-project", "working-now", "working-quiet", "entry-asked", "operator-like", "team-down", "code-map", "entry-asked-two", "manual-idle"] as const;
export type MockState = (typeof MOCK_STATES)[number];

/** `state` = `dispatcher-stopped`: the project is on อัตโนมัติ and its newest run ended `budget_spent` by itself (D-052) — the seeded run already
 *  ended that way, so the variant only turns the mode. `manual-open-run` (TASK-B-056): the project stays on แบบสั่งทีละขั้น and has one more run,
 *  newest and still open — the runner opened it; the screen cannot. `chat-failed` / `chat-running` (TASK-B-057): the second ask has no reply — and no
 *  proposal on it — because its chat hop ended `failed`, or is still running (then it is also in `hops()`, with `messageId`, in place of ฝน's hop). `entry-asked`
 *  (TASK-B-075): the entry worker's newest reply asks a question nobody has answered. `new-project` (TASK-B-062): a second project, `MOCK_NEW_PROJECT_ID`, with no
 *  chain members, folders, cards or chat — the first-steps screen. The plain seed has one running card hop (ฝน, C5); `working-now` moves it to the BE on card 4; `working-quiet` is ฝน's hop silent for 12 minutes.
 *  Anything else (or nothing) is the plain seed. */
/** What only the mock can do: act as the runner. The screens never call these; the tests and the seeds do. */
export interface MockRunner {
  /** The RUNNER starts a card hop (v1.14), on any card and with no event (the operator's own start is `CawApi.startHop`): a project has one running hop
   *  (409 `hop_running` `{ hopId }`), and a card in `todo` becomes `doing` in the same step. */
  runnerStartHop(cardId: string, workerId: string): Promise<Hop>;
  /** Ends a running hop (outcome `commented`). 404 for an unknown hop. */
  finishHop(hopId: string): Promise<void>;
  /** The entry worker answers the project's newest operator message with a plain reply (no question, no proposal, no amendment) and the log gets
   *  `chat.replied`, so the thread and `lastSeq` move together. An ask nobody answered yet also gets a finished chat hop (`commented`); one that was
   *  answered already just gets the further reply under it. 404 unknown project · 409 `nothing_to_answer` (no operator message at all). */
  replyChat(projectId: string, text: string): Promise<ChatMessage>;
  /** The team starts (`true`) or stops checking in (`false`), as `teamStatus()` reports it. Nothing else changes and no event is written. */
  setTeamRunning(running: boolean): void;
  /** A worker saves the project's code map, as the setup step does (SPEC-A-009 Revision 1 A3): `map` (default: the `code-map` state's sample) replaces any map, `updatedAt`
   *  is now, `updatedBy` is the entry worker, `confirmedAt` is cleared, and `project.code_map_saved` is written so `lastSeq` moves. 404 unknown project · 409 `no_entry_worker`. */
  saveCodeMap(projectId: string, map?: Partial<CodeMap> & Pick<CodeMap, "folders" | "stack" | "commands" | "rules" | "questions">): Promise<void>;
}

/** The sample code map of the `code-map` state and of `saveCodeMap` (a worker's notes on the code; its times, author and confirmation are set when it is saved). */
const SAMPLE_CODE_MAP: Omit<CodeMap, "updatedAt" | "updatedBy" | "confirmedAt"> = {
  folders: [
    { name: "booking-web", kind: "fe", note: "หน้าจอจองห้อง (Next.js)" },
    { name: "booking-api", kind: "be", note: "API และฐานข้อมูล" },
    { name: "docs", kind: "other" },
  ],
  stack: ["TypeScript", "Next.js", "PostgreSQL"],
  commands: { run: ["bun run dev", "bun run dev:api"], test: ["bun test", "bunx playwright test"] },
  rules: [],
  questions: [
    { text: "ห้องใหญ่ที่ต้องขออนุมัติ นับที่กี่คนขึ้นไป", proposedDefault: "เกิน 10 คน" },
    { text: "ทดสอบกับฐานข้อมูลจริงได้ไหม", proposedDefault: "ไม่ได้ ใช้ฐานข้อมูลในหน่วยความจำ" },
  ],
};

export function createMockApi(opts: { state?: MockState } = {}): CawApi & MockRunner {
  const workers: Worker[] = structuredClone(WORKERS);
  let nextHop = 100, nextWorker = workers.length, nextProject = 1, nextNote = 100, nextRun = 2, nextCard = SEEDS.length, nextMessage = CHAT.length; // runs r-1 and r-2, 12 cards and 4 messages are seeded
  const projects: Proj[] = [{
    id: PROJECT_ID, name: "จองห้องประชุม", blueprintProjectId: BLUEPRINT_PROJECT, version: BLUEPRINT_VERSION, latestSeenVersion: BLUEPRINT_LATEST,
    mode: opts.state === "dispatcher-stopped" ? "dispatcher" : "manual", hopBudget: 40, roots: [], readOnly: [], codeMap: null, createdAt: "2026-10-12T20:00:00+07:00", // a new project has no folders yet (REQ-011: the warning)
    cards: structuredClone(SEEDS), notes: structuredClone(NOTES), hops: structuredClone(SEEDED_HOPS), chat: structuredClone(CHAT), proposals: structuredClone(PROPOSALS), chatHops: [],
    runs: [{
      id: RUN_1, projectId: PROJECT_ID, mode: "dispatcher", hopBudget: 3, startedAt: "2026-10-13T08:00:00+07:00", endedAt: "2026-10-13T08:06:00+07:00",
      stopReason: "budget_spent", report: "ทำครบ 3 ก้าว: ปิดขั้นแรก ขั้นเลือกห้องและเวลา และข้อมูล Room — ยังเหลือ 9 การ์ด",
    }, {
      id: RUN_2, projectId: PROJECT_ID, mode: "dispatcher", hopBudget: 10, startedAt: "2026-10-12T17:00:00+07:00", endedAt: "2026-10-12T17:04:00+07:00",
      stopReason: "nothing_workable", report: null,
    }],
    members: WORKERS.map((w) => w.id), edges: structuredClone(EDGES), entry: ENTRY,
  }];
  // TASK-B-083 (polish-plan § 2.7; shape from studies/REQ-014-polish-B/seed.ts): what a real operator ends up with. It REPLACES the plain seed's people and cards in
  // the one project: six people (long Thai names, a PM + BA entry, an FE + BE), a chain with a return line QA → SA, one person in no chain, one deleted worker,
  // a long folder path, three cards from an accepted proposal (the BE's is `doing` because a hop is running on it — v1.14 —, the QA's is stuck), and the entry
  // worker's chat reply with a question nobody has answered.
  if (opts.state === "operator-like" || opts.state === "code-map") { // (`code-map` is `operator-like` plus a code map, filled in below)
    const w = (n: number, name: string, roles: WorkerRole[], deletedAt: string | null = null): Worker => ({
      id: id("w", n), name, role: roles[0]!, roles, skills: roles.map((r) => `role-${r.toLowerCase()}`), model: "sonnet", effort: "medium", combinedFrom: null, avatar: null, deletedAt,
    });
    const [paul, sa, fena, beta, kit, qa] = [w(11, "Paul", ["PM", "BA"]), w(12, "สมศักดิ์ ศรีประเสริฐวงศ์", ["SA"]), w(13, "Fena", ["FE"]), w(14, "Beta", ["BE"]),
      w(15, "กิตติพงษ์ วัฒนาพาณิชย์กุล", ["FE", "BE"]), w(16, "ณัฐธิดา วิริยะกุลพัฒนาเลิศ", ["QA"])];
    workers.splice(0, workers.length, paul, sa, fena, beta, kit, qa, w(17, "ปาริชาตินันท์ ศรีสวัสดิ์วงศ์", ["QA"]), w(18, "อดีตสมาชิกทีมที่ลาออกไปแล้ว", ["FE"], "2026-10-10T09:00:00+07:00"));
    nextWorker = workers.length;
    const p = projects[0]!;
    p.members = [paul, sa, fena, beta, kit, qa].map((x) => x.id);
    p.edges = [[paul, sa], [sa, fena], [sa, beta], [sa, kit], [fena, qa], [beta, qa], [kit, qa], [qa, sa]].map(([a, b]) => ({ from: a!.id, to: b!.id }));
    p.entry = paul.id;
    p.roots = ["/Users/operator/Develyst/จองห้องประชุม-แอปพลิเคชันสำหรับองค์กรขนาดใหญ่/frontend-web-application", "/Users/operator/Develyst/mychannel-mc2-spec"];
    p.readOnly = ["/Users/operator/Develyst/mychannel-mc2-spec"]; // REQ-015 R4a (D-100): one folder the team may read but not write, so the screens have a case to show
    p.runs = [];
    p.notes = {};
    p.chatHops = [];
    const todo = "ทำให้ครบทุกกรณีรวมถึงกรณีที่ผู้ดูแลไม่ตอบภายในยี่สิบสี่ชั่วโมง";
    p.cards = [
      seed(1, "ทำ API ขออนุมัติการจองห้องประชุมขนาดใหญ่พร้อมแจ้งเตือน", todo, "doing", beta.id, "API-003"),
      seed(2, "ทำหน้าอนุมัติคำขอสำหรับผู้ดูแลอาคาร", todo, "todo", fena.id, "SCR-003", { dependsOn: [C(1)] }),
      seed(3, "ตรวจการอนุมัติห้องใหญ่ทุกกรณี", todo, "stuck", qa.id, "DEC-001", { dependsOn: [C(1), C(2)] }),
    ];
    const at = new Date().toISOString();
    p.hops = [{ id: id("h", 30), projectId: PROJECT_ID, runId: null, claimedBy: null, messageId: null, cardId: C(1), workerId: beta.id, startedAt: at, lastActivityAt: at, endedAt: null, outcome: null, tokensIn: null, tokensOut: null, note: "" }];
    p.chat = [
      { id: M(1), projectId: PROJECT_ID, author: "operator", text: "อยากให้ห้องประชุมใหญ่ที่จุเกินสิบคนต้องให้ผู้ดูแลอาคารอนุมัติก่อนจองทุกครั้ง และแจ้งผลกลับไปหาผู้ขอทั้งทางอีเมลและในแอป", replyTo: null, replyHopId: id("h", 7), questions: null, proposalId: null, amendment: null, retryRequestedAt: null, at: "2026-10-14T09:00:00+07:00" },
      { id: M(2), projectId: PROJECT_ID, author: `worker:${paul.id}`, text: "ตัดเป็นสามงานแล้ว ขอถามก่อนเริ่มหนึ่งข้อเรื่องเกณฑ์ห้องใหญ่", replyTo: M(1), replyHopId: null, proposalId: Q(1), amendment: null, retryRequestedAt: null, at: "2026-10-14T09:01:30+07:00",
        questions: [{ text: "ห้องใหญ่คือห้องที่จุกี่คนขึ้นไป และนับรวมห้องที่ต่อกันได้หรือไม่", proposedDefault: "เกิน 10 คน ไม่นับห้องที่ต่อกัน", cases: ["เกิน 10 คน", "เกิน 20 คน", "นับรวมห้องที่ต่อกันได้"] }] },
    ];
    p.proposals = [{
      id: Q(1), projectId: PROJECT_ID, messageId: M(1), version: BLUEPRINT_VERSION, status: "accepted", cardIds: [C(1), C(2), C(3)], createdAt: "2026-10-14T09:01:30+07:00", items: [
        { ...item("ทำ API ขออนุมัติการจองห้องประชุมขนาดใหญ่พร้อมแจ้งเตือน", todo, "API-003", beta.id, [], 2) },
        { ...item("ทำหน้าอนุมัติคำขอสำหรับผู้ดูแลอาคาร", todo, "SCR-003", fena.id, [0], 3) },
        { ...item("ตรวจการอนุมัติห้องใหญ่ทุกกรณี", todo, "DEC-001", qa.id, [0, 1], 1) },
      ],
    }];
    nextMessage = 2;
    nextCard = 3;
  }
  // REQ-015 R2: `code-map` = `operator-like` plus what a worker would have saved about the code, not yet confirmed by the operator (it is the entry worker's, Paul's, map)
  if (opts.state === "code-map") {
    const p = projects[0]!;
    p.codeMap = { ...structuredClone(SAMPLE_CODE_MAP), updatedAt: new Date(Date.now() - 20 * 60_000).toISOString(), updatedBy: `worker:${p.entry}`, confirmedAt: null };
  }
  // TASK-B-075: the entry worker's newest chat reply (M4, which already carries a proposal and an amendment) also asks the operator something, and no operator
  // message comes after it — so `entryAsked` holds and the entry seat waits on you. Everything else in the thread is the plain seed's.
  if (opts.state === "entry-asked" || opts.state === "entry-asked-two") {
    projects[0]!.chat.find((m) => m.id === M(4))!.questions = [{ text: "นับการจองที่ยกเลิกในสรุปรายวันด้วยไหม", proposedDefault: "ไม่นับ", cases: ["นับ", "ไม่นับ"] }];
    // TASK-B-117: `entry-asked-two` — the same reply asks a second thing, so the sheet can be seen taking two answers (TASK-B-119)
    if (opts.state === "entry-asked-two") projects[0]!.chat.find((m) => m.id === M(4))!.questions!.push({ text: "สรุปรายวันส่งให้ใครทุกเช้า", proposedDefault: "ผู้จัดการอาคาร", cases: ["ผู้จัดการอาคาร", "ทุกคนในทีม"] });
  }
  if (opts.state === "chat-failed" || opts.state === "chat-running") {
    const p = projects[0]!, failed = opts.state === "chat-failed";
    p.chat.find((m) => m.id === M(3))!.replyHopId = null;
    p.chat = p.chat.filter((m) => m.id !== M(4));
    p.proposals = p.proposals.filter((x) => x.id !== Q(3));
    p.chatHops.push({ id: id("h", 8), messageId: M(3), endedAt: failed ? "2026-10-14T09:20:40+07:00" : null, outcome: failed ? "failed" : null });
    if (!failed) {
      // TASK-B-075: caw-back lists a chat hop among the hops (`messageId` set, no card) — and a project has one running hop at a time, so it takes the place of the
      // card hop the plain seed runs (C5 — the block below skips it for this state). The entry worker is the one answering.
      const at = new Date().toISOString();
      p.hops.unshift({ id: id("h", 8), projectId: PROJECT_ID, runId: null, claimedBy: null, messageId: M(3), cardId: null, workerId: ENTRY, startedAt: at, lastActivityAt: at, endedAt: null, outcome: null, tokensIn: null, tokensOut: null, note: "" });
    }
  }
  if (opts.state === "new-project") projects.push(blank(1, ++nextProject));
  // C5 (TASK-B-073): the seed has one running card hop — ฝน's, started now (so she reads `working`, not quiet); `working-quiet` is the same hop started 12 minutes
  // before the seed was made, with no sign of life since (so `lastActivityAt` is 12 minutes old); `working-now` moves the running hop to แบงค์ on card 4 (a project has one running hop at a time).
  if (opts.state !== "chat-running" && opts.state !== "operator-like" && opts.state !== "code-map" && opts.state !== "manual-idle") { // (`operator-like` has its own running hop; `manual-idle` has none)
    const at = new Date();
    const running = (workerId: string, cardId: string, startedAt: Date): Hop => ({ // a hop's `lastActivityAt` is its start until a heartbeat moves it
      id: id("h", 20), projectId: PROJECT_ID, runId: null, claimedBy: null, messageId: null, cardId, workerId, startedAt: startedAt.toISOString(), lastActivityAt: startedAt.toISOString(),
      endedAt: null, outcome: null, tokensIn: null, tokensOut: null, note: "",
    });
    const hop = opts.state === "working-now" ? running(W.bank, C(4), at)
      : opts.state === "working-quiet" ? running(W.fern, C(3), new Date(at.getTime() - 12 * 60_000))
      : running(W.fern, C(3), at);
    projects[0]!.hops.unshift(hop);
  }

  if (opts.state === "manual-open-run") {
    projects[0]!.runs.unshift({ id: id("r", ++nextRun), projectId: PROJECT_ID, mode: "manual", hopBudget: 40, startedAt: "2026-10-13T09:00:00+07:00", endedAt: null, stopReason: null, report: null });
  }

  const byNumber = (a: { number: number }, b: { number: number }) => a.number - b.number;
  /** `hopsTotal` is the sum of the items' hops, computed whenever a proposal is read — never kept. */
  const withHop = (p: Proj, m: StoredMessage): ChatMessage => {
    const h = p.chatHops.filter((x) => x.messageId === m.id).at(-1); // the newest
    return { ...structuredClone(m), chatHop: h ? { id: h.id, endedAt: h.endedAt, outcome: h.outcome } : null };
  };
  const withTotal = (x: StoredProposal): Proposal => ({ ...structuredClone(x), hopsTotal: x.items.reduce((s, i) => s + i.hops, 0) });
  const get = (pid: string) => projects.find((p) => p.id === pid) ?? null;
  const need = (pid: string) => get(pid) ?? refuse(404, "not_found", "no such project");
  const locate = (cardId: string) => {
    for (const p of projects) { const c = p.cards.find((x) => x.id === cardId); if (c) return { p, c }; }
    return null;
  };
  const needCard = (cardId: string) => locate(cardId) ?? refuse(404, "not_found", "no such card");
  const worker = (wid: string) => workers.find((w) => w.id === wid) ?? refuse(404, "not_found", "no such worker");
  const text = (t: string, max = 8000) => { if (t.length < 1 || t.length > max) refuse(400, "validation", `text: 1–${max} characters`); return t; };

  /** The server's `workable`: a work card, todo|doing, every dependency done, no spec change waiting. */
  const workable = (p: Proj, c: Seed) => c.kind === "work" && (c.status === "todo" || c.status === "doing") && c.specChangedVersion === null
    && c.dependsOn.every((d) => p.cards.find((x) => x.id === d)?.status === "done");
  const full = (p: Proj, c: Seed): Card => ({ ...structuredClone(c), projectId: p.id, workable: workable(p, c), createdAt: "2026-10-12T20:00:00+07:00", updatedAt: "2026-10-13T09:00:00+07:00" });
  const isStuck = (c: Seed) => c.status === "stuck" || (c.kind === "question" && c.answer === null) || c.specChangedVersion !== null;
  const summary = (p: Proj): ProjectSummary => ({
    id: p.id, name: p.name, blueprintProjectId: p.blueprintProjectId, version: p.version, latestSeenVersion: p.latestSeenVersion,
    mode: p.mode, hopBudget: p.hopBudget, hopsUsed: p.hops.length, entryWorkerId: p.entry, workspace: { roots: [...p.roots], readOnly: [...p.readOnly] }, codeMap: structuredClone(p.codeMap), createdAt: p.createdAt,
    cardsDone: p.cards.filter((c) => c.status === "done").length, cardsTotal: p.cards.length, stuckCount: p.cards.filter(isStuck).length,
  });
  const run = (p: Proj, r: Omit<Run, "hopsUsed">): Run => ({ ...r, hopsUsed: p.hops.filter((h) => h.runId === r.id && h.endedAt !== null).length });
  const chainOf = (p: Proj): Chain => ({
    members: p.members.map((m) => structuredClone(worker(m))), edges: structuredClone(p.edges), entryWorkerId: p.entry,
  });
  const member = (p: Proj, wid: string) => { if (!p.members.includes(wid)) refuse(400, "not_a_member", "that worker is not in this project's chain"); };

  /** The hop a start makes: a project has one running hop (409 `hop_running` `{ hopId }`), and a card in `todo` becomes `doing` in the same step (v1.14). */
  const beginHop = (p: Proj, c: Seed, workerId: string): Hop => {
    const running = p.hops.find((h) => h.endedAt === null);
    if (running) refuse(409, "hop_running", "this project already has a hop running", { hopId: running.id });
    const at = new Date().toISOString();
    const hop: Hop = { id: id("h", ++nextHop), projectId: p.id, runId: null, claimedBy: null, messageId: null, cardId: c.id, workerId, startedAt: at, lastActivityAt: at, endedAt: null, outcome: null, tokensIn: null, tokensOut: null, note: "" };
    p.hops.unshift(hop);
    if (c.status === "todo") c.status = "doing";
    return structuredClone(hop);
  };

  const base: Omit<CawApi, "events" | "teamStatus"> = {
    // the operator's `ทำต่อ` (REQ-016 AC-4): 404 (project, card, worker) → hop_running → not_workable. `no_budget` is not modelled: the mock project has no run budget to spend in manual mode
    startHop: async (pid, cardId, workerId) => {
      const p = need(pid);
      const found = locate(cardId);
      if (!found || found.p.id !== p.id) return refuse(404, "not_found", "no such card");
      worker(workerId);
      const running = p.hops.find((h) => h.endedAt === null);
      if (running) refuse(409, "hop_running", "this project already has a hop running", { hopId: running.id });
      if (!workable(p, found.c)) refuse(409, "not_workable", "this card cannot be worked on now");
      return beginHop(p, found.c, workerId);
    },
    confirmCodeMap: async (pid) => {
      const p = need(pid);
      const map = p.codeMap ?? refuse(409, "no_code_map", "this project has no code map yet");
      map.confirmedAt ??= new Date().toISOString(); // asking again keeps the first time
      return structuredClone(map);
    },
    projects: async () => projects.map(summary),
    project: async (pid) => { const p = get(pid); return p ? summary(p) : null; },
    setMode: async (pid, next, budget) => {
      const p = get(pid);
      if (!p) return null;
      p.mode = next;
      if (budget !== undefined) p.hopBudget = budget;
      // back to manual ends the open run as the runner does (SPEC-B-002 "Mode switch"; TASK-B-047 Q1) — so "stopped" is reachable
      if (next === "manual") for (const r of p.runs) if (r.endedAt === null) { r.endedAt = new Date().toISOString(); r.stopReason = "operator_stopped"; }
      return summary(p);
    },
    setWorkspace: async (pid, next, readOnly = []) => {
      const p = get(pid);
      if (!p) return null;
      const bad = next.length > 20 || next.some((r) => !ABSOLUTE.test(r) || r.length > 500 || r.split(/[\\/]/).includes(".."));
      if (bad) refuse(400, "validation", "roots: at most 20 absolute paths, no `..` segment, each ≤ 500 chars");
      if (readOnly.some((r) => !next.includes(r))) refuse(400, "validation", "readOnly: every entry must be one of roots");
      p.roots = [...next];
      p.readOnly = [...readOnly];
      return summary(p);
    },
    cards: async (pid, query = {}) => { const p = get(pid); return !p ? [] : p.cards.map((c) => full(p, c)).filter((c) =>
      (query.assigneeId === undefined || c.assigneeId === query.assigneeId) && (query.status === undefined || c.status === query.status)
      && (query.workable === undefined || c.workable === query.workable)).sort(byNumber); },
    card: async (cardId) => { const f = locate(cardId); return f ? full(f.p, f.c) : null; },
    part: async (pid, key, version) => {
      if (version !== undefined && (!Number.isInteger(version) || version < 1)) refuse(400, "validation", "version: an integer ≥ 1");
      const p = get(pid), spec = SPECS[key];
      if (!p || !spec) return null;
      return {
        projectId: p.blueprintProjectId, version: version ?? p.latestSeenVersion, confirmedAt: "2026-10-12T20:00:00+07:00", part: structuredClone(spec.part),
        neighbours: structuredClone(spec.neighbours), decisions: spec.part.kind === "decision" ? [] : [structuredClone(SPECS["DEC-001"]!.part)], flows: [], questions: [],
      };
    },
    cardContext: async (cardId): Promise<CardContext | null> => {
      const f = locate(cardId);
      const spec = f ? SPECS[f.c.anchor.key] : undefined;
      if (!f || !spec) return null;
      const decisionPart = SPECS["DEC-001"]!.part;
      return {
        card: full(f.p, f.c),
        spec: {
          projectId: f.p.blueprintProjectId, version: f.c.anchor.version, confirmedAt: "2026-10-12T20:00:00+07:00", part: spec.part,
          neighbours: spec.neighbours, decisions: spec.part.kind === "decision" ? [] : [decisionPart], flows: [], questions: [],
        },
        notes: structuredClone(f.p.notes[f.c.id] ?? []),
        // the answered question cards this card depends on, directly
        decisions: f.c.dependsOn.flatMap((d) => { const q = f.p.cards.find((x) => x.id === d); return q && q.kind === "question" && q.answer !== null ? [{ cardId: q.id, number: q.number, question: q.question!.text, answer: q.answer }] : []; }),
      };
    },
    workers: async () => structuredClone(workers),
    chain: async (pid) => { const p = get(pid); return p ? chainOf(p) : null; },
    hops: async (pid, query = {}) => { const p = get(pid); return !p ? [] : structuredClone(p.hops).filter((h) => query.runId === undefined || h.runId === query.runId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, query.limit ?? 50); },
    hopOutput: async (hopId, query = {}) => {
      const hop = projects.flatMap((p) => p.hops).find((h) => h.id === hopId);
      if (!hop) return refuse(404, "not_found", "no such hop");
      const after = query.after ?? -1, limit = Math.min(Math.max(query.limit ?? 500, 1), 1000);
      const rest = screenOutput(hop, Date.now()).filter((e) => e.seq > after);
      return { hopId, entries: rest.slice(0, limit), more: rest.length > limit };
    },
    runs: async (pid, limit = 20) => { const p = get(pid); return !p ? [] : p.runs.map((r) => run(p, r)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit); },
    startRun: async (pid, budget) => {
      const p = need(pid);
      if (p.runs.some((r) => r.endedAt === null)) refuse(409, "run_open", "this project already has an open run");
      const r = { id: id("r", ++nextRun), projectId: pid, mode: p.mode, hopBudget: budget, startedAt: new Date().toISOString(), endedAt: null, stopReason: null, report: null };
      p.runs.push(r);
      return run(p, r);
    },
    // the operator stops an open run (D-056, TASK-B-055) — the mode is untouched; a run already over: 409 already_finished, as the route
    stopRun: async (runId) => {
      const found = projects.flatMap((p) => p.runs.map((r) => ({ p, r }))).find(({ r }) => r.id === runId);
      if (!found) return refuse(404, "not_found", "no such run");
      if (found.r.endedAt !== null) refuse(409, "already_finished", "this run is already over");
      found.r.endedAt = new Date().toISOString();
      found.r.stopReason = "operator_stopped";
      found.r.report = "";
      return run(found.p, found.r);
    },

    createProject: async ({ blueprintProjectId, version }) => {
      if (blueprintProjectId !== BLUEPRINT_PROJECT) refuse(404, "blueprint_project_not_found", "Blueprint has no such project");
      if (!Number.isInteger(version) || version < 1 || version > BLUEPRINT_LATEST) refuse(409, "version_not_confirmed", "that version is not confirmed in Blueprint");
      const there = projects.find((p) => p.blueprintProjectId === blueprintProjectId); // v1.15: one project per Blueprint project, whatever the version
      if (there) refuse(409, "already_exists", "a project already exists for this Blueprint project", { id: there.id });
      const p = blank(version, ++nextProject);
      projects.push(p);
      return summary(p);
    },
    comment: async (cardId, t) => {
      const { p, c } = needCard(cardId);
      const note: Note = { id: id("n", ++nextNote), type: "comment", actor: "operator", text: text(t), fromWorkerId: null, toWorkerId: null, allowed: null, at: new Date().toISOString() };
      (p.notes[c.id] ??= []).push(note);
      return structuredClone(note);
    },
    setStatus: async (cardId, status) => {
      const { p, c } = needCard(cardId);
      if (!STATUSES.includes(status)) refuse(400, "validation", "status: todo | doing | review | done | stuck");
      if (status === "doing" && c.dependsOn.some((d) => p.cards.find((x) => x.id === d)?.status !== "done")) refuse(409, "waiting_on_question", "a card this one depends on is still open");
      c.status = status;
      return full(p, c);
    },
    assign: async (cardId, workerId) => {
      const { p, c } = needCard(cardId);
      member(p, workerId); // the operator's authority ignores the chain's edges, not its members
      c.assigneeId = workerId;
      return full(p, c);
    },
    handoff: async (cardId, toWorkerId, t) => {
      const { p, c } = needCard(cardId);
      text(t);
      if (c.assigneeId === null) refuse(400, "validation", "a card nobody holds cannot be handed off");
      member(p, toWorkerId);
      const from = c.assigneeId;
      if (!p.edges.some((e) => e.from === from && e.to === toWorkerId)) {
        const allowed = p.edges.filter((e) => e.from === from).map((e) => e.to);
        // v1.3: the refusal is recorded on the card first, then the same 409 as before
        (p.notes[c.id] ??= []).push({ id: id("n", ++nextNote), type: "handoff_refused", actor: "operator", text: t, fromWorkerId: from, toWorkerId, allowed, at: new Date().toISOString() });
        refuse(409, "chain_broken", "the chain has no edge from the card's holder to that worker", { from, allowed });
      }
      c.assigneeId = toWorkerId;
      (p.notes[c.id] ??= []).push({ id: id("n", ++nextNote), type: "handoff", actor: "operator", text: t, fromWorkerId: from, toWorkerId, allowed: null, at: new Date().toISOString() });
      return full(p, c);
    },
    answer: async (cardId, a) => {
      const { p, c } = needCard(cardId);
      if (c.kind !== "question") refuse(400, "not_a_question", "only a question card is answered");
      if (c.answer !== null) refuse(409, "already_answered", "this question was already answered");
      c.answer = text(a);
      c.status = "done"; // frees the cards that depend on it
      return full(p, c);
    },
    clearSpecChange: async (cardId) => {
      const { p, c } = needCard(cardId);
      c.specChangedVersion = null;
      return full(p, c);
    },
    createWorker: async (input) => {
      const { name, skills, model, effort } = input;
      if (name.length < 1 || name.length > 40) refuse(400, "validation", "name: 1–40 characters");
      if (skills.length < 1) refuse(400, "validation", "skills: at least one");
      const given = input as { role?: WorkerRole; roles?: WorkerRole[] };
      if ((given.role === undefined) === (given.roles === undefined)) refuse(400, "validation", "send exactly one of `roles` and `role`");
      const roles = rolesOf(given.roles ?? [given.role!]);
      if (workers.some((w) => w.deletedAt === null && w.name === name)) refuse(409, "name_taken", "a worker with this name exists");
      const w: Worker = {
        id: id("w", ++nextWorker), name, role: roles[0]!, roles, skills: [...skills], combinedFrom: null, avatar: avatarOf(input.avatar), deletedAt: null,
        model: model ?? strongest(roles.map(roleModel)), effort: effort ?? "medium",
      };
      workers.push(w);
      return structuredClone(w);
    },
    updateWorker: async (workerId, patch) => {
      const w = worker(workerId);
      const sent = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined);
      if (sent.length < 1) refuse(400, "validation", "send at least one of name, roles, skills, model, effort");
      if (patch.name !== undefined && (patch.name.length < 1 || patch.name.length > 40)) refuse(400, "validation", "name: 1–40 characters");
      if (patch.skills !== undefined && patch.skills.length < 1) refuse(400, "validation", "skills: at least one");
      const roles = patch.roles === undefined ? undefined : rolesOf(patch.roles);
      if (patch.name !== undefined && workers.some((x) => x.id !== w.id && x.deletedAt === null && x.name === patch.name)) refuse(409, "name_taken", "a worker with this name exists");
      const avatar = patch.avatar === undefined ? undefined : avatarOf(patch.avatar);
      if (patch.name !== undefined) w.name = patch.name;
      if (roles) { w.roles = roles; w.role = roles[0]!; }
      if (patch.skills !== undefined) w.skills = [...patch.skills];
      if (patch.model !== undefined) w.model = patch.model;
      if (patch.effort !== undefined) w.effort = patch.effort;
      if (avatar !== undefined) w.avatar = avatar;
      return structuredClone(w);
    },
    deleteWorker: async (workerId) => {
      const w = workers.find((x) => x.id === workerId);
      if (!w || w.deletedAt !== null) refuse(404, "not_found", "no such worker");
      const projectIds = projects.filter((p) => p.members.includes(workerId)).map((p) => p.id);
      if (projectIds.length > 0) refuse(409, "worker_in_chain", "this worker is still in a chain", { projectIds });
      w!.deletedAt = new Date().toISOString(); // kept in the list, as the core keeps them
    },
    combineWorkers: async (name, [a, b]) => {
      const [wa, wb] = [worker(a), worker(b)];
      if (name.length < 1 || name.length > 40) refuse(400, "validation", "name: 1–40 characters");
      if (workers.some((w) => w.deletedAt === null && w.name === name)) refuse(409, "name_taken", "a worker with this name exists");
      const w: Worker = {
        id: id("w", ++nextWorker), name, role: "other", roles: ["other"], skills: [...new Set([...wa.skills, ...wb.skills])], combinedFrom: [a, b], avatar: null, deletedAt: null,
        model: STRENGTH[wa.model] >= STRENGTH[wb.model] ? wa.model : wb.model, effort: LEVEL[wa.effort] >= LEVEL[wb.effort] ? wa.effort : wb.effort,
      };
      workers.push(w);
      return structuredClone(w);
    },
    addMember: async (pid, workerId) => {
      const p = need(pid);
      worker(workerId);
      if (p.members.includes(workerId)) refuse(409, "already_member", "already in the chain");
      p.members.push(workerId);
      return chainOf(p);
    },
    removeMember: async (pid, workerId, reassignTo) => {
      const p = need(pid);
      if (!p.members.includes(workerId)) refuse(404, "not_found", "not in the chain");
      const running = p.hops.find((h) => h.workerId === workerId && h.endedAt === null); // v1.14: 404 → hop_running → is_entry → has_open_cards
      if (running) refuse(409, "hop_running", "this worker has a hop running", { hopId: running.id });
      if (p.entry === workerId) refuse(409, "is_entry", "the entry worker cannot be removed");
      const open = p.cards.filter((c) => c.assigneeId === workerId && c.status !== "done");
      if (open.length > 0 && reassignTo === undefined) refuse(409, "has_open_cards", "this worker still has open cards", { count: open.length });
      if (reassignTo !== undefined) { member(p, reassignTo); if (reassignTo === workerId) refuse(400, "validation", "reassignTo must be another member"); }
      for (const c of open) c.assigneeId = reassignTo!;
      p.members = p.members.filter((m) => m !== workerId);
      p.edges = p.edges.filter((e) => e.from !== workerId && e.to !== workerId);
      return chainOf(p);
    },
    addEdge: async (pid, from, to) => {
      const p = need(pid);
      member(p, from); member(p, to);
      if (from === to) refuse(400, "validation", "an edge joins two different workers");
      if (p.edges.some((e) => e.from === from && e.to === to)) refuse(409, "edge_exists", "that edge exists");
      p.edges.push({ from, to });
      return chainOf(p);
    },
    removeEdge: async (pid, from, to) => {
      const p = need(pid);
      if (!p.edges.some((e) => e.from === from && e.to === to)) refuse(404, "not_found", "no such edge");
      p.edges = p.edges.filter((e) => !(e.from === from && e.to === to));
      return chainOf(p);
    },
    setEntry: async (pid, workerId) => {
      const p = need(pid);
      member(p, workerId);
      p.entry = workerId;
      return chainOf(p);
    },

    chat: async (pid, query = {}) => {
      const p = get(pid);
      if (!p) return [];
      const from = query.after === undefined ? 0 : p.chat.findIndex((m) => m.id === query.after) + 1; // an unknown `after` starts from the top, as no cut
      return p.chat.slice(from, from + Math.min(query.limit ?? 50, 200)).map((m) => withHop(p, m));
    },
    postChat: async (pid, t) => {
      const p = need(pid);
      if (t.length < 1 || t.length > 4000) refuse(400, "validation", "text: 1–4 000 characters");
      const m: StoredMessage = { id: id("m", ++nextMessage), projectId: p.id, author: "operator", text: t, replyTo: null, replyHopId: null, questions: null, proposalId: null, amendment: null, retryRequestedAt: null, at: new Date().toISOString() };
      p.chat.push(m);
      return withHop(p, m);
    },
    retryChat: async (messageId) => {
      const found = projects.flatMap((p) => p.chat.map((m) => ({ p, m }))).find((x) => x.m.id === messageId);
      if (!found) return refuse(404, "not_found", "no such message");
      const { p, m } = found, hop = withHop(p, m).chatHop;
      if (m.author !== "operator") refuse(400, "not_operator_message", "only an operator message is retried");
      if (m.replyHopId !== null) refuse(409, "already_answered", "this message was answered");
      if (hop && hop.endedAt === null) refuse(409, "hop_running", "its chat step is still running");
      // a second retry before the runner picks it up only moves the time (never earlier, even inside the same millisecond)
      m.retryRequestedAt = new Date(Math.max(Date.now(), m.retryRequestedAt ? Date.parse(m.retryRequestedAt) + 1 : 0)).toISOString();
    },
    proposals: async (pid, query = {}) => {
      const p = get(pid);
      return !p ? [] : p.proposals.filter((x) => query.messageId === undefined || x.messageId === query.messageId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(withTotal);
    },
    acceptProposal: async (proposalId) => {
      const found = projects.flatMap((p) => p.proposals.map((x) => ({ p, x }))).find(({ x }) => x.id === proposalId);
      if (!found) return refuse(404, "not_found", "no such proposal");
      const { p, x } = found;
      if (x.status !== "open") refuse(409, "not_open", "this proposal is no longer open (accepted or superseded)");
      // the anchors are checked against Blueprint again first; one part gone and nothing is written
      if (x.items.some((i) => !SPECS[i.anchor.key])) refuse(422, "anchor_not_in_version", "a part of this proposal is not in Blueprint's version any more");
      const ids = x.items.map(() => id("c", ++nextCard));
      const base = Math.max(0, ...p.cards.map((c) => c.number)); // numbers run on from the project's own last card
      const made = x.items.map((i, k): Seed => ({
        id: ids[k]!, number: base + k + 1, kind: "work", title: i.title, todo: i.todo, status: "todo", assigneeId: i.workerId,
        anchor: { ...i.anchor }, specChangedVersion: null, dependsOn: i.dependsOn.map((d) => ids[d]!), question: null, answer: null,
      }));
      p.cards.push(...made);
      x.status = "accepted";
      x.cardIds = ids;
      return made.map((c) => full(p, c));
    },
  };

  // ---- the event log: every write that succeeds appends one event of its project (seq rising by one) — what the screens' live refresh looks at ----
  const log: CawEvent[] = [];
  const projectOfCard = (cardId: string) => locate(cardId)?.p.id ?? null;
  /** write method → [event type, the project it belongs to (from the call's arguments and its result)] */
  const WRITES: Record<string, [string, (args: any[], result: any) => string | null]> = {
    createProject: ["project.created", (_a, r) => r.id],
    setMode: ["project.mode_set", (a) => a[0]], setWorkspace: ["project.workspace_set", (a) => a[0]], startRun: ["run.started", (a) => a[0]],
    comment: ["card.commented", (a) => projectOfCard(a[0])], setStatus: ["card.status_set", (a) => projectOfCard(a[0])], assign: ["card.assigned", (a) => projectOfCard(a[0])],
    handoff: ["card.handed_off", (a) => projectOfCard(a[0])], answer: ["card.question_answered", (a) => projectOfCard(a[0])], clearSpecChange: ["card.spec_change_cleared", (a) => projectOfCard(a[0])],
    createWorker: ["worker.created", () => null], combineWorkers: ["worker.combined", () => null], updateWorker: ["worker.updated", () => null],
    addMember: ["chain.member_added", (a) => a[0]], removeMember: ["chain.member_removed", (a) => a[0]], addEdge: ["chain.edge_added", (a) => a[0]],
    removeEdge: ["chain.edge_removed", (a) => a[0]], setEntry: ["chain.entry_set", (a) => a[0]],
    postChat: ["chat.posted", (a) => a[0]], retryChat: ["chat.retry_requested", (a) => projects.find((p) => p.chat.some((m) => m.id === a[0]))?.id ?? null],
    acceptProposal: ["proposal.accepted", (_a, r) => r[0]?.projectId ?? null],
    confirmCodeMap: ["project.code_map_confirmed", (a) => a[0]],
    startHop: ["hop.started", (a) => a[0]],
  };
  const api: Record<string, unknown> = { ...base };
  for (const [name, [type, projectOf]] of Object.entries(WRITES)) {
    const write = (base as unknown as Record<string, (...a: any[]) => Promise<any>>)[name]!;
    api[name] = async (...args: any[]) => {
      const result = await write(...args); // a refused write throws here and appends nothing
      log.push({ seq: log.length + 1, at: new Date().toISOString(), actor: "operator", projectId: projectOf(args, result), type, data: {} });
      return result;
    };
  }
  api.events = async (pid: string, query: { after?: number; limit?: number } = {}) =>
    structuredClone(log.filter((e) => e.projectId === pid && e.seq > (query.after ?? 0)).slice(0, Math.min(query.limit ?? 100, 500)));
  // REQ-015 R1: the mock team is running unless the `team-down` state (or the runner) says it stopped; a stopped team was last seen ten minutes ago
  let teamRunning = opts.state !== "team-down";
  const lastSeen = new Date(Date.now() - 10 * 60_000).toISOString();
  (api as { teamStatus: CawApi["teamStatus"] }).teamStatus = async () =>
    teamRunning ? { running: true, runnerName: "mock", lastSeenAt: new Date().toISOString(), startCommand: "cd caw-back && bun run runner" } : { running: false, runnerName: null, lastSeenAt: lastSeen, startCommand: "cd caw-back && bun run runner" };
  const runner: MockRunner = {
    setTeamRunning: (running) => { teamRunning = running; },
    saveCodeMap: async (pid, map = SAMPLE_CODE_MAP) => {
      const p = need(pid);
      if (!p.entry) refuse(409, "no_entry_worker", "a code map is saved by the entry worker, and this project has none");
      const at = new Date().toISOString();
      p.codeMap = { ...structuredClone(map), updatedAt: at, updatedBy: `worker:${p.entry}`, confirmedAt: null };
      log.push({ seq: log.length + 1, at, actor: `worker:${p.entry}`, projectId: p.id, type: "project.code_map_saved", data: {} });
    },
    runnerStartHop: async (cardId, workerId) => {
      const { p, c } = needCard(cardId);
      worker(workerId);
      return beginHop(p, c, workerId);
    },
    replyChat: async (pid, text) => {
      const p = need(pid);
      const ask = p.chat.findLast((m) => m.author === "operator");
      if (!ask || !p.entry) return refuse(409, "nothing_to_answer", "there is no operator message to answer");
      const at = new Date().toISOString();
      // the core: the reply "sets the asked message's `replyHopId` to the running hop", and that hop ends when the runner finishes it — so an open chat hop on the ask
      // (`chat-running`) is the one answered and ended here; without one, the reply makes its own, already ended (TASK-B-115, D-103 Q-1)
      const open = p.chatHops.find((h) => h.messageId === ask.id && h.endedAt === null);
      if (open) {
        open.endedAt = at; open.outcome = "commented";
        const listed = p.hops.find((h) => h.id === open.id);
        if (listed) { listed.endedAt = at; listed.outcome = "commented"; }
        ask.replyHopId = open.id;
      } else if (ask.replyHopId === null) {
        const hopId = id("h", ++nextHop);
        p.chatHops.push({ id: hopId, messageId: ask.id, endedAt: at, outcome: "commented" });
        ask.replyHopId = hopId;
      }
      const reply: StoredMessage = { id: id("m", ++nextMessage), projectId: p.id, author: `worker:${p.entry}`, text, replyTo: ask.id, replyHopId: null, questions: null, proposalId: null, amendment: null, retryRequestedAt: null, at };
      p.chat.push(reply);
      log.push({ seq: log.length + 1, at, actor: reply.author, projectId: p.id, type: "chat.replied", data: {} });
      return withHop(p, reply);
    },
    finishHop: async (hopId) => {
      const hop = projects.flatMap((p) => p.hops).find((h) => h.id === hopId);
      if (!hop) return refuse(404, "not_found", "no such hop");
      hop.endedAt = new Date().toISOString();
      hop.outcome = "commented";
    },
  };
  return Object.assign(api as unknown as CawApi, runner);
}
