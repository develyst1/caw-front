// `CawApi` in memory, seeded with SPEC-A-008's shapes (REQ-010 contract v1.0 + v1.1): one project from Blueprint's worked example
// (จองห้องประชุม; its part keys and titles), 12 cards across the five statuses incl. one open question card, 4 workers, a chain
// with an entry worker, two finished runs (3 + 2 hops) and one manual hop, and a project with no workspace folders yet. Every operator
// write of SPEC-A-008 follows the back end's rules (chain_broken, run_open, has_open_cards, already_exists, ...); creating a project
// from the one Blueprint project the mock knows makes a second, empty one.
// Each `createMockApi()` is a fresh copy, so tests never share state; the app uses the one `index.ts` makes.
// Anything the real server computes (workable, the counts, hopsUsed) is computed here on read, never stored.
import {
  CawError, type Card, type CardContext, type CardStatus, type CawApi, type Chain, type ChatMessage, type Effort, type Hop, type Mode,
  type ModelName, type Note, type PartContext, type ProjectSummary, type Run, type Worker,
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

const RUN_1 = id("r", 1), RUN_2 = id("r", 2); // r-2 is the older one
const HOPS: Hop[] = [
  { id: id("h", 1), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(9), workerId: W.ploy, startedAt: "2026-10-13T08:00:10+07:00", endedAt: "2026-10-13T08:00:48+07:00", outcome: "status", tokensIn: 3100, tokensOut: 1100, note: "ตัดการ์ดจาก spec และปิดขั้นแรก" },
  { id: id("h", 2), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(10), workerId: W.fern, startedAt: "2026-10-13T08:02:00+07:00", endedAt: "2026-10-13T08:02:52+07:00", outcome: "handed_off", tokensIn: 4500, tokensOut: 1600, note: "ทำขั้นเลือกห้องและเวลา ส่งต่อให้แบงค์" },
  { id: id("h", 3), projectId: PROJECT_ID, runId: RUN_1, claimedBy: "runner-1", cardId: C(8), workerId: W.bank, startedAt: "2026-10-13T08:05:30+07:00", endedAt: "2026-10-13T08:05:59+07:00", outcome: "commented", tokensIn: 2400, tokensOut: 900, note: "ตั้งข้อมูล Room" },
  // an older run (the day before) that ran out of things to do
  { id: id("h", 5), projectId: PROJECT_ID, runId: RUN_2, claimedBy: "runner-1", cardId: C(9), workerId: W.ploy, startedAt: "2026-10-12T17:00:10+07:00", endedAt: "2026-10-12T17:01:00+07:00", outcome: "commented", tokensIn: 2600, tokensOut: 800, note: "ไล่ spec ขั้นแรกกับทีม" },
  { id: id("h", 6), projectId: PROJECT_ID, runId: RUN_2, claimedBy: "runner-1", cardId: C(10), workerId: W.fern, startedAt: "2026-10-12T17:03:00+07:00", endedAt: "2026-10-12T17:03:41+07:00", outcome: "asked", tokensIn: 3900, tokensOut: 1300, note: "ถามเรื่องห้องที่จุเกิน 10 คน" },
  // a manual hop: no run, no runner
  { id: id("h", 4), projectId: PROJECT_ID, runId: null, claimedBy: null, cardId: C(6), workerId: W.bank, startedAt: "2026-10-13T09:10:00+07:00", endedAt: "2026-10-13T09:11:11+07:00", outcome: "commented", tokensIn: 6400, tokensOut: 2400, note: "ทำ API อนุมัติการจอง" },
];

const CHAT: ChatMessage[] = [
  { id: "m-1", at: "2026-10-13T08:30:00+07:00", from: "operator", text: "เริ่มจากหน้าค้นหาห้องก่อนนะ" },
  { id: "m-2", at: "2026-10-13T08:30:20+07:00", from: "worker", text: "รับทราบ ตัดการ์ดหน้าค้นหาห้องไว้ให้ฝนแล้ว" },
];

const ABSOLUTE = /^(\/|[A-Za-z]:[\\/])/;
const NOW = "2026-10-13T10:00:00+07:00";
const STRENGTH: Record<ModelName, number> = { haiku: 0, sonnet: 1, opus: 2 };
const LEVEL: Record<Effort, number> = { low: 0, medium: 1, high: 2 };
const STATUSES: CardStatus[] = ["todo", "doing", "review", "done", "stuck"];

/** One project's state. Workers are global (below); a project uses them through its chain. */
interface Proj {
  id: string; name: string; blueprintProjectId: string; version: number; latestSeenVersion: number;
  mode: Mode; hopBudget: number; roots: string[]; createdAt: string;
  cards: Seed[]; notes: Record<string, Note[]>; hops: Hop[]; runs: Omit<Run, "hopsUsed">[]; chat: ChatMessage[];
  members: string[]; edges: { from: string; to: string }[]; entry: string | null;
}

const refuse = (status: number, code: string, message: string, details?: unknown): never => { throw new CawError(status, code, message, details); };

export function createMockApi(): CawApi {
  const workers: Worker[] = structuredClone(WORKERS);
  let nextWorker = workers.length, nextProject = 1, nextNote = 100, nextRun = 2; // runs r-1 and r-2 are seeded
  const projects: Proj[] = [{
    id: PROJECT_ID, name: "จองห้องประชุม", blueprintProjectId: BLUEPRINT_PROJECT, version: BLUEPRINT_VERSION, latestSeenVersion: BLUEPRINT_LATEST,
    mode: "manual", hopBudget: 40, roots: [], createdAt: "2026-10-12T20:00:00+07:00", // a new project has no folders yet (REQ-011: the warning)
    cards: structuredClone(SEEDS), notes: structuredClone(NOTES), hops: structuredClone(HOPS), chat: structuredClone(CHAT),
    runs: [{
      id: RUN_1, projectId: PROJECT_ID, mode: "dispatcher", hopBudget: 3, startedAt: "2026-10-13T08:00:00+07:00", endedAt: "2026-10-13T08:06:00+07:00",
      stopReason: "budget_spent", report: "ทำครบ 3 ก้าว: ปิดขั้นแรก ขั้นเลือกห้องและเวลา และข้อมูล Room — ยังเหลือ 9 การ์ด",
    }, {
      id: RUN_2, projectId: PROJECT_ID, mode: "dispatcher", hopBudget: 10, startedAt: "2026-10-12T17:00:00+07:00", endedAt: "2026-10-12T17:04:00+07:00",
      stopReason: "nothing_workable", report: null,
    }],
    members: WORKERS.map((w) => w.id), edges: structuredClone(EDGES), entry: ENTRY,
  }];

  const byNumber = (a: { number: number }, b: { number: number }) => a.number - b.number;
  const get = (pid: string) => projects.find((p) => p.id === pid) ?? null;
  const need = (pid: string) => get(pid) ?? refuse(404, "not_found", "no such project");
  const locate = (cardId: string) => {
    for (const p of projects) { const c = p.cards.find((x) => x.id === cardId); if (c) return { p, c }; }
    return null;
  };
  const needCard = (cardId: string) => locate(cardId) ?? refuse(404, "not_found", "no such card");
  const worker = (wid: string) => workers.find((w) => w.id === wid) ?? refuse(404, "not_found", "no such worker");
  const text = (t: string, max = 8000) => { if (t.length < 1 || t.length > max) refuse(400, "bad_request", `text: 1–${max} characters`); return t; };

  /** The server's `workable`: a work card, todo|doing, every dependency done, no spec change waiting. */
  const workable = (p: Proj, c: Seed) => c.kind === "work" && (c.status === "todo" || c.status === "doing") && c.specChangedVersion === null
    && c.dependsOn.every((d) => p.cards.find((x) => x.id === d)?.status === "done");
  const full = (p: Proj, c: Seed): Card => ({ ...structuredClone(c), projectId: p.id, workable: workable(p, c), createdAt: "2026-10-12T20:00:00+07:00", updatedAt: "2026-10-13T09:00:00+07:00" });
  const isStuck = (c: Seed) => c.status === "stuck" || (c.kind === "question" && c.answer === null) || c.specChangedVersion !== null;
  const summary = (p: Proj): ProjectSummary => ({
    id: p.id, name: p.name, blueprintProjectId: p.blueprintProjectId, version: p.version, latestSeenVersion: p.latestSeenVersion,
    mode: p.mode, hopBudget: p.hopBudget, hopsUsed: p.hops.length, entryWorkerId: p.entry, workspace: { roots: [...p.roots] }, createdAt: p.createdAt,
    cardsDone: p.cards.filter((c) => c.status === "done").length, cardsTotal: p.cards.length, stuckCount: p.cards.filter(isStuck).length,
  });
  const run = (p: Proj, r: Omit<Run, "hopsUsed">): Run => ({ ...r, hopsUsed: p.hops.filter((h) => h.runId === r.id && h.endedAt !== null).length });
  const chainOf = (p: Proj): Chain => ({
    members: p.members.map((m) => structuredClone(worker(m))), edges: structuredClone(p.edges), entryWorkerId: p.entry,
  });
  const member = (p: Proj, wid: string) => { if (!p.members.includes(wid)) refuse(400, "not_a_member", "that worker is not in this project's chain"); };

  return {
    projects: async () => projects.map(summary),
    project: async (pid) => { const p = get(pid); return p ? summary(p) : null; },
    setMode: async (pid, next, budget) => {
      const p = get(pid);
      if (!p) return null;
      p.mode = next;
      if (budget !== undefined) p.hopBudget = budget;
      return summary(p);
    },
    setWorkspace: async (pid, next) => {
      const p = get(pid);
      if (!p) return null;
      const bad = next.length > 20 || next.some((r) => !ABSOLUTE.test(r) || r.length > 500 || r.split(/[\\/]/).includes(".."));
      if (bad) refuse(400, "bad_request", "roots: at most 20 absolute paths, no `..` segment, each ≤ 500 chars");
      p.roots = [...next];
      return summary(p);
    },
    cards: async (pid, query = {}) => { const p = get(pid); return !p ? [] : p.cards.map((c) => full(p, c)).filter((c) =>
      (query.assigneeId === undefined || c.assigneeId === query.assigneeId) && (query.status === undefined || c.status === query.status)
      && (query.workable === undefined || c.workable === query.workable)).sort(byNumber); },
    card: async (cardId) => { const f = locate(cardId); return f ? full(f.p, f.c) : null; },
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
    runs: async (pid, limit = 20) => { const p = get(pid); return !p ? [] : p.runs.map((r) => run(p, r)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit); },
    startRun: async (pid, budget) => {
      const p = need(pid);
      if (p.runs.some((r) => r.endedAt === null)) refuse(409, "run_open", "this project already has an open run");
      const r = { id: id("r", ++nextRun), projectId: pid, mode: p.mode, hopBudget: budget, startedAt: new Date().toISOString(), endedAt: null, stopReason: null, report: null };
      p.runs.push(r);
      return run(p, r);
    },

    createProject: async ({ blueprintProjectId, version }) => {
      if (blueprintProjectId !== BLUEPRINT_PROJECT) refuse(404, "blueprint_project_not_found", "Blueprint has no such project");
      if (!Number.isInteger(version) || version < 1 || version > BLUEPRINT_LATEST) refuse(409, "version_not_confirmed", "that version is not confirmed in Blueprint");
      const there = projects.find((p) => p.blueprintProjectId === blueprintProjectId && p.version === version);
      if (there) refuse(409, "already_exists", "a project already exists for this Blueprint version", { id: there.id });
      const p: Proj = {
        id: id("p", ++nextProject), name: "จองห้องประชุม", blueprintProjectId, version, latestSeenVersion: BLUEPRINT_LATEST,
        mode: "manual", hopBudget: 0, roots: [], createdAt: NOW, cards: [], notes: {}, hops: [], runs: [], chat: [], members: [], edges: [], entry: null,
      };
      projects.push(p);
      return summary(p);
    },
    comment: async (cardId, t) => {
      const { p, c } = needCard(cardId);
      const note: Note = { id: id("n", ++nextNote), type: "comment", actor: "operator", text: text(t), fromWorkerId: null, toWorkerId: null, at: new Date().toISOString() };
      (p.notes[c.id] ??= []).push(note);
      return structuredClone(note);
    },
    setStatus: async (cardId, status) => {
      const { p, c } = needCard(cardId);
      if (!STATUSES.includes(status)) refuse(400, "bad_request", "status: todo | doing | review | done | stuck");
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
      if (c.assigneeId === null) refuse(400, "bad_request", "a card nobody holds cannot be handed off");
      member(p, toWorkerId);
      const from = c.assigneeId;
      if (!p.edges.some((e) => e.from === from && e.to === toWorkerId)) {
        refuse(409, "chain_broken", "the chain has no edge from the card's holder to that worker", { from, allowed: p.edges.filter((e) => e.from === from).map((e) => e.to) });
      }
      c.assigneeId = toWorkerId;
      (p.notes[c.id] ??= []).push({ id: id("n", ++nextNote), type: "handoff", actor: "operator", text: t, fromWorkerId: from, toWorkerId, at: new Date().toISOString() });
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
    createWorker: async ({ name, role, skills, model, effort }) => {
      if (name.length < 1 || name.length > 40) refuse(400, "bad_request", "name: 1–40 characters");
      if (skills.length < 1) refuse(400, "bad_request", "skills: at least one");
      if (workers.some((w) => w.name === name)) refuse(409, "name_taken", "a worker with this name exists");
      const w: Worker = {
        id: id("w", ++nextWorker), name, role, skills: [...skills], combinedFrom: null,
        model: model ?? (role === "PM" || role === "SA" || role === "QA" ? "opus" : "sonnet"), effort: effort ?? "medium",
      };
      workers.push(w);
      return structuredClone(w);
    },
    combineWorkers: async (name, [a, b]) => {
      const [wa, wb] = [worker(a), worker(b)];
      if (name.length < 1 || name.length > 40) refuse(400, "bad_request", "name: 1–40 characters");
      if (workers.some((w) => w.name === name)) refuse(409, "name_taken", "a worker with this name exists");
      const w: Worker = {
        id: id("w", ++nextWorker), name, role: "other", skills: [...new Set([...wa.skills, ...wb.skills])], combinedFrom: [a, b],
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
      if (p.entry === workerId) refuse(409, "is_entry", "the entry worker cannot be removed");
      const open = p.cards.filter((c) => c.assigneeId === workerId && c.status !== "done");
      if (open.length > 0 && reassignTo === undefined) refuse(409, "has_open_cards", "this worker still has open cards", { count: open.length });
      if (reassignTo !== undefined) { member(p, reassignTo); if (reassignTo === workerId) refuse(400, "bad_request", "reassignTo must be another member"); }
      for (const c of open) c.assigneeId = reassignTo!;
      p.members = p.members.filter((m) => m !== workerId);
      p.edges = p.edges.filter((e) => e.from !== workerId && e.to !== workerId);
      return chainOf(p);
    },
    addEdge: async (pid, from, to) => {
      const p = need(pid);
      member(p, from); member(p, to);
      if (from === to) refuse(400, "bad_request", "an edge joins two different workers");
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

    chat: async (pid) => structuredClone(get(pid)?.chat ?? []),
    sendChat: async (pid, t) => {
      const p = get(pid);
      if (!p) return [];
      const at = new Date().toISOString();
      p.chat.push({ id: `m-${p.chat.length + 1}`, at, from: "operator", text: t });
      p.chat.push({ id: `m-${p.chat.length + 1}`, at, from: "worker", text: "รับทราบ (ข้อความจำลอง — ยังไม่ได้ต่อกับทีมจริง)" }); // TODO REQ-013
      return structuredClone(p.chat);
    },
  };
}
