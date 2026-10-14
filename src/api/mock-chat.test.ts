// The chat and the card proposals on the mock (SPEC-A-008 § v1.4, REQ-013): the seeded thread, posting, proposals newest first with
// `hopsTotal` computed on read, and accepting one — which makes the cards (dependencies mapped from indexes to the new ids) and refuses a
// second accept, a superseded proposal, and one whose anchor is gone from Blueprint.
import { describe, expect, test } from "bun:test";
import { CawError } from "./caw";
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

/** The seeded proposals by their state, so a test reads like the thread. */
const seeded = async () => {
  const api = createMockApi();
  const proposals = await api.proposals(PID);
  const by = (status: string, n = 0) => proposals.filter((p) => p.status === status)[n]!;
  return { api, proposals, open: by("open", 1), openGone: by("open", 0), superseded: by("superseded") };
};

describe("the chat", () => {
  test("the seeded thread, oldest first: an operator message, the entry worker's reply with questions and a proposal, then a second ask and its reply", async () => {
    const msgs = await createMockApi().chat(PID);
    expect(msgs.map((m) => m.author.startsWith("worker:") ? "worker" : m.author)).toEqual(["operator", "worker", "operator", "worker"]);
    expect(msgs.map((m) => Date.parse(m.at))).toEqual([...msgs.map((m) => Date.parse(m.at))].sort((a, b) => a - b));
    const [ask, reply] = msgs as [typeof msgs[number], typeof msgs[number]];
    expect(reply.replyTo).toBe(ask.id);
    expect(ask.replyHopId).not.toBeNull(); // answered
    expect(reply.questions!.length).toBeGreaterThan(0);
    for (const q of reply.questions!) { expect(q.text.length).toBeGreaterThan(0); expect(q.cases.length).toBeGreaterThan(0); }
    expect(reply.proposalId).not.toBeNull();
    expect(msgs.every((m) => m.projectId === PID)).toBe(true);
    expect(msgs[0]!.questions).toBeNull();
    expect(msgs[0]!.proposalId).toBeNull();
    expect(msgs[0]!.amendment).toBeNull();
  });

  test("exactly one seeded message carries an amendment — the reply that proposed a card and sent the missing part to Blueprint; a posted message never does", async () => {
    const api = createMockApi();
    const msgs = await api.chat(PID);
    const withAmendment = msgs.filter((m) => m.amendment !== null);
    expect(withAmendment).toHaveLength(1);
    const m = withAmendment[0]!;
    expect(m.author.startsWith("worker:")).toBe(true);
    expect(m.proposalId).not.toBeNull(); // the "proposed_and_amended" case: it kept its proposal
    expect(m.amendment!.blueprintMessageId.length).toBeGreaterThan(0);
    expect(m.amendment!.link).toBe("http://127.0.0.1:3100/p/11111111-2222-4333-8444-555555555555/chat"); // <BLUEPRINT_WEB_URL>/p/<blueprintProjectId>/chat
    expect(m.id).toBe(msgs[3]!.id); // the second reply, the one whose anchor has gone from Blueprint
    expect((await api.postChat(PID, "ทดสอบ")).amendment).toBeNull();
  });

  test("after = a message id: only what came after it; limit caps the list; an unknown project has no messages", async () => {
    const api = createMockApi();
    const all = await api.chat(PID);
    expect((await api.chat(PID, { after: all[1]!.id })).map((m) => m.id)).toEqual(all.slice(2).map((m) => m.id));
    expect((await api.chat(PID, { after: all.at(-1)!.id }))).toEqual([]);
    expect((await api.chat(PID, { limit: 2 })).map((m) => m.id)).toEqual(all.slice(0, 2).map((m) => m.id));
    expect(await api.chat("nope")).toEqual([]);
  });

  test("postChat: the operator's message joins the end of the thread with nothing else set; text must be 1-4000 characters; no worker answers for the runner", async () => {
    const api = createMockApi();
    const before = await api.chat(PID);
    const m = await api.postChat(PID, "ขอบคุณ ทำต่อได้เลย");
    expect([m.author, m.text, m.replyTo, m.replyHopId, m.questions, m.proposalId, m.amendment, m.projectId]).toEqual(["operator", "ขอบคุณ ทำต่อได้เลย", null, null, null, null, null, PID]);
    const after = await api.chat(PID);
    expect(after).toHaveLength(before.length + 1); // exactly one: the mock does not invent a reply
    expect(after.at(-1)!.id).toBe(m.id);
    expect(Number.isNaN(Date.parse(m.at))).toBe(false); // a real timestamp (the thread's order is the order of posting, not the clock's)
    await expectRefusal(api.postChat(PID, ""), 400, "validation");
    await expectRefusal(api.postChat(PID, "ก".repeat(4001)), 400, "validation");
    expect((await api.postChat(PID, "ก".repeat(4000))).text).toHaveLength(4000);
    await expectRefusal(api.postChat("nope", "x"), 404, "not_found");
  });
});

describe("proposals", () => {
  test("newest first; hopsTotal is the sum of the items' hops, computed on read; items carry their dependencies as indexes", async () => {
    const { proposals, open } = await seeded();
    expect(proposals.map((p) => p.createdAt)).toEqual([...proposals.map((p) => p.createdAt)].sort().reverse());
    expect(proposals.map((p) => p.status).sort()).toEqual(["open", "open", "superseded"]);
    for (const p of proposals) expect(p.hopsTotal).toBe(p.items.reduce((s, i) => s + i.hops, 0));
    expect(open.items).toHaveLength(3);
    expect(open.hopsTotal).toBe(6);
    expect(open.items.map((i) => i.dependsOn)).toEqual([[], [0], [0, 1]]);
    expect(open.cardIds).toBeNull();
    for (const i of open.items) { expect(i.hops).toBeGreaterThanOrEqual(1); expect(i.anchor.version).toBeGreaterThan(0); }
  });

  test("messageId narrows to the proposals made on that message — the older one on the same message is the superseded one", async () => {
    const { api, open, superseded } = await seeded();
    const onFirst = await api.proposals(PID, { messageId: open.messageId });
    expect(onFirst.map((p) => p.id)).toEqual([open.id, superseded.id]);
    expect(onFirst.map((p) => p.status)).toEqual(["open", "superseded"]);
    expect(await api.proposals(PID, { messageId: "nope" })).toEqual([]);
    expect(await api.proposals("nope")).toEqual([]);
  });

  test("proposal ids answer to the message that carries them", async () => {
    const api = createMockApi();
    const [msgs, proposals] = [await api.chat(PID), await api.proposals(PID)];
    for (const m of msgs.filter((x) => x.proposalId)) expect(proposals.some((p) => p.id === m.proposalId)).toBe(true);
  });
});

describe("accepting a proposal", () => {
  test("it makes one card per item — assignee = the item's worker, anchor as given, dependencies mapped from indexes to the new ids — on the board, and the proposal is accepted with their ids", async () => {
    const { api, open } = await seeded();
    const before = (await api.cards(PID)).length;
    const cards = await api.acceptProposal(open.id);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.title)).toEqual(open.items.map((i) => i.title));
    expect(cards.map((c) => c.assigneeId)).toEqual(open.items.map((i) => i.workerId));
    expect(cards.map((c) => c.anchor)).toEqual(open.items.map((i) => i.anchor));
    expect(cards.map((c) => c.dependsOn)).toEqual([[], [cards[0]!.id], [cards[0]!.id, cards[1]!.id]]);
    expect(cards.every((c) => c.kind === "work" && c.status === "todo" && c.projectId === PID && c.question === null && c.answer === null)).toBe(true);
    expect(cards.map((c) => c.number)).toEqual([before + 1, before + 2, before + 3]);
    // the first has nothing it waits for; the others wait for the ones before them (still todo)
    expect(cards.map((c) => c.workable)).toEqual([true, false, false]);
    const board = await api.cards(PID);
    expect(board).toHaveLength(before + 3);
    for (const c of cards) expect(board.find((b) => b.id === c.id)?.title).toBe(c.title);
    const [after] = await api.proposals(PID, { messageId: open.messageId });
    expect([after!.status, after!.cardIds]).toEqual(["accepted", cards.map((c) => c.id)]);
    expect((await api.projects())[0]!.cardsTotal).toBe(before + 3);
  });

  test("a second accept of the same proposal → 409 not_open and no more cards", async () => {
    const { api, open } = await seeded();
    await api.acceptProposal(open.id);
    const n = (await api.cards(PID)).length;
    await expectRefusal(api.acceptProposal(open.id), 409, "not_open");
    expect(await api.cards(PID)).toHaveLength(n);
  });

  test("a superseded proposal cannot be accepted → 409 not_open", async () => {
    const { api, superseded } = await seeded();
    const n = (await api.cards(PID)).length;
    await expectRefusal(api.acceptProposal(superseded.id), 409, "not_open");
    expect(await api.cards(PID)).toHaveLength(n);
  });

  test("an anchor that is gone from Blueprint → 422 anchor_not_in_version, nothing written, the proposal stays open", async () => {
    const { api, openGone } = await seeded();
    expect(openGone.items.some((i) => i.anchor.key === "STEP-099")).toBe(true);
    const n = (await api.cards(PID)).length;
    await expectRefusal(api.acceptProposal(openGone.id), 422, "anchor_not_in_version");
    expect(await api.cards(PID)).toHaveLength(n);
    expect((await api.proposals(PID, { messageId: openGone.messageId }))[0]!.status).toBe("open");
  });

  test("an unknown proposal → 404 not_found", async () => {
    await expectRefusal(createMockApi().acceptProposal("nope"), 404, "not_found");
  });
});

describe("a chat step that failed and the retry (SPEC-A-008 § v1.9, D-057)", () => {
  const ask3 = async (api: ReturnType<typeof createMockApi>) => (await api.chat(PID)).find((m) => m.text.includes("หน้าสรุปรายงาน"))!;

  test("chatHop is computed on read: none for a message nobody picked up, the newest hop for one that was — running, or ended failed; retryRequestedAt starts null", async () => {
    const api = createMockApi();
    const fresh = await api.postChat(PID, "ขอเพิ่มปุ่มพิมพ์");
    expect([fresh.chatHop, fresh.retryRequestedAt]).toEqual([null, null]);
    expect((await api.chat(PID)).every((m) => m.retryRequestedAt === null)).toBe(true);

    const failed = await ask3(createMockApi({ state: "chat-failed" }));
    expect(failed.replyHopId).toBeNull();
    expect(failed.chatHop).toEqual({ id: expect.any(String), endedAt: expect.any(String), outcome: "failed" });
    const running = await ask3(createMockApi({ state: "chat-running" }));
    expect(running.chatHop).toEqual({ id: expect.any(String), endedAt: null, outcome: null });
  });

  test("chat-failed: the second ask has a failed chat hop and NO reply (no worker message, no proposal on it); the plain seed is unchanged", async () => {
    const api = createMockApi({ state: "chat-failed" });
    const msgs = await api.chat(PID);
    expect(msgs.map((m) => m.author.startsWith("worker:") ? "worker" : m.author)).toEqual(["operator", "worker", "operator"]);
    expect((await api.proposals(PID)).map((p) => p.messageId === msgs[2]!.id)).not.toContain(true);
    expect((await createMockApi().chat(PID)).length).toBe(4);
  });

  test("retryChat on a failed step sets retryRequestedAt (the hop is left as it was); a second retry moves the time later", async () => {
    const api = createMockApi({ state: "chat-failed" });
    const before = await ask3(api);
    expect(await api.retryChat(before.id)).toBeUndefined();
    const once = await ask3(api);
    expect(once.retryRequestedAt).not.toBeNull();
    expect(once.chatHop).toEqual(before.chatHop);
    await api.retryChat(before.id);
    const twice = await ask3(api);
    expect(Date.parse(twice.retryRequestedAt!)).toBeGreaterThan(Date.parse(once.retryRequestedAt!));
    expect((await api.chat(PID)).filter((m) => m.retryRequestedAt !== null)).toHaveLength(1); // only that message
  });

  test("a message with no chat hop yet can be retried too", async () => {
    const api = createMockApi();
    const m = await api.postChat(PID, "ขอเพิ่มปุ่มพิมพ์");
    await api.retryChat(m.id);
    expect((await api.chat(PID)).find((x) => x.id === m.id)!.retryRequestedAt).not.toBeNull();
  });

  test("refusals: answered → 409 already_answered · its hop still running → 409 hop_running · a worker's reply → 400 not_operator_message · unknown → 404 — and nothing is set", async () => {
    const plain = createMockApi();
    const msgs = await plain.chat(PID);
    await expectRefusal(plain.retryChat(msgs[0]!.id), 409, "already_answered"); // the first ask has its reply
    await expectRefusal(plain.retryChat(msgs[1]!.id), 400, "not_operator_message");
    await expectRefusal(plain.retryChat("m-nope"), 404, "not_found");
    expect((await plain.chat(PID)).every((m) => m.retryRequestedAt === null)).toBe(true);

    const running = createMockApi({ state: "chat-running" });
    await expectRefusal(running.retryChat((await ask3(running)).id), 409, "hop_running");
    expect((await ask3(running)).retryRequestedAt).toBeNull();
  });
});

