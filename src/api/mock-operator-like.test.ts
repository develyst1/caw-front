// The `operator-like` seed (TASK-B-083, polish-plan § 2.7): the shape of what a real operator ends up with — six people with long Thai names (a PM + BA entry,
// an FE + BE), one person who is in no chain, one deleted worker, a chain with a return line, a running hop on a card, a stuck card, an open chat question with
// its proposal, and a long folder path. Taken from the walk's seed (`studies/REQ-014-polish-B/seed.ts`).
import { describe, expect, test } from "bun:test";
import { crewState, entryAsked } from "@/lib/crew";
import { createMockApi, MOCK_PROJECT_ID as PID, MOCK_STATES } from "./mock";

const load = async () => {
  const api = createMockApi({ state: "operator-like" });
  const [project, chain, workers, cards, hops, chat, proposals] = await Promise.all([
    api.project(PID), api.chain(PID), api.workers(), api.cards(PID), api.hops(PID), api.chat(PID, { limit: 200 }), api.proposals(PID),
  ]);
  return { api, project: project!, chain: chain!, workers, cards, hops, chat, proposals };
};
const id = (list: { id: string; name: string }[], name: string) => list.find((w) => w.name === name)!.id;

describe("operator-like", () => {
  test("is a known state", () => { expect(MOCK_STATES).toContain("operator-like"); });

  test("6 people in the chain — Paul (PM + BA) is the entry, then สมศักดิ์ ศรีประเสริฐวงศ์ SA, Fena FE, Beta BE, กิตติพงษ์ วัฒนาพาณิชย์กุล FE + BE, ณัฐธิดา วิริยะกุลพัฒนาเลิศ QA", async () => {
    const { chain } = await load();
    expect(chain.members.map((m) => [m.name, m.roles])).toEqual([
      ["Paul", ["PM", "BA"]], ["สมศักดิ์ ศรีประเสริฐวงศ์", ["SA"]], ["Fena", ["FE"]], ["Beta", ["BE"]], ["กิตติพงษ์ วัฒนาพาณิชย์กุล", ["FE", "BE"]], ["ณัฐธิดา วิริยะกุลพัฒนาเลิศ", ["QA"]],
    ]);
    expect(chain.entryWorkerId).toBe(id(chain.members, "Paul"));
    expect(chain.members.every((m) => m.deletedAt === null)).toBe(true);
  });

  test("one person outside the chain (long name) and one deleted worker — and workers() lists both, with the deleted one marked", async () => {
    const { chain, workers } = await load();
    const inChain = new Set(chain.members.map((m) => m.id));
    const outside = workers.filter((w) => !inChain.has(w.id) && w.deletedAt === null);
    expect(outside.map((w) => w.name)).toEqual(["ปาริชาตินันท์ ศรีสวัสดิ์วงศ์"]);
    const deleted = workers.filter((w) => w.deletedAt !== null);
    expect(deleted).toHaveLength(1);
    expect(inChain.has(deleted[0]!.id)).toBe(false);
    expect(workers).toHaveLength(8); // 6 + 1 + 1: the state has its own people, not the plain seed's
  });

  test("the chain: PM → SA → FE / BE / FE+BE → QA, with a RETURN line QA → SA", async () => {
    const { chain } = await load();
    const n = (w: string) => id(chain.members, w);
    const want = [["Paul", "สมศักดิ์ ศรีประเสริฐวงศ์"], ["สมศักดิ์ ศรีประเสริฐวงศ์", "Fena"], ["สมศักดิ์ ศรีประเสริฐวงศ์", "Beta"], ["สมศักดิ์ ศรีประเสริฐวงศ์", "กิตติพงษ์ วัฒนาพาณิชย์กุล"],
      ["Fena", "ณัฐธิดา วิริยะกุลพัฒนาเลิศ"], ["Beta", "ณัฐธิดา วิริยะกุลพัฒนาเลิศ"], ["กิตติพงษ์ วัฒนาพาณิชย์กุล", "ณัฐธิดา วิริยะกุลพัฒนาเลิศ"], ["ณัฐธิดา วิริยะกุลพัฒนาเลิศ", "สมศักดิ์ ศรีประเสริฐวงศ์"]];
    expect(chain.edges).toHaveLength(want.length);
    for (const [a, b] of want) expect(chain.edges.some((e) => e.from === n(a!) && e.to === n(b!))).toBe(true);
  });

  test("one running hop — on Beta's card, which is therefore `doing` (v1.14: a hop starting on a todo card makes it doing)", async () => {
    const { hops, cards, chain } = await load();
    const running = hops.filter((h) => h.endedAt === null);
    expect(running).toHaveLength(1);
    expect(running[0]!.workerId).toBe(id(chain.members, "Beta"));
    const card = cards.find((c) => c.id === running[0]!.cardId)!;
    expect(card.assigneeId).toBe(id(chain.members, "Beta"));
    expect(card.status).toBe("doing");
  });

  test("one stuck card; and nobody else has a running hop (one at a time)", async () => {
    const { cards } = await load();
    expect(cards.filter((c) => c.status === "stuck")).toHaveLength(1);
  });

  test("one question is open: the entry worker's newest chat reply asks it, with a proposal on the reply, and no operator message after it → entryAsked", async () => {
    const { chat, chain, proposals } = await load();
    const last = chat.at(-1)!;
    expect(last.author).toBe(`worker:${chain.entryWorkerId}`);
    expect(last.questions?.length).toBe(1);
    expect(last.proposalId).not.toBeNull();
    expect(proposals.some((p) => p.id === last.proposalId)).toBe(true);
    expect(entryAsked(chain, chat)).toBe(true);
  });

  test("a long folder path", async () => {
    const { project } = await load();
    expect(project.workspace.roots).toHaveLength(1);
    expect(project.workspace.roots[0]!.length).toBeGreaterThan(80);
  });

  test("the crew reads as the screens need: Beta working, the entry waiting on you, the QA stuck on their card", async () => {
    const { chain, cards, hops, chat } = await load();
    const seats = crewState(chain, cards, hops, chat);
    const state = (name: string) => seats.find((s) => s.worker.name === name)!.state;
    expect(state("Beta")).toBe("working");
    expect(state("Paul")).toBe("waitingOnYou");
    expect(state("ณัฐธิดา วิริยะกุลพัฒนาเลิศ")).toBe("stuck");
  });

  test("the other states are untouched: the plain seed still has its four workers and no deleted one", async () => {
    const plain = await createMockApi().workers();
    expect(plain.map((w) => w.name)).toEqual(["ปลา", "ฝน", "แบงค์", "มิ้นท์"]);
    expect(plain.every((w) => w.deletedAt === null)).toBe(true);
  });

  test("a deleted worker is out of the way: deleting works for the outsider, is refused for a member (v1.14), and the name of the deleted one is free", async () => {
    const { api, workers, chain } = await load();
    const outsider = workers.find((w) => w.name === "ปาริชาตินันท์ ศรีสวัสดิ์วงศ์")!;
    const deleted = workers.find((w) => w.deletedAt !== null)!;
    expect(await api.deleteWorker(outsider.id)).toBeUndefined();
    await api.deleteWorker(chain.members[0]!.id).then(() => { throw new Error("should refuse"); }, (e) => expect((e as { code: string }).code).toBe("worker_in_chain"));
    expect((await api.createWorker({ name: deleted.name, roles: ["QA"], skills: ["role-qa"] })).name).toBe(deleted.name);
  });
});
