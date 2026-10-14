// Who is doing what, at a glance (REQ-014 R4): per seat in chain order, entry first — working > stuck > waiting on you > free.
import { describe, expect, test } from "bun:test";
import type { Card, Chain, Hop, Worker } from "@/api/caw";
import { crewState } from "./crew";

const W = (n: number, name: string): Worker => ({ id: `w${n}`, name, role: "FE", roles: ["FE"], skills: ["x"], model: "sonnet", effort: "medium", combinedFrom: null });
const [pla, fern, bank, mint] = [W(1, "ปลา"), W(2, "ฝน"), W(3, "แบงค์"), W(4, "มิ้นท์")];
const chain = (entry: string | null = "w1", members = [fern, pla, bank, mint]): Chain => ({ members, edges: [], entryWorkerId: entry });
const card = (n: number, over: Partial<Card> = {}): Card => ({
  id: `c${n}`, projectId: "p", number: n, kind: "work", title: `งาน ${n}`, todo: "", status: "todo", assigneeId: null, anchor: { key: "SCR-001", version: 1 },
  specChangedVersion: null, dependsOn: [], question: null, answer: null, workable: true, createdAt: "", updatedAt: "", ...over,
});
const hop = (n: number, workerId: string, cardId: string, endedAt: string | null): Hop => ({
  id: `h${n}`, projectId: "p", runId: null, claimedBy: null, cardId, workerId, startedAt: "2026-10-14T09:00:00+07:00", endedAt, lastActivityAt: "2026-10-14T09:00:00+07:00", outcome: endedAt ? "commented" : null,
  tokensIn: null, tokensOut: null, note: "",
});
const ask = (n: number, over: Partial<Card> = {}) => card(n, { kind: "question", title: `ถาม ${n}`, question: { text: "?", proposedDefault: "a", cases: [] }, workable: false, ...over });
const stateOf = (seats: ReturnType<typeof crewState>, name: string) => seats.find((s) => s.worker.name === name)!;

describe("crewState", () => {
  test("seats come in chain order with the entry worker first", () => {
    expect(crewState(chain("w1"), [], []).map((s) => s.worker.name)).toEqual(["ปลา", "ฝน", "แบงค์", "มิ้นท์"]);
    expect(crewState(chain("w3"), [], []).map((s) => s.worker.name)).toEqual(["แบงค์", "ฝน", "ปลา", "มิ้นท์"]);
    expect(crewState(chain(null), [], []).map((s) => s.worker.name)).toEqual(["ฝน", "ปลา", "แบงค์", "มิ้นท์"]); // no entry: as the chain lists them
  });

  test("working: a hop that has not ended, on a card, by that worker — with the card", () => {
    const seats = crewState(chain(), [card(1)], [hop(1, "w2", "c1", null)]);
    expect(stateOf(seats, "ฝน")).toMatchObject({ state: "working", card: { id: "c1" } });
    expect(stateOf(seats, "ปลา").state).toBe("free");
  });

  test("a hop that ended is not work in progress", () => {
    expect(stateOf(crewState(chain(), [card(1)], [hop(1, "w2", "c1", "2026-10-14T09:01:00+07:00")]), "ฝน").state).toBe("free");
  });

  test("stuck: a card of theirs in status stuck — with the card (the lowest number when there are several)", () => {
    const seats = crewState(chain(), [card(5, { status: "stuck", assigneeId: "w3" }), card(2, { status: "stuck", assigneeId: "w3" }), card(3, { status: "doing", assigneeId: "w4" })], []);
    expect(stateOf(seats, "แบงค์")).toMatchObject({ state: "stuck", card: { id: "c2" } });
    expect(stateOf(seats, "มิ้นท์").state).toBe("idleWithWork"); // `doing` with nobody running it is not stuck — it is work in hand (D-066)
  });

  test("waiting on you: an open question card assigned to them, or one that a card of theirs waits for; an answered one is not", () => {
    const q = ask(9);
    const seats = crewState(chain(), [q, card(2, { assigneeId: "w2", dependsOn: ["c9"] }), card(3, { assigneeId: "w3", dependsOn: ["c10"] }), ask(10, { answer: "ใช่" }), ask(11, { assigneeId: "w4" })], []);
    expect(stateOf(seats, "ฝน")).toMatchObject({ state: "waitingOnYou", card: { id: "c9" } });
    expect(stateOf(seats, "แบงค์").state).toBe("free"); // its question was answered
    expect(stateOf(seats, "มิ้นท์")).toMatchObject({ state: "waitingOnYou", card: { id: "c11" } });
  });

  test("a card of theirs that is done does not make them wait", () => {
    const seats = crewState(chain(), [ask(9), card(2, { assigneeId: "w2", dependsOn: ["c9"], status: "done" })], []);
    expect(stateOf(seats, "ฝน").state).toBe("free");
  });

  test("priority: working beats stuck beats waiting on you beats free", () => {
    const cards = [card(1, { status: "stuck", assigneeId: "w2" }), ask(9), card(2, { assigneeId: "w2", dependsOn: ["c9"] }), card(3, { assigneeId: "w3", status: "stuck" }), card(4, { assigneeId: "w3", dependsOn: ["c9"] })];
    const seats = crewState(chain(), cards, [hop(1, "w2", "c2", null)]);
    expect(stateOf(seats, "ฝน")).toMatchObject({ state: "working", card: { id: "c2" } }); // stuck + waiting + working → working
    expect(stateOf(seats, "แบงค์")).toMatchObject({ state: "stuck", card: { id: "c3" } }); // stuck + waiting → stuck
    expect(stateOf(seats, "ปลา").state).toBe("free");
  });

  test("a running hop on a card the list does not have still reads as working (no card)", () => {
    expect(stateOf(crewState(chain(), [], [hop(1, "w2", "c-gone", null)]), "ฝน")).toMatchObject({ state: "working", card: null });
  });

  test("idleWithWork: no running hop but at least one card of theirs in `doing` → the count and the lowest-numbered such card (D-066)", () => {
    const seats = crewState(chain(), [card(4, { assigneeId: "w3", status: "doing" }), card(2, { assigneeId: "w3", status: "doing" }), card(5, { assigneeId: "w3", status: "todo" }), card(6, { assigneeId: "w4", status: "done" })], []);
    expect(stateOf(seats, "แบงค์")).toMatchObject({ state: "idleWithWork", n: 2, card: { id: "c2" } });
    expect(stateOf(seats, "มิ้นท์").state).toBe("free"); // done and todo are not work in hand
    expect(stateOf(seats, "ปลา").state).toBe("free");
  });

  test("the priority is working → stuck → waiting on you → idleWithWork → free", () => {
    const cards = [
      card(1, { assigneeId: "w2", status: "doing" }), card(2, { assigneeId: "w3", status: "doing" }), card(3, { assigneeId: "w3", status: "stuck" }),
      card(4, { assigneeId: "w4", status: "doing" }), ask(9), card(5, { assigneeId: "w4", dependsOn: ["c9"] }),
    ];
    const seats = crewState(chain(), cards, [hop(1, "w2", "c1", null)]);
    expect(stateOf(seats, "ฝน").state).toBe("working"); // doing + running hop
    expect(stateOf(seats, "แบงค์").state).toBe("stuck"); // doing + stuck
    expect(stateOf(seats, "มิ้นท์").state).toBe("waitingOnYou"); // doing + waiting
    expect(stateOf(seats, "ปลา").state).toBe("free");
    expect(crewState(chain(), [card(1, { assigneeId: "w4", status: "doing" })], [])[3]).toMatchObject({ state: "idleWithWork", n: 1 });
  });

  test("`n` belongs to idleWithWork only", () => {
    const seats = crewState(chain(), [card(1, { assigneeId: "w2", status: "stuck" })], []);
    expect(stateOf(seats, "ฝน").n).toBeUndefined();
  });
});

// ---- the home's one line per project: who is working, how many seats are stuck, how many wait on you (D-066 C4) ----
import type { CawApi, ProjectSummary } from "@/api/caw";
import { crewSummary, homeSummaries } from "./crew";

describe("crewSummary", () => {
  test("working = the name of the first working seat in chain order (null when nobody), stuck and waitingOnYou are counts of seats", () => {
    const cards = [card(1, { status: "stuck", assigneeId: "w3" }), ask(9), card(2, { assigneeId: "w4", dependsOn: ["c9"] })];
    const seats = crewState(chain(), [...cards, card(7, { assigneeId: "w2" })], [hop(1, "w2", "c7", null)]);
    expect(crewSummary(seats)).toEqual({ working: "ฝน", stuck: 1, waitingOnYou: 1 });
    expect(crewSummary(crewState(chain(), [], []))).toEqual({ working: null, stuck: 0, waitingOnYou: 0 });
    expect(crewSummary([])).toEqual({ working: null, stuck: 0, waitingOnYou: 0 });
  });
  test("idleWithWork and free seats count nowhere", () => {
    expect(crewSummary(crewState(chain(), [card(1, { assigneeId: "w2", status: "doing" })], []))).toEqual({ working: null, stuck: 0, waitingOnYou: 0 });
  });
});

describe("homeSummaries", () => {
  const projects = (...ids: string[]) => ids.map((id) => ({ id }) as ProjectSummary);
  const apiOf = (calls: string[]): CawApi => ({
    chain: async (id: string) => { calls.push(`chain ${id}`); return id === "p1" ? chain() : { members: [], edges: [], entryWorkerId: null }; },
    cards: async (id: string) => { calls.push(`cards ${id}`); return id === "p1" ? [card(1, { status: "stuck", assigneeId: "w3" })] : []; },
    hops: async (id: string, q?: { limit?: number }) => { calls.push(`hops ${id} limit=${q?.limit}`); return id === "p1" ? [hop(1, "w2", "c1", null)] : []; },
  }) as unknown as CawApi;

  test("no projects → nothing, and no reads", async () => {
    const calls: string[] = [];
    expect(await homeSummaries(apiOf(calls), [])).toEqual({});
    expect(calls).toEqual([]);
  });
  test("several projects → one summary each, by id; THREE reads per project (the chain, its cards, its newest hop — a project has one running hop at a time, so the newest is the one)", async () => {
    const calls: string[] = [];
    const out = await homeSummaries(apiOf(calls), projects("p1", "p2"));
    expect(out).toEqual({ p1: { working: "ฝน", stuck: 1, waitingOnYou: 0 }, p2: { working: null, stuck: 0, waitingOnYou: 0 } });
    expect(calls.sort()).toEqual(["cards p1", "cards p2", "chain p1", "chain p2", "hops p1 limit=1", "hops p2 limit=1"]);
  });
  test("a project the back end no longer has (chain null) reads as an empty crew, not an error", async () => {
    const api = { chain: async () => null, cards: async () => [], hops: async () => [] } as unknown as CawApi;
    expect(await homeSummaries(api, projects("gone"))).toEqual({ gone: { working: null, stuck: 0, waitingOnYou: 0 } });
  });
});

// ---- the stale signal (D-064, v1.11): a running hop that has shown no life for 10 minutes ----
import { quietMinutes, STALE_MINUTES } from "./crew";

describe("quietMinutes", () => {
  const T0 = Date.parse("2026-10-14T09:00:00+07:00");
  const running = (lastActivityAt: string) => ({ ...hop(1, "w2", "c1", null), lastActivityAt });
  const at = (min: number) => new Date(T0 + min * 60_000);

  test("STALE_MINUTES is 10 (the screen's line starts there)", () => { expect(STALE_MINUTES).toBe(10); });

  test("whole minutes since `Hop.lastActivityAt`, rounded down: 9 min 59 s is 9, 10 min is 10", () => {
    const h = running(at(0).toISOString());
    expect(quietMinutes(h, new Date(T0))).toBe(0);
    expect(quietMinutes(h, new Date(T0 + 9 * 60_000 + 59_000))).toBe(9);
    expect(quietMinutes(h, at(10))).toBe(10);
    expect(quietMinutes(h, at(10))! >= STALE_MINUTES).toBe(true);
    expect(quietMinutes(h, at(9))! >= STALE_MINUTES).toBe(false);
  });

  test("a later heartbeat moves it: the count is from `lastActivityAt`, not from `startedAt`", () => {
    const h = running(at(7).toISOString()); // started at 0, last heartbeat at 7
    expect(quietMinutes(h, at(12))).toBe(5);
  });

  test("a hop that has ended is not quiet — null (nothing to show)", () => {
    expect(quietMinutes(hop(1, "w2", "c1", "2026-10-14T09:01:00+07:00"), at(60))).toBeNull();
  });

  test("a clock a little behind the server never gives a negative number", () => {
    expect(quietMinutes(running(at(5).toISOString()), at(4))).toBe(0);
  });
});
