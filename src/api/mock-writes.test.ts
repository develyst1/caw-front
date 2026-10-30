// The mock's operator writes follow the back end's rules (SPEC-A-008 § API v1) — chain_broken, run_open, has_open_cards,
// already_exists and the rest — so the screens meet the same refusals against the mock as against caw-back.
import { describe, expect, test } from "bun:test";
import { CawError, type CawApi } from "./caw";
import { createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

const refused = async (p: Promise<unknown>) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(CawError);
  return e as CawError;
};
const expectRefusal = async (p: Promise<unknown>, status: number, code: string) => {
  const e = await refused(p);
  expect([e.status, e.code]).toEqual([status, code]);
  return e;
};
/** The seeded project's summary (the counts come with the list, as in the contract). */
const summaryOf = async (api: CawApi) => (await api.projects()).find((p) => p.id === PID)!;
const BP = "11111111-2222-4333-8444-555555555555";

/** The seeded cards by their number, and the workers by name, so a test reads like the board. */
const setup = async () => {
  const api = createMockApi();
  const cards = await api.cards(PID);
  const workers = await api.workers();
  const card = (n: number) => cards.find((c) => c.number === n)!;
  const worker = (name: string) => workers.find((w) => w.name === name)!;
  return { api, card, worker };
};

describe("createProject", () => {
  test("a Blueprint version that already has a project → 409 already_exists, with that project's id", async () => {
    const { api } = await setup();
    const e = await expectRefusal(api.createProject({ blueprintProjectId: BP, version: 3 }), 409, "already_exists");
    expect(e.details).toEqual({ id: PID });
  });

  test("v1.15: one project per Blueprint project — ANOTHER confirmed version of it is refused 409 already_exists with the existing project's id, and nothing is made", async () => {
    const { api } = await setup();
    for (const version of [1, 2, 4]) {
      const e = await expectRefusal(api.createProject({ blueprintProjectId: BP, version }), 409, "already_exists");
      expect(e.details).toEqual({ id: PID });
    }
    expect((await api.projects()).map((x) => x.id)).toEqual([PID]);
  });

  test("the refusals keep their order: an unknown Blueprint project 404 comes before already_exists", async () => {
    const { api } = await setup();
    await expectRefusal(api.createProject({ blueprintProjectId: "nope" }), 404, "blueprint_project_not_found");
    await expectRefusal(api.createProject({ blueprintProjectId: BP }), 409, "already_exists");
  });

  test("REQ-105: a version is not checked any more — any `version`, or none, only meets already_exists; there is no version_not_confirmed", async () => {
    const { api } = await setup();
    await expectRefusal(api.createProject({ blueprintProjectId: "nope", version: 1 }), 404, "blueprint_project_not_found");
    for (const version of [99, 0, undefined]) await expectRefusal(api.createProject({ blueprintProjectId: BP, version }), 409, "already_exists");
    expect(await api.projects()).toHaveLength(1);
  });
});

describe("a card's writes", () => {
  test("comment: the operator's note joins the timeline, last; empty text is refused", async () => {
    const { api, card } = await setup();
    const c = card(6);
    const before = (await api.cardContext(c.id))!.notes.length;
    const note = await api.comment(c.id, "ขอบคุณ");
    expect([note.type, note.actor, note.text]).toEqual(["comment", "operator", "ขอบคุณ"]);
    const notes = (await api.cardContext(c.id))!.notes;
    expect(notes).toHaveLength(before + 1);
    expect(notes.at(-1)!.id).toBe(note.id);
    await expectRefusal(api.comment(c.id, ""), 400, "validation");
    await expectRefusal(api.comment("nope", "x"), 404, "not_found");
  });

  test("setStatus: to doing while a dependency is open → 409 waiting_on_question; otherwise it moves; a bad status is refused", async () => {
    const { api, card } = await setup();
    await expectRefusal(api.setStatus(card(3).id, "doing"), 409, "waiting_on_question"); // depends on card 2, still todo
    expect((await api.setStatus(card(2).id, "doing")).status).toBe("doing");
    expect((await api.setStatus(card(3).id, "review")).status).toBe("review"); // not to doing: no refusal
    await expectRefusal(api.setStatus(card(2).id, "finished" as never), 400, "validation");
    expect((await api.card(card(3).id))!.status).toBe("review");
  });

  test("assign: any chain member, edge or not (the operator's authority); a worker outside the chain → 400 not_a_member", async () => {
    const { api, card, worker } = await setup();
    const c = card(1); // fern's
    expect((await api.assign(c.id, worker("ปลา").id)).assigneeId).toBe(worker("ปลา").id); // fern → ploy: no such edge, still allowed
    const outsider = await api.createWorker({ name: "นอกสาย", role: "other", skills: ["x"] });
    await expectRefusal(api.assign(c.id, outsider.id), 400, "not_a_member");
    expect((await api.card(c.id))!.assigneeId).toBe(worker("ปลา").id);
  });

  test("handoff must follow a chain edge: otherwise 409 chain_broken with who may take it; on an edge the card moves and a handoff note is written", async () => {
    const { api, card, worker } = await setup();
    const c = card(4); // bank's; bank → mint exists, bank → fern does not
    const e = await expectRefusal(api.handoff(c.id, worker("ฝน").id, "ต่อให้ฝน"), 409, "chain_broken");
    expect(e.details).toEqual({ from: worker("แบงค์").id, allowed: [worker("มิ้นท์").id] });
    expect((await api.card(c.id))!.assigneeId).toBe(worker("แบงค์").id); // a refusal moves nothing
    const moved = await api.handoff(c.id, worker("มิ้นท์").id, "ตรวจให้หน่อย");
    expect(moved.assigneeId).toBe(worker("มิ้นท์").id);
    const last = (await api.cardContext(c.id))!.notes.at(-1)!;
    expect([last.type, last.fromWorkerId, last.toWorkerId, last.text]).toEqual(["handoff", worker("แบงค์").id, worker("มิ้นท์").id, "ตรวจให้หน่อย"]);
    await expectRefusal(api.handoff(card(11).id, worker("ฝน").id, "x"), 400, "validation"); // the question card has no holder
  });

  test("answer: only a question card, once; the card is done and the card waiting on it sees the decision", async () => {
    const { api, card } = await setup();
    const q = card(11), waiting = card(12);
    await expectRefusal(api.answer(card(1).id, "x"), 400, "not_a_question");
    const done = await api.answer(q.id, "เตือนก่อน แล้วปฏิเสธเมื่อครบ 48 ชม.");
    expect([done.status, done.answer]).toEqual(["done", "เตือนก่อน แล้วปฏิเสธเมื่อครบ 48 ชม."]);
    await expectRefusal(api.answer(q.id, "อีกที"), 409, "already_answered");
    const ctx = (await api.cardContext(waiting.id))!;
    expect(ctx.decisions).toEqual([{ cardId: q.id, number: 11, question: q.question!.text, answer: "เตือนก่อน แล้วปฏิเสธเมื่อครบ 48 ชม." }]);
    expect((await summaryOf(api)).stuckCount).toBe(1); // the open question is no longer stuck (REQ-105 D7: a spec change no longer counts as stuck — it was 3 with it)
  });

  test("clearSpecChange: the mark goes; REQ-105 D7 — the mark never counted as stuck, so the count does not move", async () => {
    const { api, card } = await setup();
    const before = (await summaryOf(api)).stuckCount;
    const c = await api.clearSpecChange(card(6).id);
    expect(c.specChangedVersion).toBeNull();
    expect((await summaryOf(api)).stuckCount).toBe(before);
  });
});

describe("workers", () => {
  test("createWorker: defaults by role, a taken name → 409 name_taken, no skills → 400", async () => {
    const { api } = await setup();
    const pm = await api.createWorker({ name: "หัวหน้า2", role: "PM", skills: ["role-pm"] });
    const fe = await api.createWorker({ name: "หน้าบ้าน2", role: "FE", skills: ["role-fe"] });
    const other = await api.createWorker({ name: "อื่นๆ", role: "other", skills: ["x"], effort: "high" });
    expect([pm.model, pm.effort, fe.model, fe.effort, other.model, other.effort]).toEqual(["opus", "medium", "sonnet", "medium", "sonnet", "high"]);
    expect([pm.combinedFrom, (await api.workers()).length]).toEqual([null, 7]);
    await expectRefusal(api.createWorker({ name: "ปลา", role: "PM", skills: ["role-pm"] }), 409, "name_taken");
    await expectRefusal(api.createWorker({ name: "ไร้ทักษะ", role: "QA", skills: [] }), 400, "validation");
  });

  test("combine: skills are the union, the model the stronger, the effort the higher, role other, combinedFrom both — and both stay", async () => {
    const { api, worker } = await setup();
    const [ploy, fern] = [worker("ปลา"), worker("ฝน")]; // opus/high + sonnet/medium
    const w = await api.combineWorkers("ปลาฝน", [ploy.id, fern.id]);
    expect([w.role, w.model, w.effort, w.combinedFrom]).toEqual(["other", "opus", "high", [ploy.id, fern.id]]);
    expect(w.skills).toEqual([...new Set([...ploy.skills, ...fern.skills])]);
    expect((await api.workers()).length).toBe(5);
    await expectRefusal(api.combineWorkers("ปลาฝน", [ploy.id, fern.id]), 409, "name_taken");
    await expectRefusal(api.combineWorkers("ใหม่", [ploy.id, "nope"]), 404, "not_found");
  });
});

describe("the chain", () => {
  test("removeMember: with open cards and no reassignTo → 409 has_open_cards; with reassignTo the open cards move and done ones stay; the entry worker → 409 is_entry", async () => {
    const { api, worker } = await setup();
    const [bank, mint, ploy] = [worker("แบงค์"), worker("มิ้นท์"), worker("ปลา")];
    const e = await expectRefusal(api.removeMember(PID, bank.id), 409, "has_open_cards");
    expect(e.details).toEqual({ count: 3 }); // cards 2, 4 and 6 — card 8 is done
    await expectRefusal(api.removeMember(PID, ploy.id, mint.id), 409, "is_entry");
    await expectRefusal(api.removeMember(PID, bank.id, bank.id), 400, "validation");
    const chain = await api.removeMember(PID, bank.id, mint.id);
    expect(chain.members.map((m) => m.id)).not.toContain(bank.id);
    expect(chain.edges.some((x) => x.from === bank.id || x.to === bank.id)).toBe(false);
    const after = await api.cards(PID);
    for (const n of [2, 4, 6]) expect(after.find((c) => c.number === n)!.assigneeId).toBe(mint.id);
    expect(after.find((c) => c.number === 8)!.assigneeId).toBe(bank.id); // done: stays
    expect(after).toHaveLength(12); // the count is unchanged (AC-5)
  });

  test("addMember / addEdge / removeEdge / setEntry and their refusals", async () => {
    const { api, worker } = await setup();
    const [ploy, fern, mint] = [worker("ปลา"), worker("ฝน"), worker("มิ้นท์")];
    const outsider = await api.createWorker({ name: "นอกสาย", role: "SA", skills: ["role-sa"] });
    await expectRefusal(api.addMember(PID, ploy.id), 409, "already_member");
    await expectRefusal(api.addMember(PID, "nope"), 404, "not_found");
    expect((await api.addMember(PID, outsider.id)).members.map((m) => m.id)).toContain(outsider.id);

    await expectRefusal(api.addEdge(PID, ploy.id, ploy.id), 400, "validation");
    await expectRefusal(api.addEdge(PID, ploy.id, fern.id), 409, "edge_exists");
    const edge = await api.addEdge(PID, mint.id, ploy.id);
    expect(edge.edges).toContainEqual({ from: mint.id, to: ploy.id });
    expect((await api.removeEdge(PID, mint.id, ploy.id)).edges).not.toContainEqual({ from: mint.id, to: ploy.id });
    await expectRefusal(api.removeEdge(PID, mint.id, ploy.id), 404, "not_found");

    expect((await api.setEntry(PID, fern.id)).entryWorkerId).toBe(fern.id);
    expect((await api.project(PID))!.entryWorkerId).toBe(fern.id);
    const stranger = await api.createWorker({ name: "คนนอก", role: "QA", skills: ["role-qa"] });
    await expectRefusal(api.setEntry(PID, stranger.id), 400, "not_a_member");
    await expectRefusal(api.addMember("nope", ploy.id), 404, "not_found");
  });
});

// ---- contract v1.14 / v1.15 (TASK-B-083) ----
import { MOCK_NEW_PROJECT_ID } from "./mock";

const byName = async (api: CawApi, name: string) => (await api.workers()).find((w) => w.name === name)!;
/** a worker nobody uses: made, not in any chain */
const spare = (api: CawApi, name: string) => api.createWorker({ name, roles: ["FE"], skills: ["x"] });

describe("deleteWorker (v1.14): DELETE /v1/workers/{id}", () => {
  test("a worker in no chain → resolves with nothing (204) and stays in the list with `deletedAt` set; the others have `deletedAt: null`", async () => {
    const api = createMockApi();
    const w = await spare(api, "ลาออก");
    expect(w.deletedAt).toBeNull();
    expect(await api.deleteWorker(w.id)).toBeUndefined();
    const listed = (await api.workers()).find((x) => x.id === w.id)!;
    expect(typeof listed.deletedAt).toBe("string");
    expect(Number.isNaN(Date.parse(listed.deletedAt!))).toBe(false);
    expect((await api.workers()).filter((x) => x.id !== w.id).every((x) => x.deletedAt === null)).toBe(true);
  });

  test("an unknown worker, and one already deleted → 404 not_found", async () => {
    const api = createMockApi();
    await expectRefusal(api.deleteWorker("w-nope"), 404, "not_found");
    const w = await spare(api, "ซ้ำ");
    await api.deleteWorker(w.id);
    await expectRefusal(api.deleteWorker(w.id), 404, "not_found");
  });

  test("a member of a chain → 409 worker_in_chain with the ids of EVERY project whose chain has them; nothing is deleted; out of the chains, it goes", async () => {
    const api = createMockApi({ state: "new-project" });
    const fern = await byName(api, "ฝน");
    await api.addMember(MOCK_NEW_PROJECT_ID, fern.id);
    const e = await expectRefusal(api.deleteWorker(fern.id), 409, "worker_in_chain");
    expect(e.details).toEqual({ projectIds: [PID, MOCK_NEW_PROJECT_ID] });
    expect((await byName(api, "ฝน")).deletedAt).toBeNull();
    await api.removeMember(MOCK_NEW_PROJECT_ID, fern.id);
    expect(((await expectRefusal(api.deleteWorker(fern.id), 409, "worker_in_chain")).details as { projectIds: string[] }).projectIds).toEqual([PID]);
  });

  test("a deleted worker's name is free again: a new worker may take it, and a rename may too", async () => {
    const api = createMockApi();
    const old = await spare(api, "ชื่อซ้ำ");
    await api.deleteWorker(old.id);
    const again = await spare(api, "ชื่อซ้ำ");
    expect(again.id).not.toBe(old.id);
    const other = await spare(api, "อีกคน");
    await api.deleteWorker((await spare(api, "ชื่อที่สอง")).id);
    expect((await api.updateWorker(other.id, { name: "ชื่อที่สอง" })).name).toBe("ชื่อที่สอง");
    await expectRefusal(spare(api, "ชื่อซ้ำ"), 409, "name_taken"); // …but a LIVE worker still holds its name
  });
});

describe("a hop in the mock follows the core (v1.14)", () => {
  /** the plain seed's one running hop (ฝน, card 3) is ended so the test starts its own */
  const quiet = async () => {
    const api = createMockApi();
    const running = (await api.hops(PID)).find((h) => h.endedAt === null)!;
    await api.finishHop(running.id);
    return { api, running };
  };

  test("starting a hop on a `todo` card moves the card to `doing`; on a card that is already `doing` nothing else moves", async () => {
    const { api } = await quiet();
    const cards = await api.cards(PID);
    const todo = cards.find((c) => c.status === "todo" && c.kind === "work")!;
    const hop = await api.runnerStartHop(todo.id, todo.assigneeId!);
    expect(hop).toMatchObject({ cardId: todo.id, endedAt: null, messageId: null });
    expect(hop.lastActivityAt).toBe(hop.startedAt);
    expect((await api.card(todo.id))!.status).toBe("doing");
    await api.finishHop(hop.id);
    expect((await api.card(todo.id))!.status).toBe("doing"); // finishing does not undo it
    const doing = (await api.cards(PID)).find((c) => c.status === "doing" && c.assigneeId !== null)!;
    await api.runnerStartHop(doing.id, doing.assigneeId!);
    expect((await api.card(doing.id))!.status).toBe("doing");
  });

  test("a card in review / done / stuck keeps its status when a hop starts on it", async () => {
    const { api } = await quiet();
    for (const status of ["review", "done", "stuck"] as const) {
      const c = (await api.cards(PID)).find((x) => x.status === status && x.assigneeId !== null)!;
      const h = await api.runnerStartHop(c.id, c.assigneeId!);
      expect((await api.card(c.id))!.status).toBe(status);
      await api.finishHop(h.id);
    }
  });

  test("a project has one running hop: starting a second → 409 hop_running with the running hop's id; an unknown card → 404", async () => {
    const { api } = await quiet();
    const [a, b] = (await api.cards(PID)).filter((c) => c.kind === "work" && c.assigneeId !== null);
    const first = await api.runnerStartHop(a!.id, a!.assigneeId!);
    const e = await expectRefusal(api.runnerStartHop(b!.id, b!.assigneeId!), 409, "hop_running");
    expect(e.details).toEqual({ hopId: first.id });
    await expectRefusal(api.runnerStartHop("c-nope", a!.assigneeId!), 404, "not_found");
  });
});

describe("removeMember and `hop_running` (v1.14): the checks run in the order 404 → hop_running → is_entry → has_open_cards", () => {
  test("a member with a running hop → 409 hop_running { hopId }, nothing removed — even when they also have open cards (hop_running comes before has_open_cards)", async () => {
    const api = createMockApi();
    const fern = await byName(api, "ฝน"); // the plain seed: ฝน has the running hop, and open cards
    const running = (await api.hops(PID)).find((h) => h.endedAt === null)!;
    expect(running.workerId).toBe(fern.id);
    expect((await api.cards(PID)).some((c) => c.assigneeId === fern.id && c.status !== "done")).toBe(true);
    const e = await expectRefusal(api.removeMember(PID, fern.id), 409, "hop_running");
    expect(e.details).toEqual({ hopId: running.id });
    expect((await api.chain(PID))!.members.map((m) => m.id)).toContain(fern.id);
  });

  test("…and before is_entry: the ENTRY worker with a running hop is refused hop_running, not is_entry", async () => {
    const { api } = await (async () => {
      const api = createMockApi();
      await api.finishHop((await api.hops(PID)).find((h) => h.endedAt === null)!.id);
      return { api };
    })();
    const ploy = await byName(api, "ปลา");
    const card = (await api.cards(PID)).find((c) => c.kind === "work" && c.assigneeId === ploy.id)!;
    const hop = await api.runnerStartHop(card.id, ploy.id);
    expect((await expectRefusal(api.removeMember(PID, ploy.id), 409, "hop_running")).details).toEqual({ hopId: hop.id });
    await api.finishHop(hop.id);
    await expectRefusal(api.removeMember(PID, ploy.id), 409, "is_entry"); // the hop is over: the next check speaks
  });

  test("…and after 404: someone who is not in the chain is 404 even if they have a running hop", async () => {
    const api = createMockApi({ state: "new-project" });
    const fern = await byName(api, "ฝน");
    await expectRefusal(api.removeMember(MOCK_NEW_PROJECT_ID, fern.id), 404, "not_found"); // ฝน's running hop is in the other project, and they are not a member here
  });

  test("without a running hop the old refusals are unchanged: has_open_cards with their card count", async () => {
    const api = createMockApi();
    await api.finishHop((await api.hops(PID)).find((h) => h.endedAt === null)!.id);
    const bank = await byName(api, "แบงค์");
    const e = await expectRefusal(api.removeMember(PID, bank.id), 409, "has_open_cards");
    expect(e.details).toMatchObject({ count: expect.any(Number) });
  });
});


describe("read-only folders (REQ-015 R4a, D-100, SPEC-A-009 Revision 2)", () => {
  const A = "/Users/me/app", B = "/Users/me/spec";
  test("a project starts with no read-only folder; the list and the single read carry `workspace.readOnly`", async () => {
    const api = createMockApi();
    expect((await api.project(PID))!.workspace.readOnly).toEqual([]);
    expect((await summaryOf(api)).workspace.readOnly).toEqual([]);
  });
  test("setWorkspace keeps `readOnly`; left out it is `[]` (all writable), as the contract's default says", async () => {
    const api = createMockApi();
    expect((await api.setWorkspace(PID, [A, B], [B]))!.workspace).toEqual({ roots: [A, B], readOnly: [B] });
    expect((await api.project(PID))!.workspace.readOnly).toEqual([B]);
    expect((await api.setWorkspace(PID, [A, B]))!.workspace).toEqual({ roots: [A, B], readOnly: [] });
    expect((await api.setWorkspace(PID, [A, B], []))!.workspace.readOnly).toEqual([]);
  });
  test("a read-only path that is not in `roots` → 400 validation, and nothing changes", async () => {
    const api = createMockApi();
    await api.setWorkspace(PID, [A, B], [B]);
    await expectRefusal(api.setWorkspace(PID, [A], [B]), 400, "validation");
    await expectRefusal(api.setWorkspace(PID, [A, B], ["/Users/me/other"]), 400, "validation");
    expect((await api.project(PID))!.workspace).toEqual({ roots: [A, B], readOnly: [B] });
  });
  test("removing a folder takes it out of `readOnly` too (the caller sends the shorter list on both)", async () => {
    const api = createMockApi();
    await api.setWorkspace(PID, [A, B], [B]);
    expect((await api.setWorkspace(PID, [A], []))!.workspace).toEqual({ roots: [A], readOnly: [] });
    await api.setWorkspace(PID, [A, B], [B]);
    expect((await api.setWorkspace(PID, [A]))!.workspace).toEqual({ roots: [A], readOnly: [] }); // and with `readOnly` left out
  });
});

describe("the reply door ends the open chat hop it answers (TASK-B-115, D-103 Q-1)", () => {
  test("`chat-running`, then replyChat: the open hop is ended in hops() and in the chat hop, and the ask's replyHopId is that very hop", async () => {
    const api = createMockApi({ state: "chat-running" });
    const open = (await api.hops(PID)).find((h) => h.messageId !== null && h.endedAt === null)!;
    expect(open).toBeDefined();
    const hopsBefore = (await api.hops(PID)).length;
    const seq0 = (await api.events(PID)).at(-1)?.seq ?? 0;
    await api.replyChat(PID, "ตอบแล้วครับ");
    const after = (await api.hops(PID)).find((h) => h.id === open.id)!;
    expect(after.endedAt).not.toBeNull();
    expect(after.outcome).toBe("commented");
    expect((await api.hops(PID)).length).toBe(hopsBefore); // that hop, not a new one
    expect((await api.hops(PID)).some((h) => h.endedAt === null)).toBe(false); // nothing is left running
    const ask = (await api.chat(PID)).find((m) => m.id === open.messageId)!;
    expect(ask.replyHopId).toBe(open.id);
    expect(ask.chatHop).toMatchObject({ id: open.id, outcome: "commented" });
    expect(ask.chatHop!.endedAt).not.toBeNull();
    expect((await api.events(PID, { after: seq0 })).map((e) => e.type)).toEqual(["chat.replied"]); // still the one event
  });
  test("the plain seed: nothing is open, so the reply makes its own ended hop, as before — and no hop appears in hops()", async () => {
    const api = createMockApi();
    const hopsBefore = (await api.hops(PID)).length;
    const ask = await api.postChat(PID, "ถามหน่อย");
    await api.replyChat(PID, "ตอบ");
    const got = (await api.chat(PID)).find((m) => m.id === ask.id)!;
    expect(got.replyHopId).not.toBeNull();
    expect(got.chatHop).toMatchObject({ id: got.replyHopId, outcome: "commented" });
    expect(got.chatHop!.endedAt).not.toBeNull();
    expect((await api.hops(PID)).length).toBe(hopsBefore);
  });
  test("an open card hop (not a chat hop) is left running by a reply", async () => {
    const api = createMockApi(); // the plain seed runs ฝน on a card
    const card = (await api.hops(PID)).find((h) => h.endedAt === null && h.messageId === null)!;
    expect(card).toBeDefined();
    await api.postChat(PID, "ถามหน่อย");
    await api.replyChat(PID, "ตอบ");
    expect((await api.hops(PID)).find((h) => h.id === card.id)!.endedAt).toBeNull();
  });
});

describe("startHop, the operator's `ทำต่อ` (REQ-016 AC-4, TASK-B-117): POST /v1/projects/{id}/hops", () => {
  const quiet = async () => {
    const api = createMockApi();
    await api.finishHop((await api.hops(PID)).find((h) => h.endedAt === null)!.id);
    return api;
  };
  const workableCard = async (api: CawApi, nth = 0) => (await api.cards(PID)).filter((c) => c.workable && c.assigneeId !== null)[nth]!;
  test("a workable card: the hop is running, the card is `doing`, and the log gets `hop.started` (seq +1)", async () => {
    const api = await quiet();
    const c = await workableCard(api);
    const seq0 = (await api.events(PID)).at(-1)?.seq ?? 0;
    const hop = await api.startHop(PID, c.id, c.assigneeId!);
    expect(hop).toMatchObject({ projectId: PID, cardId: c.id, workerId: c.assigneeId, endedAt: null, messageId: null });
    expect((await api.hops(PID)).filter((h) => h.endedAt === null).map((h) => h.id)).toEqual([hop.id]);
    expect((await api.card(c.id))!.status).toBe("doing");
    const evs = await api.events(PID, { after: seq0 });
    expect(evs.map((e) => e.type)).toEqual(["hop.started"]);
    expect(evs[0]!.seq).toBe(seq0 + 1);
  });
  test("a second while one runs → 409 hop_running { hopId }, and no event", async () => {
    const api = await quiet();
    const [a, b] = [await workableCard(api, 0), await workableCard(api, 1)];
    const first = await api.startHop(PID, a.id, a.assigneeId!);
    const seq = (await api.events(PID)).at(-1)!.seq;
    const e = await expectRefusal(api.startHop(PID, b.id, b.assigneeId!), 409, "hop_running");
    expect(e.details).toEqual({ hopId: first.id });
    expect((await api.events(PID)).at(-1)!.seq).toBe(seq);
  });
  test("a card that is not workable (done / review / stuck / waiting on another) → 409 not_workable, nothing started, no event", async () => {
    const api = await quiet();
    const notWorkable = (await api.cards(PID)).filter((c) => !c.workable && c.assigneeId !== null);
    expect(notWorkable.length).toBeGreaterThan(0);
    const seq0 = (await api.events(PID)).at(-1)?.seq ?? 0;
    for (const c of notWorkable) await expectRefusal(api.startHop(PID, c.id, c.assigneeId!), 409, "not_workable");
    expect((await api.hops(PID)).some((h) => h.endedAt === null)).toBe(false);
    expect((await api.events(PID)).at(-1)?.seq ?? 0).toBe(seq0);
  });
  test("unknown card or worker → 404; a card of another project is not found in this one", async () => {
    const api = await quiet();
    const c = await workableCard(api);
    await expectRefusal(api.startHop(PID, "c-nope", c.assigneeId!), 404, "not_found");
    await expectRefusal(api.startHop(PID, c.id, "w-nope"), 404, "not_found");
    await expectRefusal(api.startHop("p-nope", c.id, c.assigneeId!), 404, "not_found");
  });
  test("a card of ANOTHER project is not found in this one (`new-project` has a second, empty project)", async () => {
    const api = createMockApi({ state: "new-project" });
    await (api as unknown as import("./mock").MockRunner).finishHop((await api.hops(PID)).find((h) => h.endedAt === null)!.id);
    const other = (await api.projects()).find((p) => p.id !== PID)!.id;
    const c = (await api.cards(PID)).find((x) => x.workable && x.assigneeId !== null)!;
    await expectRefusal(api.startHop(other, c.id, c.assigneeId!), 404, "not_found");
    expect((await api.hops(PID)).some((h) => h.endedAt === null)).toBe(false);
  });
});

describe("mock states for the next screens (TASK-B-117)", () => {
  test("`entry-asked-two`: `entry-asked`, and the entry worker's newest reply carries TWO questions, each with its proposedDefault", async () => {
    const two = createMockApi({ state: "entry-asked-two" });
    const msgs = await two.chat(PID);
    const newest = msgs.filter((m) => m.author.startsWith("worker:")).at(-1)!;
    expect(newest.questions).toHaveLength(2);
    expect(newest.questions!.every((q) => q.text.length > 0 && q.proposedDefault.length > 0)).toBe(true);
    expect(newest.questions![0]!.text).not.toBe(newest.questions![1]!.text);
    // nobody has answered it: the operator's messages all come before it
    expect(msgs.at(-1)!.id).toBe(newest.id);
    // and it is otherwise the `entry-asked` thread
    const one = (await createMockApi({ state: "entry-asked" }).chat(PID));
    expect(msgs.map((m) => m.id)).toEqual(one.map((m) => m.id));
    expect(one.filter((m) => m.author.startsWith("worker:")).at(-1)!.questions).toHaveLength(1);
  });
  test("`manual-idle`: the project is in manual, nothing is running, and two or more cards are workable, each with an assignee", async () => {
    const api = createMockApi({ state: "manual-idle" });
    expect((await api.project(PID))!.mode).toBe("manual");
    expect((await api.hops(PID)).some((h) => h.endedAt === null)).toBe(false);
    const workable = (await api.cards(PID)).filter((c) => c.workable);
    expect(workable.length).toBeGreaterThanOrEqual(2);
    expect(workable.every((c) => c.assigneeId !== null)).toBe(true);
    // the plain seed is not that: it has its one running hop
    expect((await createMockApi().hops(PID)).some((h) => h.endedAt === null)).toBe(true);
  });
});

describe("the `startStep` server action (TASK-B-117)", () => {
  test("ok → { ok: true } and the page is revalidated; a refusal → its code (not_workable, hop_running), revalidated too; an unknown project → not_found", async () => {
    const { mock } = await import("bun:test");
    const revalidated: string[][] = [];
    mock.module("next/cache", () => ({ revalidatePath: (...a: string[]) => { revalidated.push(a); } }));
    const saved = process.env.CAW_API;
    process.env.CAW_API = "mock";
    try {
      const { startStep } = await import("../app/p/[id]/actions");
      const { api, resetMock } = await import("./index");
      resetMock("manual-idle");
      const [a, b] = (await api.cards(PID)).filter((c) => c.workable && c.assigneeId !== null);
      expect(await startStep(PID, a!.id, a!.assigneeId!)).toEqual({ ok: true });
      expect((await api.hops(PID)).filter((h) => h.endedAt === null)).toHaveLength(1);
      expect(await startStep(PID, b!.id, b!.assigneeId!)).toEqual({ ok: false, code: "hop_running" });
      const done = (await api.cards(PID)).find((c) => !c.workable && c.assigneeId !== null)!;
      await (api as unknown as import("./mock").MockRunner).finishHop((await api.hops(PID)).find((h) => h.endedAt === null)!.id);
      expect(await startStep(PID, done.id, done.assigneeId!)).toEqual({ ok: false, code: "not_workable" });
      expect(await startStep("p-nope", a!.id, a!.assigneeId!)).toEqual({ ok: false, code: "not_found" });
      expect(revalidated).toEqual([[`/p/${PID}`, "layout"], [`/p/${PID}`, "layout"], [`/p/${PID}`, "layout"], ["/p/p-nope", "layout"]]);
      resetMock();
    } finally { if (saved === undefined) delete process.env.CAW_API; else process.env.CAW_API = saved; }
  });
});
