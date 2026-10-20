// The mock honours SPEC-A-008's shapes (REQ-010 contract v1.0 + v1.1) — the screens are built against it until caw-back's OpenAPI lands.
import { describe, expect, test } from "bun:test";
import { CawError, type CawApi } from "./caw";
import { createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

/** The seeded project's summary (the counts come with the list, as in the contract). */
const summaryOf = async (api: CawApi) => (await api.projects()).find((p) => p.id === PID)!;
const expectRefusal = async (p: Promise<unknown>, status: number, code: string) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(CawError);
  expect([(e as CawError).status, (e as CawError).code]).toEqual([status, code]);
};

describe("projects", () => {
  test("one project, from Blueprint's worked example: manual mode, no workspace folders yet, an entry worker", async () => {
    const [p] = await createMockApi().projects();
    expect(p!.name).toBe("จองห้องประชุม");
    expect(p!.mode).toBe("manual");
    expect(p!.workspace).toEqual({ roots: [], readOnly: [] }); // (Revision 2: B-107)
    expect(p!.entryWorkerId).not.toBeNull();
    expect(p!.latestSeenVersion).toBeGreaterThanOrEqual(p!.version);
  });

  test("cardsDone / cardsTotal / stuckCount / hopsUsed are computed, not stored", async () => {
    const api = createMockApi();
    const [p, cards, hops] = [await summaryOf(api), await api.cards(PID), await api.hops(PID)];
    expect(p.cardsTotal).toBe(cards.length);
    expect(p.cardsDone).toBe(cards.filter((c) => c.status === "done").length);
    // stuck = status stuck + open question cards + specChangedVersion set
    expect(p.stuckCount).toBe(cards.filter((c) => c.status === "stuck" || (c.kind === "question" && c.answer === null) || c.specChangedVersion !== null).length);
    expect(p.hopsUsed).toBe(hops.length);
  });

  test("setMode changes the mode (and the budget when given) and nothing else; each mock is its own copy", async () => {
    const a = createMockApi(), b = createMockApi();
    const [cards, hops] = [await a.cards(PID), await a.hops(PID)];
    const after = (await a.setMode(PID, "dispatcher", 25))!;
    expect([after.mode, after.hopBudget]).toEqual(["dispatcher", 25]);
    expect((await a.setMode(PID, "manual"))!.hopBudget).toBe(25); // no budget given: unchanged
    expect(await a.cards(PID)).toEqual(cards);
    expect(await a.hops(PID)).toEqual(hops);
    expect((await b.project(PID))!.mode).toBe("manual");
    expect(await a.setMode("nope", "manual")).toBeNull();
  });

  test("setWorkspace keeps the folders; refuses a relative path, a `..` segment, more than 20, or 500+ chars", async () => {
    const api = createMockApi();
    expect((await api.setWorkspace(PID, ["/Users/me/my-repo", "/Users/me/other"]))!.workspace.roots).toEqual(["/Users/me/my-repo", "/Users/me/other"]);
    expect((await api.project(PID))!.workspace.roots).toHaveLength(2);
    await expectRefusal(api.setWorkspace(PID, ["relative/path"]), 400, "validation");
    await expectRefusal(api.setWorkspace(PID, ["/Users/me/../you"]), 400, "validation");
    await expectRefusal(api.setWorkspace(PID, Array.from({ length: 21 }, (_, i) => `/r${i}`)), 400, "validation");
    await expectRefusal(api.setWorkspace(PID, [`/${"x".repeat(500)}`]), 400, "validation");
    expect((await api.project(PID))!.workspace.roots).toHaveLength(2); // a refusal changes nothing
    expect((await api.setWorkspace(PID, []))!.workspace.roots).toEqual([]);
  });
});

describe("cards", () => {
  test("12 cards numbered 1…12 across the 5 statuses, exactly 1 question card and it is open and the operator's", async () => {
    const cards = await createMockApi().cards(PID);
    expect(cards.map((c) => c.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(cards.map((c) => c.status))).toEqual(new Set(["todo", "doing", "review", "done", "stuck"]));
    const questions = cards.filter((c) => c.kind === "question");
    expect(questions).toHaveLength(1);
    expect(questions[0]!.assigneeId).toBeNull();
    expect(questions[0]!.answer).toBeNull();
    expect(questions[0]!.question!.cases.length).toBeGreaterThanOrEqual(1);
    expect(cards.filter((c) => c.kind === "work").every((c) => c.question === null && c.assigneeId !== null)).toBe(true);
  });

  test("every card names a worker in the chain, an anchor, and dependencies that exist", async () => {
    const api = createMockApi();
    const [cards, chain] = [await api.cards(PID), (await api.chain(PID))!];
    const members = new Set(chain.members.map((w) => w.id)), ids = new Set(cards.map((c) => c.id));
    for (const c of cards) {
      if (c.assigneeId !== null) expect(members.has(c.assigneeId)).toBe(true);
      expect(c.anchor.key.length).toBeGreaterThan(0);
      for (const d of c.dependsOn) expect(ids.has(d)).toBe(true);
    }
  });

  test("`workable` is the server's rule: a work card, todo|doing, every dependency done, no spec change", async () => {
    const cards = await createMockApi().cards(PID);
    const done = new Set(cards.filter((c) => c.status === "done").map((c) => c.id));
    for (const c of cards) {
      const want = c.kind === "work" && (c.status === "todo" || c.status === "doing") && c.specChangedVersion === null && c.dependsOn.every((d) => done.has(d));
      expect([c.number, c.workable]).toEqual([c.number, want]);
    }
    expect(cards.some((c) => c.workable)).toBe(true);
    expect(cards.some((c) => !c.workable && c.status === "doing")).toBe(true); // c-5 waits on a card that is stuck
  });

  test("filters: by assignee, status and workable", async () => {
    const api = createMockApi();
    const all = await api.cards(PID);
    const w = all[0]!.assigneeId!;
    expect((await api.cards(PID, { assigneeId: w })).every((c) => c.assigneeId === w)).toBe(true);
    expect((await api.cards(PID, { status: "done" })).map((c) => c.status)).toEqual(["done", "done", "done"]);
    const workable = await api.cards(PID, { workable: true });
    expect(workable.length).toBeGreaterThan(0);
    expect(workable.every((c) => c.workable)).toBe(true);
    expect(await api.cards("nope")).toEqual([]);
    expect(await api.card("nope")).toBeNull();
  });

  test("every hop has `lastActivityAt` (v1.11, never null); the mock has no runner, so none has had a heartbeat: it is each hop's `startedAt`", async () => {
    const hops = await createMockApi({ state: "working-now" }).hops(PID);
    expect(hops.length).toBeGreaterThan(0);
    for (const h of hops) expect(h.lastActivityAt).toBe(h.startedAt);
    expect(hops.filter((h) => h.endedAt === null)).toHaveLength(1);
  });

  test("a card's context carries the card, its Blueprint part with neighbours and decisions, and its notes oldest first", async () => {
    const api = createMockApi();
    const step3 = (await api.cards(PID)).find((c) => c.anchor.key === "STEP-003")!;
    const ctx = (await api.cardContext(step3.id))!;
    expect(ctx.card.id).toBe(step3.id);
    expect(ctx.spec.part.key).toBe("STEP-003");
    expect(ctx.spec.neighbours.length).toBeGreaterThan(0);
    expect(ctx.spec.decisions.map((d) => d.key)).toContain("DEC-001");
    const withNotes = (await api.cards(PID)).find((c) => c.anchor.key === "API-003")!;
    const notes = (await api.cardContext(withNotes.id))!.notes;
    expect(notes.map((n) => n.type)).toEqual(["comment", "handoff", "handoff_refused", "comment"]); // v1.3 seed (TASK-B-048)
    expect(notes[2]!.allowed).toEqual([]); // มิ้นท์ hands to nobody in the seeded chain
    expect(notes.map((n) => n.at)).toEqual([...notes.map((n) => n.at)].sort());
    expect(notes[1]!.fromWorkerId).not.toBeNull();
    expect(await api.cardContext("nope")).toBeNull();
  });

  test("part (v1.7): a part by key — its PartContext whether or not a card holds it; a key Blueprint does not have, or an unknown project, is null; a bad version is refused", async () => {
    const api = createMockApi();
    const ctx = (await api.part(PID, "SCR-003"))!;
    expect([ctx.part.key, ctx.part.kind, ctx.part.title]).toEqual(["SCR-003", "screen", "หน้าอนุมัติคำขอ"]);
    expect(ctx.version).toBe((await api.project(PID))!.latestSeenVersion); // default = the project's latestSeenVersion
    expect((await api.part(PID, "SCR-003", 1))!.version).toBe(1);
    expect(ctx.neighbours.length).toBeGreaterThan(0);
    expect(await api.part(PID, "STEP-099")).toBeNull(); // the part that is gone
    expect(await api.part("nope", "SCR-003")).toBeNull();
    for (const v of [0, -1, 1.5]) await expectRefusal(api.part(PID, "SCR-003", v), 400, "validation");
  });
});

describe("workers, chain", () => {
  test("4 workers with the contract's roles / models / efforts; the chain's entry worker is a member and every edge joins two members", async () => {
    const api = createMockApi();
    const [workers, chain] = [await api.workers(), (await api.chain(PID))!];
    expect(workers).toHaveLength(4);
    for (const w of workers) {
      expect(["PM", "SA", "FE", "BE", "QA", "other"]).toContain(w.role);
      expect(["opus", "sonnet", "haiku"]).toContain(w.model);
      expect(["low", "medium", "high"]).toContain(w.effort);
      expect(w.skills.length).toBeGreaterThanOrEqual(1);
    }
    const members = new Set(chain.members.map((w) => w.id));
    expect(members.has(chain.entryWorkerId!)).toBe(true);
    expect(chain.edges.length).toBeGreaterThan(0);
    for (const e of chain.edges) { expect(members.has(e.from)).toBe(true); expect(members.has(e.to)).toBe(true); expect(e.from).not.toBe(e.to); }
    expect((await api.project(PID))!.entryWorkerId).toBe(chain.entryWorkerId);
    expect(await api.chain("nope")).toBeNull();
  });
});

describe("runs and hops (v1.1)", () => {
  test("two finished runs (3 + 2 hops) newest first, and two manual hops (no run, no runner): one finished, one running — ฝน's (C5)", async () => {
    const api = createMockApi();
    const [runs, hops] = [await api.runs(PID), await api.hops(PID)];
    expect(runs).toHaveLength(2);
    const [newer, older] = runs as [typeof runs[number], typeof runs[number]];
    expect(newer.startedAt > older.startedAt).toBe(true);
    expect([newer.stopReason, newer.hopsUsed, older.stopReason, older.hopsUsed]).toEqual(["budget_spent", 3, "nothing_workable", 2]);
    expect(runs.every((r) => r.endedAt !== null)).toBe(true);
    expect(hops).toHaveLength(7);
    expect(hops.filter((h) => h.runId === newer.id)).toHaveLength(3);
    expect(hops.filter((h) => h.runId === older.id)).toHaveLength(2);
    const manual = hops.filter((h) => h.runId === null);
    expect(manual).toHaveLength(2); // the old finished one and the one running now
    expect(manual.every((h) => h.claimedBy === null)).toBe(true);
    expect(manual.filter((h) => h.endedAt === null)).toHaveLength(1);
    expect(hops.map((h) => h.startedAt)).toEqual([...hops.map((h) => h.startedAt)].sort().reverse());
    expect((await api.hops(PID, { runId: newer.id })).length).toBe(3);
    expect(await api.hops(PID, { limit: 2 })).toHaveLength(2);
    const finished = hops.filter((h) => h.endedAt !== null);
    expect(finished).toHaveLength(6);
    expect(finished.every((h) => h.tokensIn !== null && h.tokensOut !== null && h.outcome !== null)).toBe(true);
    expect((await api.projects())[0]!.hopsUsed).toBe(7); // every hop, run or manual, the running one too
  });

  test("startRun opens a run (mode at start, budget given); a second one while it is open is refused 409 run_open", async () => {
    const api = createMockApi();
    await api.setMode(PID, "dispatcher");
    const run = await api.startRun(PID, 10);
    expect([run.mode, run.hopBudget, run.endedAt, run.stopReason, run.report, run.hopsUsed]).toEqual(["dispatcher", 10, null, null, null, 0]);
    expect((await api.runs(PID))[0]!.id).toBe(run.id); // newest first
    await expectRefusal(api.startRun(PID, 5), 409, "run_open");
    await expectRefusal(createMockApi().startRun("nope", 5), 404, "not_found");
    expect(await api.runs(PID)).toHaveLength(3); // the refusal added nothing
  });
});

describe("seed variants (POST /test-reset?state=…)", () => {
  test("dispatcher-stopped: the project is on อัตโนมัติ, its newest run ended budget_spent by itself, no run is open", async () => {
    const api = createMockApi({ state: "dispatcher-stopped" });
    const [p, runs] = [(await api.project(PID))!, await api.runs(PID)];
    expect(p.mode).toBe("dispatcher");
    expect(runs[0]!.endedAt).not.toBeNull();
    expect(runs[0]!.stopReason).toBe("budget_spent");
    expect(runs.some((r) => r.endedAt === null)).toBe(false);
    expect(p.hopBudget).toBe(40);
  });
  test("the plain seed is unchanged: manual, and no state means the same as before", async () => {
    expect((await createMockApi().project(PID))!.mode).toBe("manual");
    expect((await createMockApi({}).project(PID))!.mode).toBe("manual");
  });
});

describe("team status (REQ-015 R1, contract v1.16)", () => {
  test("the mock team is running by default; `team-down` is not, with a last-seen time ten minutes ago; the start command is the same", async () => {
    const up = await createMockApi().teamStatus();
    expect(up).toEqual({ running: true, runnerName: "mock", lastSeenAt: expect.any(String), startCommand: "cd caw-back && bun run dev" });
    const down = await createMockApi({ state: "team-down" }).teamStatus();
    expect([down.running, down.runnerName, down.startCommand]).toEqual([false, null, "cd caw-back && bun run dev"]);
    const ago = Date.now() - Date.parse(down.lastSeenAt!);
    expect(ago).toBeGreaterThan(9.9 * 60_000);
    expect(ago).toBeLessThan(10.5 * 60_000);
  });
  test("the runner flips it without a reset: down then up, and nothing else in the project changes", async () => {
    const api = createMockApi();
    const before = JSON.stringify(await api.projects());
    await api.setTeamRunning(false);
    expect((await api.teamStatus()).running).toBe(false);
    expect((await api.teamStatus()).runnerName).toBeNull();
    await api.setTeamRunning(true);
    expect(await api.teamStatus()).toMatchObject({ running: true, runnerName: "mock" });
    expect(JSON.stringify(await api.projects())).toBe(before);
  });
  test("it is a read: the event log does not move", async () => {
    const api = createMockApi();
    await api.setTeamRunning(false);
    await api.teamStatus();
    expect(await api.events(PID)).toEqual([]);
  });
});

describe("POST /test-reset?team=… (TASK-B-103; the door of the reply door's gate)", () => {
  const saved = { api: process.env.CAW_API, gate: process.env.CAW_TEST_RESET };
  const restore = () => { for (const [k, v] of [["CAW_API", saved.api], ["CAW_TEST_RESET", saved.gate]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  const post = async (query: string) => (await import("../app/test-reset/route")).POST(new Request(`http://x/test-reset${query}`, { method: "POST" }));
  test("?team=up|down flips the mock team behind the same gate; anything else → 400; gate off → 404 and nothing changes", async () => {
    try {
      process.env.CAW_API = "mock"; process.env.CAW_TEST_RESET = "1";
      expect((await post("")).status).toBe(204);
      const { api } = await import("./index");
      expect((await api.teamStatus()).running).toBe(true);
      expect((await post("?team=down")).status).toBe(204);
      expect((await api.teamStatus()).running).toBe(false);
      expect((await post("?team=up")).status).toBe(204);
      expect((await api.teamStatus()).running).toBe(true);
      expect((await post("?team=sideways")).status).toBe(400);
      expect((await post("?team=")).status).toBe(400);
      delete process.env.CAW_TEST_RESET;
      expect((await post("?team=down")).status).toBe(404);
      process.env.CAW_TEST_RESET = "1"; process.env.CAW_API = "http";
      expect((await post("?team=down")).status).toBe(404);
      process.env.CAW_API = "mock";
      expect((await api.teamStatus()).running).toBe(true); // the refused calls changed nothing
      expect((await post("")).status).toBe(204);
    } finally { restore(); }
  });
});

describe("code map (REQ-015 R2, SPEC-A-009 Revision 1 A3)", () => {
  test("every project starts with no code map: the seed, `operator-like`, and a second project", async () => {
    expect((await createMockApi().project(PID))!.codeMap).toBeNull();
    expect((await createMockApi({ state: "operator-like" }).project(PID))!.codeMap).toBeNull();
    expect((await createMockApi({ state: "new-project" }).projects()).map((x) => x.codeMap)).toEqual([null, null]); // the second project too
  });
  test("`code-map` is a known state: the `operator-like` project plus a filled, unconfirmed map (FE + BE + other folder, a stack, 2 run and 2 test commands, no rules, 2 questions with a default)", async () => {
    const api = createMockApi({ state: "code-map" });
    const p = (await api.project(PID))!;
    const m = p.codeMap!;
    expect(m.folders.map((f) => f.kind).sort()).toEqual(["be", "fe", "other"]);
    expect(m.folders.every((f) => f.name.length > 0)).toBe(true);
    expect(m.stack.length).toBeGreaterThan(0);
    expect([m.commands.run.length, m.commands.test.length, m.rules.length]).toEqual([2, 2, 0]);
    expect(m.questions).toHaveLength(2);
    expect(m.questions.every((q) => q.text.length > 0 && q.proposedDefault.length > 0)).toBe(true);
    expect([m.confirmedAt, typeof m.updatedAt, typeof m.updatedBy]).toEqual([null, "string", "string"]);
    // the rest is the operator-like seed
    const like = createMockApi({ state: "operator-like" });
    expect(await api.chain(PID)).toEqual(await like.chain(PID));
    expect((await api.cards(PID)).length).toBe((await like.cards(PID)).length);
    expect({ ...p, codeMap: null }).toEqual((await like.project(PID))! as never);
  });
  test("confirm sets confirmedAt, returns the map, writes `project.code_map_confirmed` (lastSeq moves); the project reads it back", async () => {
    const api = createMockApi({ state: "code-map" });
    const seq0 = (await api.events(PID)).at(-1)?.seq ?? 0;
    const confirmed = await api.confirmCodeMap(PID);
    expect(confirmed.confirmedAt).not.toBeNull();
    expect(Math.abs(Date.now() - Date.parse(confirmed.confirmedAt!))).toBeLessThan(5000);
    expect((await api.project(PID))!.codeMap).toEqual(confirmed);
    const evs = await api.events(PID, { after: seq0 });
    expect(evs.map((e) => e.type)).toEqual(["project.code_map_confirmed"]);
    expect(evs[0]!.seq).toBe(seq0 + 1);
  });
  test("confirming again keeps the first time (and still answers 200)", async () => {
    const api = createMockApi({ state: "code-map" });
    const first = await api.confirmCodeMap(PID);
    await Bun.sleep(5);
    expect((await api.confirmCodeMap(PID)).confirmedAt).toBe(first.confirmedAt);
  });
  test("confirm with no map → 409 no_code_map and no event; an unknown project → 404", async () => {
    const api = createMockApi();
    await expectRefusal(api.confirmCodeMap(PID), 409, "no_code_map");
    await expectRefusal(api.confirmCodeMap("p-nope"), 404, "not_found");
    expect(await api.events(PID)).toEqual([]);
  });
});

describe("saving a code map, the way the setup step does (TASK-B-110, REQ-015 R2)", () => {
  test("with no map given it saves the `code-map` sample on a project that had none: updatedBy is the entry worker, unconfirmed, and `project.code_map_saved` is written", async () => {
    const api = createMockApi();
    const entry = (await api.project(PID))!.entryWorkerId!;
    const seq0 = (await api.events(PID)).at(-1)?.seq ?? 0;
    await api.saveCodeMap(PID);
    const m = (await api.project(PID))!.codeMap!;
    expect(m.updatedBy).toBe(`worker:${entry}`);
    expect(m.confirmedAt).toBeNull();
    expect(Math.abs(Date.now() - Date.parse(m.updatedAt))).toBeLessThan(5000);
    expect(m.folders.map((f) => f.kind).sort()).toEqual(["be", "fe", "other"]);
    const evs = await api.events(PID, { after: seq0 });
    expect(evs.map((e) => e.type)).toEqual(["project.code_map_saved"]);
    expect(evs[0]!.seq).toBe(seq0 + 1);
  });
  test("saving again replaces the map and clears `confirmedAt`; a given map is the one saved", async () => {
    const api = createMockApi({ state: "code-map" });
    await api.confirmCodeMap(PID);
    expect((await api.project(PID))!.codeMap!.confirmedAt).not.toBeNull();
    await api.saveCodeMap(PID);
    expect((await api.project(PID))!.codeMap!.confirmedAt).toBeNull();
    const mine = { folders: [{ name: "x", kind: "be" as const }], stack: ["Bun"], commands: { run: ["a"], test: ["b"] }, rules: ["r"], questions: [], confirmedAt: "2020-01-01T00:00:00.000Z" };
    await api.saveCodeMap(PID, mine);
    const m = (await api.project(PID))!.codeMap!;
    expect([m.folders, m.stack, m.rules, m.confirmedAt]).toEqual([mine.folders, ["Bun"], ["r"], null]); // even a `confirmedAt` in the map given does not survive a save
    expect((await api.events(PID)).filter((e) => e.type === "project.code_map_saved")).toHaveLength(2);
  });
  test("an unknown project → 404 and no event", async () => {
    const api = createMockApi();
    await expectRefusal(api.saveCodeMap("p-nope"), 404, "not_found");
    expect(await api.events(PID)).toEqual([]);
  });
  test("a project with no entry worker has nobody to save it: 409 no_entry_worker", async () => {
    const api = createMockApi({ state: "new-project" });
    const NEW = (await api.projects()).find((p) => p.id !== PID)!.id;
    await expectRefusal(api.saveCodeMap(NEW), 409, "no_entry_worker");
    expect((await api.project(NEW))!.codeMap).toBeNull();
  });
});

describe("POST /test-reset?codeMap=save (TASK-B-110)", () => {
  const saved = { api: process.env.CAW_API, gate: process.env.CAW_TEST_RESET };
  const restore = () => { for (const [k, v] of [["CAW_API", saved.api], ["CAW_TEST_RESET", saved.gate]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  const post = async (query: string) => (await import("../app/test-reset/route")).POST(new Request(`http://x/test-reset${query}`, { method: "POST" }));
  test("gate on → 204 and the first project carries a map, unconfirmed; anything but `save` → 400; gate off → 404 and nothing changes", async () => {
    try {
      process.env.CAW_API = "mock"; process.env.CAW_TEST_RESET = "1";
      expect((await post("")).status).toBe(204);
      const { api } = await import("./index");
      expect((await api.project(PID))!.codeMap).toBeNull();
      expect((await post("?codeMap=other")).status).toBe(400);
      expect((await post("?codeMap=")).status).toBe(400);
      expect((await api.project(PID))!.codeMap).toBeNull();
      expect((await post("?codeMap=save")).status).toBe(204);
      expect((await api.project(PID))!.codeMap!.confirmedAt).toBeNull();
      expect((await post("")).status).toBe(204); // a reset brings the none back
      delete process.env.CAW_TEST_RESET;
      expect((await post("?codeMap=save")).status).toBe(404);
      process.env.CAW_TEST_RESET = "1"; process.env.CAW_API = "http";
      expect((await post("?codeMap=save")).status).toBe(404);
      process.env.CAW_API = "mock";
      expect((await api.project(PID))!.codeMap).toBeNull(); // the refused calls changed nothing
      expect((await post("")).status).toBe(204);
    } finally { restore(); }
  });
});
