// The seed has one running card hop (C5, TASK-B-073): the plain seed shows ฝน working, `working-quiet` is the same hop that has been silent for 12 minutes,
// `working-now` moves the running hop to แบงค์. A project has ONE running hop at a time in every state.
import { describe, expect, test } from "bun:test";
import { crewState, entryAsked, quietMinutes } from "@/lib/crew";
import { MOCK_STATES, createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

const running = async (state?: Parameters<typeof createMockApi>[0] extends infer O ? (O extends { state?: infer S } ? S : never) : never) => {
  const api = createMockApi({ state });
  const hops = (await api.hops(PID)).filter((h) => h.endedAt === null);
  const workers = await api.workers();
  const cards = await api.cards(PID);
  return { hops, workers, cards, nameOf: (id: string) => workers.find((w) => w.id === id)?.name };
};

describe("the running hop in the seed", () => {
  test("plain seed: exactly one running hop — ฝน's, on a card of hers, started and last active at seed time", async () => {
    const before = Date.now();
    const { hops, cards, nameOf } = await running();
    expect(hops).toHaveLength(1);
    const h = hops[0]!;
    expect(nameOf(h.workerId)).toBe("ฝน");
    expect(cards.find((c) => c.id === h.cardId)!.assigneeId).toBe(h.workerId);
    expect(h.runId).toBeNull();
    expect(h.messageId).toBeNull();
    expect(h.lastActivityAt).toBe(h.startedAt);
    expect(Math.abs(Date.parse(h.lastActivityAt) - before)).toBeLessThan(5000);
    expect(quietMinutes(h, new Date())).toBe(0);
  });

  test("`working-quiet`: the same hop, started 12 minutes before the seed was made and silent since → quietMinutes is 12 (not 11, not 13)", async () => {
    const seededAt = Date.now();
    const { hops, nameOf } = await running("working-quiet");
    expect(hops).toHaveLength(1);
    expect(nameOf(hops[0]!.workerId)).toBe("ฝน");
    expect(Math.abs(seededAt - 12 * 60_000 - Date.parse(hops[0]!.lastActivityAt))).toBeLessThan(5000);
    expect(Date.parse(hops[0]!.startedAt)).toBeLessThanOrEqual(Date.parse(hops[0]!.lastActivityAt)); // never active before it started
    expect(quietMinutes(hops[0]!, new Date())).toBe(12);
  });

  test("`working-now` keeps meaning แบงค์ working on card 4 — and ฝน's plain-seed hop is gone: still ONE running hop", async () => {
    const { hops, cards, nameOf } = await running("working-now");
    expect(hops).toHaveLength(1);
    expect(nameOf(hops[0]!.workerId)).toBe("แบงค์");
    expect(cards.find((c) => c.id === hops[0]!.cardId)!.number).toBe(4);
  });

  test("every state has at most one running hop, and the others' hops are the old finished ones", async () => {
    for (const state of [undefined, ...MOCK_STATES]) {
      const { hops } = await running(state);
      expect(hops.length, String(state)).toBeLessThanOrEqual(1);
    }
  });

  test("`working-quiet` is a known state", () => { expect(MOCK_STATES).toContain("working-quiet"); });
});

/** the crew as the project screen sees it: chain, cards, newest hop, chat — read through the seam */
const crewOf = async (state?: Parameters<typeof createMockApi>[0] extends infer O ? (O extends { state?: infer S } ? S : never) : never) => {
  const api = createMockApi({ state });
  const [chain, cards, hops, chat] = await Promise.all([api.chain(PID), api.cards(PID), api.hops(PID), api.chat(PID, { limit: 200 })]);
  return { chain: chain!, chat, hops, seats: crewState(chain!, cards, hops, chat), api };
};
const seat = (seats: Awaited<ReturnType<typeof crewOf>>["seats"], name: string) => seats.find((x) => x.worker.name === name)!;

describe("`entry-asked` (TASK-B-075): the entry worker's newest chat reply has questions and nobody has answered", () => {
  test("the plain seed does not wait on the chat (the operator's M3 came after ปลา's questions) — and ปลา is free", async () => {
    const { chain, chat } = await crewOf();
    expect(entryAsked(chain, chat)).toBe(false);
  });
  test("`entry-asked`: the newest chat message is the entry worker's reply with questions → entryAsked, and ปลา `waitingOnYou` (no card)", async () => {
    const { chain, chat, seats } = await crewOf("entry-asked");
    const last = chat.at(-1)!;
    expect(last.author).toBe(`worker:${chain.entryWorkerId}`);
    expect(last.questions?.length).toBeGreaterThan(0);
    expect(entryAsked(chain, chat)).toBe(true);
    expect(seat(seats, "ปลา")).toMatchObject({ state: "waitingOnYou", card: null });
  });
  test("the rest of the thread is the plain seed's: the same messages, the proposal and the amendment on the reply are still there; only the questions were added", async () => {
    const plain = (await crewOf()).chat, asked = (await crewOf("entry-asked")).chat;
    expect(asked.map((m) => m.id)).toEqual(plain.map((m) => m.id));
    expect(asked.map((m) => [m.text, m.proposalId, m.amendment])).toEqual(plain.map((m) => [m.text, m.proposalId, m.amendment]));
    expect(asked.filter((m, i) => JSON.stringify(m.questions) !== JSON.stringify(plain[i]!.questions))).toHaveLength(1);
  });
  test("an operator message posted afterwards answers it (the rule the screens rely on)", async () => {
    const { api, chain } = await crewOf("entry-asked");
    await api.postChat(PID, "นับด้วย");
    expect(entryAsked(chain, await api.chat(PID, { limit: 200 }))).toBe(false);
  });
});

describe("`chat-running`'s hop is in hops() (TASK-B-075), as caw-back returns it", () => {
  test("one running hop, on the chat message — `messageId` set, no card, the entry worker's, started and last active together — and it is the newest", async () => {
    const { hops, chain, chat } = await crewOf("chat-running");
    const open = hops.filter((h) => h.endedAt === null);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ messageId: chat.find((m) => m.chatHop?.endedAt === null)!.id, cardId: null, workerId: chain.entryWorkerId, runId: null });
    expect(open[0]!.lastActivityAt).toBe(open[0]!.startedAt);
    expect(hops[0]!.id).toBe(open[0]!.id); // newest first
  });
  test("it is the same hop the chat message reports as its `chatHop`", async () => {
    const { hops, chat } = await crewOf("chat-running");
    const running = hops.find((h) => h.endedAt === null)!;
    expect(chat.find((m) => m.id === running.messageId)!.chatHop).toEqual({ id: running.id, endedAt: null, outcome: null });
  });
  test("so the entry worker (ปลา) is `answeringChat`, and ฝน — whose plain-seed hop it replaces — is not working", async () => {
    const { seats } = await crewOf("chat-running");
    expect(seat(seats, "ปลา")).toMatchObject({ state: "answeringChat", card: null });
    expect(seat(seats, "ฝน").state).not.toBe("working");
  });
  test("hopsUsed counts it like any hop; the other states are untouched (`chat-failed` keeps ฝน working and no chat hop in hops())", async () => {
    const failed = await crewOf("chat-failed");
    expect(failed.hops.every((h) => h.messageId === null)).toBe(true);
    expect(seat(failed.seats, "ฝน").state).toBe("working");
  });
});

