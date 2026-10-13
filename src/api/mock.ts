// `CawApi` in memory, seeded with SPEC-A-008's shapes (REQ-010 contract v1.0 + v1.1): one project from Blueprint's worked example
// (จองห้องประชุม; its part keys and titles), 12 cards across the five statuses incl. one open question card, 4 workers, a chain
// with an entry worker, one finished run with 3 hops and one manual hop, and a project with no workspace folders yet.
// Each `createMockApi()` is a fresh copy, so tests never share state; the app uses the one `index.ts` makes.
// Anything the real server computes (workable, the counts, hopsUsed) is computed here on read, never stored.
import {
  CawError, type Card, type CardContext, type CardStatus, type CawApi, type Chain, type ChatMessage, type Hop, type Mode, type Note,
  type PartContext, type ProjectSummary, type Run, type Worker,
} from "./caw";

const BLUEPRINT_VERSION = 3;        // the confirmed version the project was made from
const BLUEPRINT_LATEST = 4;         // the newest version CAW has seen (two cards' parts changed in it)
const BLUEPRINT_PROJECT = "11111111-2222-4333-8444-555555555555"; // a stand-in id: the mock has no Blueprint behind it

// deterministic uuid-shaped ids: a prefix per kind, then a counter
const PREFIX = { p: "10000000", w: "20000000", c: "30000000", n: "40000000", r: "50000000", h: "60000000" } as const;
const id = (kind: keyof typeof PREFIX, n: number) => `${PREFIX[kind]}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const PROJECT_ID = id("p", 1);
export const MOCK_PROJECT_ID = PROJECT_ID; // for the tests and the screens' first links, until a project list picks one

const W = { ploy: id("w", 1), fern: id("w", 2), bank: id("w", 3), mint: id("w", 4) };
const WORKERS: Worker[] = [
  { id: W.ploy, name: "ปลา", role: "PM", skills: ["role-pm"], model: "opus", effort: "high", combinedFrom: null },
  { id: W.fern, name: "ฝน", role: "FE", skills: ["role-fe", "frontend-finish"], model: "sonnet", effort: "medium", combinedFrom: null },
  { id: W.bank, name: "แบงค์", role: "BE", skills: ["role-be"], model: "sonnet", effort: "medium", combinedFrom: null },
  { id: W.mint, name: "มิ้นท์", role: "QA", skills: ["role-qa"], model: "sonnet", effort: "high", combinedFrom: null },
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
    { id: id("n", 1), type: "comment", actor: actor(W.bank), text: "ทำ endpoint อนุมัติเสร็จแล้ว ส่งให้ตรวจ", fromWorkerId: null, toWorkerId: null, at: "2026-10-13T09:10:00+07:00" },
    { id: id("n", 2), type: "handoff", actor: actor(W.bank), text: "ตรวจกฎห้องใหญ่ด้วย", fromWorkerId: W.bank, toWorkerId: W.mint, at: "2026-10-13T09:12:00+07:00" },
    { id: id("n", 3), type: "comment", actor: "operator", text: "spec ขั้นอนุมัติเพิ่งเปลี่ยน ช่วยดูอีกรอบ", fromWorkerId: null, toWorkerId: null, at: "2026-10-13T09:30:00+07:00" },
  ],
  [C(11)]: [
    { id: id("n", 4), type: "comment", actor: actor(W.ploy), text: "ถามคุณ: ถ้าผู้ดูแลไม่ตอบภายใน 24 ชม. ให้ปฏิเสธเองหรือเตือนก่อน?", fromWorkerId: null, toWorkerId: null, at: "2026-10-13T08:40:00+07:00" },
  ],
};

const RUN_1 = id("r", 1);
const HOPS: Hop[] = [
  { id: id("h", 1), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(9), workerId: W.ploy, startedAt: "2026-10-13T08:00:10+07:00", endedAt: "2026-10-13T08:00:48+07:00", outcome: "status", tokensIn: 3100, tokensOut: 1100, note: "ตัดการ์ดจาก spec และปิดขั้นแรก" },
  { id: id("h", 2), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(10), workerId: W.fern, startedAt: "2026-10-13T08:02:00+07:00", endedAt: "2026-10-13T08:02:52+07:00", outcome: "handed_off", tokensIn: 4500, tokensOut: 1600, note: "ทำขั้นเลือกห้องและเวลา ส่งต่อให้แบงค์" },
  { id: id("h", 3), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(8), workerId: W.bank, startedAt: "2026-10-13T08:05:30+07:00", endedAt: "2026-10-13T08:05:59+07:00", outcome: "commented", tokensIn: 2400, tokensOut: 900, note: "ตั้งข้อมูล Room" },
  // a manual hop: no run, no runner
  { id: id("h", 4), projectId: PROJECT_ID, runId: null, claimedBy: null, cardId: C(6), workerId: W.bank, startedAt: "2026-10-13T09:10:00+07:00", endedAt: "2026-10-13T09:11:11+07:00", outcome: "commented", tokensIn: 6400, tokensOut: 2400, note: "ทำ API อนุมัติการจอง" },
];

const CHAT: ChatMessage[] = [
  { id: "m-1", at: "2026-10-13T08:30:00+07:00", from: "operator", text: "เริ่มจากหน้าค้นหาห้องก่อนนะ" },
  { id: "m-2", at: "2026-10-13T08:30:20+07:00", from: "worker", text: "รับทราบ ตัดการ์ดหน้าค้นหาห้องไว้ให้ฝนแล้ว" },
];

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;

export function createMockApi(): CawApi {
  let mode: Mode = "manual";
  let hopBudget = 40;
  let roots: string[] = []; // a new project has no folders yet (REQ-011: the warning)
  const cards: Seed[] = structuredClone(SEEDS);
  const hops: Hop[] = structuredClone(HOPS);
  const chat = structuredClone(CHAT);
  const runs: Omit<Run, "hopsUsed">[] = [{
    id: RUN_1, projectId: PROJECT_ID, mode: "dispatcher", hopBudget: 3, startedAt: "2026-10-13T08:00:00+07:00", endedAt: "2026-10-13T08:06:00+07:00",
    stopReason: "budget_spent", report: "ทำครบ 3 ก้าว: ปิดขั้นแรก ขั้นเลือกห้องและเวลา และข้อมูล Room — ยังเหลือ 9 การ์ด",
  }];
  const mine = (pid: string) => pid === PROJECT_ID;
  const byNumber = (a: { number: number }, b: { number: number }) => a.number - b.number;

  /** The server's `workable`: a work card, todo|doing, every dependency done, no spec change waiting. */
  const workable = (c: Seed) => c.kind === "work" && (c.status === "todo" || c.status === "doing") && c.specChangedVersion === null
    && c.dependsOn.every((d) => cards.find((x) => x.id === d)?.status === "done");
  const full = (c: Seed): Card => ({ ...structuredClone(c), projectId: PROJECT_ID, workable: workable(c), createdAt: "2026-10-12T20:00:00+07:00", updatedAt: "2026-10-13T09:00:00+07:00" });
  const isStuck = (c: Seed) => c.status === "stuck" || (c.kind === "question" && c.answer === null) || c.specChangedVersion !== null;
  const summary = (): ProjectSummary => ({
    id: PROJECT_ID, name: "จองห้องประชุม", blueprintProjectId: BLUEPRINT_PROJECT, version: BLUEPRINT_VERSION, latestSeenVersion: BLUEPRINT_LATEST,
    mode, hopBudget, hopsUsed: hops.length, entryWorkerId: ENTRY, workspace: { roots: [...roots] }, createdAt: "2026-10-12T20:00:00+07:00",
    cardsDone: cards.filter((c) => c.status === "done").length, cardsTotal: cards.length, stuckCount: cards.filter(isStuck).length,
  });
  const run = (r: Omit<Run, "hopsUsed">): Run => ({ ...r, hopsUsed: hops.filter((h) => h.runId === r.id && h.endedAt !== null).length });

  return {
    projects: async () => [summary()],
    project: async (pid) => (mine(pid) ? summary() : null),
    setMode: async (pid, next, budget) => {
      if (!mine(pid)) return null;
      mode = next;
      if (budget !== undefined) hopBudget = budget;
      return summary();
    },
    setWorkspace: async (pid, next) => {
      if (!mine(pid)) return null;
      const bad = next.length > 20 || next.some((r) => !ABSOLUTE.test(r) || r.length > 500 || r.split(/[\\/]/).includes(".."));
      if (bad) throw new CawError(400, "bad_request", "roots: at most 20 absolute paths, no `..` segment, each ≤ 500 chars");
      roots = [...next];
      return summary();
    },
    cards: async (pid, query = {}) => !mine(pid) ? [] : cards.map(full).filter((c) =>
      (query.assigneeId === undefined || c.assigneeId === query.assigneeId) && (query.status === undefined || c.status === query.status)
      && (query.workable === undefined || c.workable === query.workable)).sort(byNumber),
    card: async (cardId) => { const c = cards.find((x) => x.id === cardId); return c ? full(c) : null; },
    cardContext: async (cardId): Promise<CardContext | null> => {
      const c = cards.find((x) => x.id === cardId);
      if (!c) return null;
      const spec = SPECS[c.anchor.key];
      if (!spec) return null;
      const decisionPart = SPECS["DEC-001"]!.part;
      return {
        card: full(c),
        spec: {
          projectId: BLUEPRINT_PROJECT, version: c.anchor.version, confirmedAt: "2026-10-12T20:00:00+07:00", part: spec.part,
          neighbours: spec.neighbours, decisions: spec.part.kind === "decision" ? [] : [decisionPart], flows: [], questions: [],
        },
        notes: structuredClone(NOTES[c.id] ?? []),
        // the answered question cards this card depends on, directly
        decisions: c.dependsOn.flatMap((d) => { const q = cards.find((x) => x.id === d); return q && q.kind === "question" && q.answer !== null ? [{ cardId: q.id, number: q.number, question: q.question!.text, answer: q.answer }] : []; }),
      };
    },
    workers: async () => structuredClone(WORKERS),
    chain: async (pid): Promise<Chain | null> => (mine(pid) ? { members: structuredClone(WORKERS), edges: structuredClone(EDGES), entryWorkerId: ENTRY } : null),
    hops: async (pid, query = {}) => !mine(pid) ? [] : structuredClone(hops).filter((h) => query.runId === undefined || h.runId === query.runId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, query.limit ?? 50),
    runs: async (pid, limit = 20) => !mine(pid) ? [] : runs.map(run).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit),
    startRun: async (pid, budget) => {
      if (!mine(pid)) throw new CawError(404, "not_found", "no such project");
      if (runs.some((r) => r.endedAt === null)) throw new CawError(409, "run_open", "this project already has an open run");
      const r = { id: id("r", runs.length + 1), projectId: pid, mode, hopBudget: budget, startedAt: new Date().toISOString(), endedAt: null, stopReason: null, report: null };
      runs.push(r);
      return run(r);
    },
    chat: async (pid) => structuredClone(mine(pid) ? chat : []),
    sendChat: async (pid, text) => {
      if (!mine(pid)) return [];
      const at = new Date().toISOString();
      chat.push({ id: `m-${chat.length + 1}`, at, from: "operator", text });
      chat.push({ id: `m-${chat.length + 1}`, at, from: "worker", text: "รับทราบ (ข้อความจำลอง — ยังไม่ได้ต่อกับทีมจริง)" }); // TODO REQ-013
      return structuredClone(chat);
    },
  };
}

