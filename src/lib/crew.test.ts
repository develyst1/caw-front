// Who is doing what, at a glance (REQ-014 R4): per seat in chain order, entry first — working > stuck > waiting on you > free.
import { describe, expect, test } from "bun:test";
import type { Card, ChatMessage, Chain, Hop, Proposal, Worker } from "@/api/caw";
import { crewState } from "./crew";

const W = (n: number, name: string): Worker => ({ id: `w${n}`, name, role: "FE", roles: ["FE"], skills: ["x"], model: "sonnet", effort: "medium", combinedFrom: null, avatar: null, deletedAt: null });
const [pla, fern, bank, mint] = [W(1, "ปลา"), W(2, "ฝน"), W(3, "แบงค์"), W(4, "มิ้นท์")];
const chain = (entry: string | null = "w1", members = [fern, pla, bank, mint]): Chain => ({ members, edges: [], entryWorkerId: entry });
const card = (n: number, over: Partial<Card> = {}): Card => ({
  id: `c${n}`, projectId: "p", number: n, kind: "work", title: `งาน ${n}`, todo: "", status: "todo", assigneeId: null, anchor: { key: "SCR-001", version: 1 }, anchorLabel: null, anchorRemoved: false,
  specChangedVersion: null, dependsOn: [], question: null, answer: null, workable: true, stoppedMidway: null, createdAt: "", updatedAt: "", ...over,
});
const hop = (n: number, workerId: string, cardId: string, endedAt: string | null): Hop => ({
  id: `h${n}`, projectId: "p", runId: null, claimedBy: null, cardId, workerId, startedAt: "2026-10-14T09:00:00+07:00", endedAt, lastActivityAt: "2026-10-14T09:00:00+07:00", messageId: null, outcome: endedAt ? "commented" : null,
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
import { createMockApi, MOCK_PROJECT_ID } from "@/api/mock";
import { acceptText, answeredWith, canCarryOn, crewSummary, entryAnswering, proposalWaits, entryAsked, entryQuestions, entryWaitsInChat, homeSummaries, isPlanCopy } from "./crew";

describe("crewSummary", () => {
  test("working = the name of the first working seat in chain order (null when nobody), stuck and waitingOnYou are counts of seats", () => {
    const cards = [card(1, { status: "stuck", assigneeId: "w3" }), ask(9), card(2, { assigneeId: "w4", dependsOn: ["c9"] })];
    const seats = crewState(chain(), [...cards, card(7, { assigneeId: "w2" })], [hop(1, "w2", "c7", null)]);
    expect(crewSummary(seats, [...cards, card(7, { assigneeId: "w2" })])).toEqual({ working: "ฝน", stuck: 1, waitingOnYou: 1 });
    expect(crewSummary(crewState(chain(), [], []), [])).toEqual({ working: null, stuck: 0, waitingOnYou: 0 });
    expect(crewSummary([], [])).toEqual({ working: null, stuck: 0, waitingOnYou: 0 });
  });
  test("idleWithWork and free seats count nowhere", () => {
    const cards = [card(1, { assigneeId: "w2", status: "doing" })];
    expect(crewSummary(crewState(chain(), cards, []), cards)).toEqual({ working: null, stuck: 0, waitingOnYou: 0 });
  });
});

describe("homeSummaries", () => {
  const projects = (...ids: string[]) => ids.map((id) => ({ id }) as ProjectSummary);
  const apiOf = (calls: string[]): CawApi => ({
    chain: async (id: string) => { calls.push(`chain ${id}`); return id === "p1" ? chain() : { members: [], edges: [], entryWorkerId: null }; },
    cards: async (id: string) => { calls.push(`cards ${id}`); return id === "p1" ? [card(1, { status: "stuck", assigneeId: "w3" })] : []; },
    hops: async (id: string, q?: { limit?: number }) => { calls.push(`hops ${id} limit=${q?.limit}`); return id === "p1" ? [hop(1, "w2", "c1", null)] : []; },
    chat: async (id: string, q?: { after?: string; limit?: number }) => { calls.push(`chat ${id} after=${q?.after} limit=${q?.limit}`); return []; },
  }) as unknown as CawApi;

  test("no projects → nothing, and no reads", async () => {
    const calls: string[] = [];
    expect(await homeSummaries(apiOf(calls), [])).toEqual({});
    expect(calls).toEqual([]);
  });
  test("several projects → one summary each, by id; FOUR reads per project (the chain, its cards, its newest hop — a project has one running hop at a time, so the newest is the one — and its chat, a page of 200)", async () => {
    const calls: string[] = [];
    const out = await homeSummaries(apiOf(calls), projects("p1", "p2"));
    expect(out).toEqual({ p1: { working: "ฝน", stuck: 1, waitingOnYou: 0 }, p2: { working: null, stuck: 0, waitingOnYou: 0 } });
    expect(calls.sort()).toEqual(["cards p1", "cards p2", "chain p1", "chain p2", "chat p1 after=undefined limit=200", "chat p2 after=undefined limit=200", "hops p1 limit=1", "hops p2 limit=1"]);
  });
  test("a project the back end no longer has (chain null) reads as an empty crew, not an error", async () => {
    const api = { chain: async () => null, cards: async () => [], hops: async () => [], chat: async () => [] } as unknown as CawApi;
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

// ---- the walk's fixes (TASK-B-073): one stuck source, chat questions wait on you, a hop on a chat message ----
const msg = (n: number, author: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m${n}`, projectId: "p", author: author as ChatMessage["author"], text: "x", replyTo: null, replyHopId: null, questions: null, proposalId: null, amendment: null,
  chatHop: null, retryRequestedAt: null, at: `2026-10-14T09:0${n}:00+07:00`, ...over,
});
const asks = [{ text: "ใคร?", proposedDefault: "a", cases: [] }];

describe("the home's stuck count (C2): cards in status `stuck`, the board's stuck column", () => {
  test("a question card and a spec-changed card are not stuck cards; a stuck card counts once even if two seats could hold it", () => {
    const cards = [card(1, { status: "stuck", assigneeId: "w2" }), card(2, { status: "stuck", assigneeId: "w2" }), ask(9), card(3, { specChangedVersion: 4, assigneeId: "w3" }), card(4, { status: "doing", assigneeId: "w3" })];
    const seats = crewState(chain(), cards, []);
    expect(crewSummary(seats, cards).stuck).toBe(2); // two CARDS, one seat
    expect(seats.filter((x) => x.state === "stuck")).toHaveLength(1); // the seat's own state is unchanged
  });
  test("no stuck card → 0, whatever the seats are doing", () => {
    expect(crewSummary(crewState(chain(), [ask(9)], []), [ask(9)]).stuck).toBe(0);
  });
});

describe("chat questions wait on you (C3)", () => {
  const entry = "w1"; // ปลา is the entry of chain()
  test("the entry worker's newest chat reply carries questions and no operator message came after it → waitingOnYou (no card)", () => {
    const chat = [msg(1, "operator"), msg(2, `worker:${entry}`, { questions: asks })];
    expect(stateOf(crewState(chain(), [], [], chat), "ปลา")).toMatchObject({ state: "waitingOnYou", card: null });
    expect(stateOf(crewState(chain(), [], [], chat), "ฝน").state).toBe("free"); // only the entry worker is waiting on the answer
  });
  test("a later operator message answers it — waiting ends", () => {
    const chat = [msg(1, "operator"), msg(2, `worker:${entry}`, { questions: asks }), msg(3, "operator")];
    expect(stateOf(crewState(chain(), [], [], chat), "ปลา").state).toBe("free");
  });
  test("only the NEWEST reply counts: an older one with questions is history when a newer reply has none", () => {
    const chat = [msg(1, `worker:${entry}`, { questions: asks }), msg(2, `worker:${entry}`)];
    expect(stateOf(crewState(chain(), [], [], chat), "ปลา").state).toBe("free");
  });
  test("a reply from another worker, or with an empty list of questions, does not count; no chat at all (the old call) changes nothing", () => {
    expect(stateOf(crewState(chain(), [], [], [msg(1, "worker:w2", { questions: asks })]), "ปลา").state).toBe("free");
    expect(stateOf(crewState(chain(), [], [], [msg(1, `worker:${entry}`, { questions: [] })]), "ปลา").state).toBe("free");
    expect(stateOf(crewState(chain(), [], []), "ปลา").state).toBe("free");
  });
  test("no entry worker → nobody waits on a chat question", () => {
    const chat = [msg(1, "worker:w2", { questions: asks })];
    expect(crewState(chain(null), [], [], chat).every((x) => x.state === "free")).toBe(true);
  });
  test("priority: working and stuck beat it; it beats idleWithWork", () => {
    const chat = [msg(1, `worker:${entry}`, { questions: asks })];
    expect(stateOf(crewState(chain(), [card(1, { assigneeId: entry, status: "stuck" })], [], chat), "ปลา").state).toBe("stuck");
    expect(stateOf(crewState(chain(), [card(1, { assigneeId: entry })], [hop(1, entry, "c1", null)], chat), "ปลา").state).toBe("working");
    expect(stateOf(crewState(chain(), [card(1, { assigneeId: entry, status: "doing" })], [], chat), "ปลา").state).toBe("waitingOnYou");
  });
  test("the home summary counts it — as one item (A2), with the flag `entryAsked` gives", () => {
    const chat = [msg(1, `worker:${entry}`, { questions: asks })];
    const seats = crewState(chain(), [], [], chat);
    expect(entryAsked(chain(), chat)).toBe(true);
    expect(crewSummary(seats, [], entryAsked(chain(), chat))).toEqual({ working: null, stuck: 0, waitingOnYou: 1 });
    expect(entryAsked(chain(), [...chat, msg(2, "operator")])).toBe(false);
  });
  // TASK-B-087: the board's "waits on you" sheet shows the questions themselves
  test("entryQuestions gives the newest reply's questions while nobody answered; null once the operator writes, or with no entry worker", () => {
    const chat = [msg(1, `worker:${entry}`, { questions: asks })];
    expect(entryQuestions(chain(), chat)).toEqual({ message: chat[0], questions: asks });
    expect(entryQuestions(chain(), [...chat, msg(2, "operator")])).toBeNull();
    expect(entryQuestions(chain(null), chat)).toBeNull();
  });
});

// TASK-B-098 (D-094 § 0, B-1 / B-5): the board's one-line notice — the newest chat message is the team's, unanswered, with no structured question
describe("entryWaitsInChat — the board's notice", () => {
  const entry = "w1";
  test("the newest message is the entry worker's, without questions → it waits on you in the chat", () => {
    expect(entryWaitsInChat(chain(), [msg(1, "operator"), msg(2, `worker:${entry}`)])).toBe(true);
  });
  test("you wrote last (or a reply is on its way) → no notice", () => {
    expect(entryWaitsInChat(chain(), [msg(1, `worker:${entry}`), msg(2, "operator")])).toBe(false);
  });
  test("a reply with questions is the AskSheet's, never the notice too (B-5); an empty list of questions is a plain reply", () => {
    expect(entryWaitsInChat(chain(), [msg(1, `worker:${entry}`, { questions: asks })])).toBe(false);
    expect(entryWaitsInChat(chain(), [msg(1, `worker:${entry}`, { questions: [] })])).toBe(true);
  });
  test("no chat, or no entry worker → no notice", () => {
    expect(entryWaitsInChat(chain(), [])).toBe(false);
    expect(entryWaitsInChat(chain(null), [msg(1, `worker:${entry}`)])).toBe(false);
  });
});

describe("a running hop on a chat message (C7)", () => {
  test("`answeringChat`, with no card — in the place of `working` (a card hop is still `working`)", () => {
    const answering = { ...hop(1, "w1", "", null), messageId: "m1" };
    const seats = crewState(chain(), [card(1, { assigneeId: "w1" })], [answering]);
    expect(stateOf(seats, "ปลา")).toMatchObject({ state: "answeringChat", card: null });
    expect(stateOf(crewState(chain(), [card(1)], [hop(1, "w2", "c1", null)]), "ฝน").state).toBe("working");
  });
  test("it beats stuck and waiting like `working` does, and an ENDED chat hop is nothing", () => {
    const cards = [card(1, { assigneeId: "w1", status: "stuck" })];
    expect(stateOf(crewState(chain(), cards, [{ ...hop(1, "w1", "", null), messageId: "m1" }]), "ปลา").state).toBe("answeringChat");
    expect(stateOf(crewState(chain(), cards, [{ ...hop(1, "w1", "", "2026-10-14T09:01:00+07:00"), messageId: "m1" }]), "ปลา").state).toBe("stuck");
  });
  test("the home summary names it as working (the entry is busy answering)", () => {
    const seats = crewState(chain(), [], [{ ...hop(1, "w1", "", null), messageId: "m1" }]);
    expect(crewSummary(seats, []).working).toBe("ปลา");
  });
});

describe("homeSummaries reads the chat too", () => {
  const apiWith = (chatPages: ChatMessage[][], calls: string[] = []) => {
    let i = 0;
    return { api: {
      chain: async () => chain(), cards: async () => [], hops: async () => [],
      chat: async (_id: string, q?: { after?: string; limit?: number }) => { calls.push(`after=${q?.after} limit=${q?.limit}`); return chatPages[i++] ?? []; },
    } as unknown as CawApi, calls };
  };
  test("a question the entry worker asked and nobody answered shows as waiting on you in the home line", async () => {
    const { api } = apiWith([[msg(1, "operator"), msg(2, "worker:w1", { questions: asks })]]);
    expect(await homeSummaries(api, [{ id: "p1" }])).toEqual({ p1: { working: null, stuck: 0, waitingOnYou: 1 } });
  });
  test("a thread longer than a page (200) is read to its end — the question in the LAST message is seen", async () => {
    const full = Array.from({ length: 200 }, (_, i) => msg(i + 1, "operator"));
    const last = [msg(201, "worker:w1", { questions: asks })];
    const { api, calls } = apiWith([full, last]);
    expect(await homeSummaries(api, [{ id: "p1" }])).toEqual({ p1: { working: null, stuck: 0, waitingOnYou: 1 } });
    expect(calls).toEqual(["after=undefined limit=200", "after=m200 limit=200"]);
  });
});

describe("the home's waiting count is items (A2): open question cards, assigned or not, plus the entry worker's unanswered chat question", () => {
  test("two unassigned question cards and a chat question = 3 items, though only one seat (the entry) is `waitingOnYou`", () => {
    const cards = [ask(9), ask(10)];
    const chat = [msg(1, "worker:w1", { questions: asks })];
    const seats = crewState(chain(), cards, [], chat);
    expect(seats.filter((x) => x.state === "waitingOnYou")).toHaveLength(1);
    expect(crewSummary(seats, cards, entryAsked(chain(), chat)).waitingOnYou).toBe(3);
  });
  test("an answered question card is not an item; a question card that someone depends on is ONE item however many cards wait on it", () => {
    const cards = [ask(9, { answer: "ใช่" }), ask(10), card(1, { assigneeId: "w2", dependsOn: ["c10"] }), card(2, { assigneeId: "w3", dependsOn: ["c10"] })];
    expect(crewSummary(crewState(chain(), cards, []), cards).waitingOnYou).toBe(1);
  });
  test("nothing open → 0", () => {
    expect(crewSummary(crewState(chain(), [card(1)], []), [card(1)]).waitingOnYou).toBe(0);
  });
  test("homeSummaries on the plain mock seed: question #11 is unassigned and open → the home count is at least 1", async () => {
    const api = createMockApi();
    const out = await homeSummaries(api, [{ id: MOCK_PROJECT_ID }]);
    expect(out[MOCK_PROJECT_ID]!.waitingOnYou).toBeGreaterThanOrEqual(1);
    expect(out[MOCK_PROJECT_ID]!.waitingOnYou).toBe((await api.cards(MOCK_PROJECT_ID)).filter((c) => c.kind === "question" && c.answer === null).length); // the plain seed's chat has no open ask
  });
});


// TASK-B-114 (D-103, REQ-015 AC-1): the แชต page shows กำลังตอบแชต while the entry worker answers
describe("entryAnswering", () => {
  const chatHop = (workerId: string, endedAt: string | null): Hop => ({ ...hop(9, workerId, "", endedAt), cardId: null, messageId: "m1" });
  test("an open chat hop of the entry worker → true", () => {
    expect(entryAnswering(chain(), [chatHop("w1", null)])).toBe(true);
  });
  test("an open card hop, an ended chat hop, another worker's chat hop, or no entry worker → false", () => {
    expect(entryAnswering(chain(), [hop(1, "w1", "c1", null)])).toBe(false);
    expect(entryAnswering(chain(), [chatHop("w1", "2026-10-14T09:01:00+07:00")])).toBe(false);
    expect(entryAnswering(chain(), [chatHop("w2", null)])).toBe(false);
    expect(entryAnswering(chain(null), [chatHop("w1", null)])).toBe(false);
  });
});

// D-105 P1 (TASK-B-119) + REQ-126 D1/D2: the one message the answers make (`ข้อ {n}: {answer}` per question), and what an answered question shows
describe("acceptText / answeredWith", () => {
  test("one answer → one line; several → one line each, numbered from 1 in question order, joined by a newline; a single question can post its own number", () => {
    expect(acceptText(["เกิน 10 คน"])).toBe("ข้อ 1: เกิน 10 คน");
    expect(acceptText(["เกิน 10 คน", "ไม่นับ"])).toBe("ข้อ 1: เกิน 10 คน\nข้อ 2: ไม่นับ");
    expect(acceptText(["a", "b", "c", "d"])).toBe("ข้อ 1: a\nข้อ 2: b\nข้อ 3: c\nข้อ 4: d");
    expect(acceptText(["ไม่นับ"], 2)).toBe("ข้อ 2: ไม่นับ");
  });
  const q = (text: string, proposedDefault: string) => ({ text, proposedDefault, cases: [] });
  const four = () => msg(1, "worker:w1", { questions: [q("q1?", "d1"), q("q2?", "d2"), q("q3?", "d3"), q("q4?", "d4")] });
  test("result table: `ข้อ 2: x` for a 4-question message → q2 is x, the others by their own lines", () => {
    const chat = [four(), msg(2, "operator", { text: "ข้อ 1: a\nข้อ 2: x\nข้อ 3: c\nข้อ 4: d" })];
    expect([0, 1, 2, 3].map((i) => answeredWith(chat, chat[0]!, i))).toEqual(["a", "x", "c", "d"]);
    const some = [four(), msg(2, "operator", { text: "ข้อ 2: x" })];
    expect([0, 1, 2, 3].map((i) => answeredWith(some, some[0]!, i))).toEqual([null, "x", null, null]);
  });
  test("result table: the old `ตามนั้น — d1` only → q1 is d1, q2–q4 null", () => {
    const chat = [four(), msg(2, "operator", { text: "ตามนั้น — d1" })];
    expect([0, 1, 2, 3].map((i) => answeredWith(chat, chat[0]!, i))).toEqual(["d1", null, null, null]);
  });
  test("result table: a typed text to ONE question → that text; a typed text to FOUR → all null (the old chats read ตอบแล้ว)", () => {
    const one = [msg(1, "worker:w1", { questions: [q("ห้องใหญ่?", "เกิน 10 คน")] }), msg(2, "operator", { text: "สิบห้าคน" })];
    expect(answeredWith(one, one[0]!, 0)).toBe("สิบห้าคน");
    const many = [four(), msg(2, "operator", { text: "ตามใจ" })];
    expect([0, 1, 2, 3].map((i) => answeredWith(many, many[0]!, i))).toEqual([null, null, null, null]);
  });
  test("an answer typed on several lines keeps them; a question that does not exist, or no operator message after it → null", () => {
    const chat = [four(), msg(2, "operator", { text: "ข้อ 1: บรรทัดแรก\nบรรทัดสอง\nข้อ 2: b" })];
    expect(answeredWith(chat, chat[0]!, 0)).toBe("บรรทัดแรก\nบรรทัดสอง");
    expect(answeredWith(chat, chat[0]!, 1)).toBe("b");
    expect(answeredWith(chat, chat[0]!, 9)).toBeNull();
    const none = [four()];
    expect(answeredWith(none, none[0]!, 0)).toBeNull();
  });
});

// REQ-126 r2: a plan is a copy when the back end says every item is already on the board (`Proposal.onBoard`)
describe("isPlanCopy", () => {
  const prop = (status: "open" | "accepted" | "superseded", items: number, onBoard: number[]) =>
    ({ id: "p", status, items: Array.from({ length: items }, (_, i) => ({ title: `t${i}`, anchor: { key: `K-${i}`, version: 1 }, workerId: "w2", dependsOn: [] })), onBoard }) as unknown as Proposal;
  test("open and every item on the board → a copy", () => {
    expect(isPlanCopy(prop("open", 3, [0, 1, 2]))).toBe(true);
    expect(isPlanCopy(prop("open", 1, [0]))).toBe(true);
  });
  test("open and only some on the board, or none → not a copy", () => {
    expect(isPlanCopy(prop("open", 3, [1, 2]))).toBe(false);
    expect(isPlanCopy(prop("open", 3, []))).toBe(false);
  });
  test("accepted or superseded, even with a full onBoard → not a copy", () => {
    expect(isPlanCopy(prop("accepted", 2, [0, 1]))).toBe(false);
    expect(isPlanCopy(prop("superseded", 2, [0, 1]))).toBe(false);
  });
  test("no items → not a copy (an empty plan is not 'all on the board')", () => {
    expect(isPlanCopy(prop("open", 0, []))).toBe(false);
  });
});

// D-105 P2 (TASK-B-120): the board says Paul's proposal waits for his agreement — the newest message is the entry worker's reply carrying an OPEN proposal,
// and no question is open
describe("proposalWaits", () => {
  const prop = (id: string, messageId: string, status: "open" | "accepted" | "superseded") =>
    ({ id, projectId: "p", messageId, version: 1, items: [], status, cardIds: null, hopsTotal: 0, createdAt: "" }) as unknown as Proposal;
  const reply = (over: Partial<ChatMessage> = {}) => msg(2, "worker:w1", { replyTo: "m1", ...over });
  test("the entry worker's newest reply carries an open proposal → true", () => {
    expect(proposalWaits(chain(), [msg(1, "operator"), reply()], [prop("q1", "m1", "open")])).toBe(true);
  });
  test("accepted or superseded, an open question, a newer operator message, or no entry worker → false", () => {
    expect(proposalWaits(chain(), [msg(1, "operator"), reply()], [prop("q1", "m1", "accepted")])).toBe(false);
    expect(proposalWaits(chain(), [msg(1, "operator"), reply({ questions: [{ text: "?", proposedDefault: "a", cases: [] }] })], [prop("q1", "m1", "open")])).toBe(false);
    expect(proposalWaits(chain(), [msg(1, "operator"), reply(), msg(3, "operator")], [prop("q1", "m1", "open")])).toBe(false);
    expect(proposalWaits(chain(null), [msg(1, "operator"), reply()], [prop("q1", "m1", "open")])).toBe(false);
  });
  test("REQ-126 r2: the newest reply's only open proposal has every item on the board → false; only some on the board → true; a copy beside another open plan → true", () => {
    const planned = (id: string, onBoard: number[], items = 2) =>
      ({ ...prop(id, "m1", "open"), items: Array.from({ length: items }, (_, i) => ({ title: `t${i}`, anchor: { key: `K-${i}`, version: 1 }, workerId: "w2", dependsOn: [] })), onBoard }) as unknown as Proposal;
    const chat = [msg(1, "operator"), reply()];
    expect(proposalWaits(chain(), chat, [planned("o", [0, 1])])).toBe(false);
    expect(proposalWaits(chain(), chat, [planned("o", [1])])).toBe(true);
    expect(proposalWaits(chain(), chat, [planned("o", [])])).toBe(true);
    expect(proposalWaits(chain(), chat, [planned("o", [0, 1]), planned("o2", [0])])).toBe(true);
  });
});

// D-105 (TASK-B-121, SPEC-B-005 Q-1): in แบบสั่งทีละขั้น a card that can be worked gets ทำต่อ
describe("canCarryOn", () => {
  const ready = card(1, { assigneeId: "w2", workable: true });
  test("manual + workable + assigned + no hop running → true", () => {
    expect(canCarryOn(ready, "manual", [])).toBe(true);
    expect(canCarryOn(ready, "manual", [hop(1, "w2", "c1", "2026-10-14T09:01:00+07:00")])).toBe(true); // an ENDED hop is not running
  });
  test("อัตโนมัติ, not workable, nobody assigned, or any hop running → false", () => {
    expect(canCarryOn(ready, "dispatcher", [])).toBe(false);
    expect(canCarryOn({ ...ready, workable: false }, "manual", [])).toBe(false);
    expect(canCarryOn({ ...ready, assigneeId: null }, "manual", [])).toBe(false);
    expect(canCarryOn(ready, "manual", [hop(2, "w3", "c9", null)])).toBe(false); // someone else's running hop also blocks: one hop at a time
  });
});
