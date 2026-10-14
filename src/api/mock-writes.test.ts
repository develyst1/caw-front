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

  test("another confirmed version → a new empty project, in the list, and asking again says already_exists with its id", async () => {
    const { api } = await setup();
    const p = await api.createProject({ blueprintProjectId: BP, version: 4 });
    expect(p.id).not.toBe(PID);
    expect([p.version, p.mode, p.workspace.roots]).toEqual([4, "manual", []]);
    expect((await api.projects()).map((x) => x.id)).toEqual([PID, p.id]);
    expect(await api.cards(p.id)).toEqual([]);
    expect((await api.chain(p.id))!.members).toEqual([]);
    const again = await expectRefusal(api.createProject({ blueprintProjectId: BP, version: 4 }), 409, "already_exists");
    expect(again.details).toEqual({ id: p.id });
  });

  test("an unknown Blueprint project → 404 blueprint_project_not_found; an unconfirmed version → 409 version_not_confirmed", async () => {
    const { api } = await setup();
    await expectRefusal(api.createProject({ blueprintProjectId: "nope", version: 1 }), 404, "blueprint_project_not_found");
    await expectRefusal(api.createProject({ blueprintProjectId: BP, version: 99 }), 409, "version_not_confirmed");
    await expectRefusal(api.createProject({ blueprintProjectId: BP, version: 0 }), 409, "version_not_confirmed");
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
    expect((await summaryOf(api)).stuckCount).toBe(3); // the open question is no longer stuck
  });

  test("clearSpecChange: the card is no longer stuck by a spec change", async () => {
    const { api, card } = await setup();
    const before = (await summaryOf(api)).stuckCount;
    const c = await api.clearSpecChange(card(6).id);
    expect(c.specChangedVersion).toBeNull();
    expect((await summaryOf(api)).stuckCount).toBe(before - 1);
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
