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
    expect(p!.workspace).toEqual({ roots: [] });
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
