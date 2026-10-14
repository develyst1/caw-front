// The http implementation against a fake `fetch` — what it sends (route, query, body, the actor header on writes only) and how it
// reads a refusal. Against the real caw-back it is checked by hand (TASK-B-040 DoD 3), because that needs the back end running.
import { describe, expect, test } from "bun:test";
import { CawError } from "./caw";
import { createHttpApi } from "./http";
import { chatRefused, teamRefused } from "../words";

interface Seen { method: string; path: string; query: string; actor: string | null; body: unknown }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** An api whose back end is a function: it sees every request and answers with a Response. */
const against = (answer: (seen: Seen) => Response | Promise<Response>) => {
  const log: Seen[] = [];
  const api = createHttpApi({
    baseUrl: "http://caw.test",
    fetch: async (req) => {
      const url = new URL(req.url);
      const text = await req.clone().text();
      const seen: Seen = { method: req.method, path: url.pathname, query: url.search, actor: req.headers.get("X-CAW-Actor"), body: text ? JSON.parse(text) : undefined };
      log.push(seen);
      return answer(seen);
    },
  });
  return { api, log };
};

describe("what it sends", () => {
  test("a read carries no actor header and unwraps its list", async () => {
    const { api, log } = against(() => json(200, { projects: [{ id: "p1", name: "ก" }] }));
    expect(await api.projects()).toEqual([{ id: "p1", name: "ก" } as never]);
    expect(log).toEqual([{ method: "GET", path: "/v1/projects", query: "", actor: null, body: undefined }]);
  });

  test("every write carries X-CAW-Actor: operator, with its body", async () => {
    const { api, log } = against(() => json(200, { id: "p1" }));
    await api.setMode("p1", "dispatcher", 10);
    await api.setWorkspace("p1", ["/Users/me/repo"]);
    expect(log.map((s) => [s.method, s.path, s.actor, s.body])).toEqual([
      ["PATCH", "/v1/projects/p1/mode", "operator", { mode: "dispatcher", hopBudget: 10 }],
      ["PATCH", "/v1/projects/p1/workspace", "operator", { roots: ["/Users/me/repo"] }],
    ]);
  });

  test("cards: the filters go in the query, `workable` as the words true / false", async () => {
    const { api, log } = against(() => json(200, { cards: [] }));
    await api.cards("p1", { assigneeId: "w1", status: "doing", workable: true });
    await api.cards("p1", { workable: false });
    await api.cards("p1");
    const queries = log.map((s) => new URLSearchParams(s.query).toString());
    expect(queries).toEqual(["assigneeId=w1&status=doing&workable=true", "workable=false", ""]);
  });

  test("the chain's writes: members (with reassignTo), edges (DELETE with a body), the entry", async () => {
    const { api, log } = against(() => json(200, { members: [], edges: [], entryWorkerId: null }));
    await api.addMember("p1", "w1");
    await api.removeMember("p1", "w1", "w2");
    await api.removeMember("p1", "w3");
    await api.addEdge("p1", "w1", "w2");
    await api.removeEdge("p1", "w1", "w2");
    await api.setEntry("p1", "w2");
    expect(log.map((s) => [s.method, s.path + s.query, s.body])).toEqual([
      ["POST", "/v1/projects/p1/chain/members", { workerId: "w1" }],
      ["DELETE", "/v1/projects/p1/chain/members/w1?reassignTo=w2", undefined],
      ["DELETE", "/v1/projects/p1/chain/members/w3", undefined],
      ["POST", "/v1/projects/p1/chain/edges", { from: "w1", to: "w2" }],
      ["DELETE", "/v1/projects/p1/chain/edges", { from: "w1", to: "w2" }],
      ["PUT", "/v1/projects/p1/chain/entry", { workerId: "w2" }],
    ]);
    expect(log.every((s) => s.actor === "operator")).toBe(true);
  });

  test("a card's writes and the worker writes use the contract's routes and bodies", async () => {
    const { api, log } = against(() => json(200, {}));
    await api.comment("c1", "สวัสดี").catch(() => null);
    await api.setStatus("c1", "review");
    await api.assign("c1", "w1");
    await api.handoff("c1", "w2", "ส่งต่อ");
    await api.answer("c1", "ตอบ");
    await api.clearSpecChange("c1");
    await api.createWorker({ name: "ก", role: "FE", skills: ["role-fe"] });
    await api.combineWorkers("ข", ["w1", "w2"]);
    await api.startRun("p1", 5);
    await api.createProject({ blueprintProjectId: "bp", version: 3 });
    expect(log.map((s) => [s.method, s.path, s.body])).toEqual([
      ["POST", "/v1/cards/c1/comments", { text: "สวัสดี" }],
      ["PATCH", "/v1/cards/c1/status", { status: "review" }],
      ["PATCH", "/v1/cards/c1/assignee", { workerId: "w1" }],
      ["POST", "/v1/cards/c1/handoff", { toWorkerId: "w2", text: "ส่งต่อ" }],
      ["POST", "/v1/cards/c1/answer", { answer: "ตอบ" }],
      ["POST", "/v1/cards/c1/spec-change/clear", undefined],
      ["POST", "/v1/workers", { name: "ก", role: "FE", skills: ["role-fe"] }],
      ["POST", "/v1/workers/combine", { name: "ข", workerIds: ["w1", "w2"] }],
      ["POST", "/v1/projects/p1/runs", { hopBudget: 5 }],
      ["POST", "/v1/projects", { blueprintProjectId: "bp", version: 3 }],
    ]);
    expect(log.every((s) => s.actor === "operator")).toBe(true);
  });
});

describe("how it reads the answer", () => {
  test("a 404 on a read is null / an empty list, not an error", async () => {
    const { api } = against(() => json(404, { error: { code: "not_found", message: "no" } }));
    expect(await api.project("x")).toBeNull();
    expect(await api.card("x")).toBeNull();
    expect(await api.cardContext("x")).toBeNull();
    expect(await api.chain("x")).toBeNull();
    expect(await api.cards("x")).toEqual([]);
    expect(await api.hops("x")).toEqual([]);
    expect(await api.runs("x")).toEqual([]);
  });

  test("a refusal becomes a CawError with its status, code, message and details (chain_broken keeps who may take it)", async () => {
    const { api } = against(() => json(409, { error: { code: "chain_broken", message: "no edge", details: { from: "w1", allowed: ["w2", "w3"] } } }));
    const e = await api.handoff("c1", "w9", "x").then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(CawError);
    const err = e as CawError;
    expect([err.status, err.code, err.message]).toEqual([409, "chain_broken", "no edge"]);
    expect(err.details).toEqual({ from: "w1", allowed: ["w2", "w3"] });
  });

  test("already_exists on a project keeps the id of the one that exists", async () => {
    const { api } = against(() => json(409, { error: { code: "already_exists", message: "exists", details: { id: "p7" } } }));
    const e = (await api.createProject({ blueprintProjectId: "bp", version: 3 }).then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code, e.details]).toEqual([409, "already_exists", { id: "p7" }]);
  });

  test("a write the back end refuses is an error, a read of a 5xx too", async () => {
    const { api } = against(() => json(502, { error: { code: "blueprint_unreachable", message: "down" } }));
    const e = (await api.cardContext("c1").then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code]).toEqual([502, "blueprint_unreachable"]);
  });

  test("a back end that cannot be reached is CawError(0, unreachable)", async () => {
    const api = createHttpApi({ baseUrl: "http://caw.test", fetch: async () => { throw new TypeError("fetch failed"); } });
    const e = (await api.projects().then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code]).toEqual([0, "unreachable"]);
  });
});

describe("the chat and the proposals (SPEC-A-008 § v1.4)", () => {
  test("chat: GET with after / limit in the query, the messages unwrapped; postChat: POST with the text and the operator's actor", async () => {
    const { api, log } = against((s) => (s.method === "GET" ? json(200, { messages: [{ id: "m1" }] }) : json(201, { id: "m2", author: "operator", text: "สวัสดี" })));
    expect(await api.chat("p1", { after: "m0", limit: 20 })).toEqual([{ id: "m1" } as never]);
    await api.chat("p1");
    const posted = await api.postChat("p1", "สวัสดี");
    expect(posted.id).toBe("m2");
    expect(log.map((s) => [s.method, s.path + s.query, s.actor, s.body])).toEqual([
      ["GET", "/v1/projects/p1/chat?after=m0&limit=20", null, undefined],
      ["GET", "/v1/projects/p1/chat", null, undefined],
      ["POST", "/v1/projects/p1/chat", "operator", { text: "สวัสดี" }],
    ]);
  });

  test("proposals: GET with messageId in the query; acceptProposal: POST with no body, the cards unwrapped", async () => {
    const { api, log } = against((s) => (s.method === "GET" ? json(200, { proposals: [{ id: "q1", hopsTotal: 6 }] }) : json(200, { cards: [{ id: "c1" }, { id: "c2" }] })));
    expect((await api.proposals("p1", { messageId: "m1" })).map((p) => p.id)).toEqual(["q1"]);
    expect((await api.acceptProposal("q1")).map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(log.map((s) => [s.method, s.path + s.query, s.actor, s.body])).toEqual([
      ["GET", "/v1/projects/p1/proposals?messageId=m1", null, undefined],
      ["POST", "/v1/proposals/q1/accept", "operator", undefined],
    ]);
  });

  test("an unknown project has no messages and no proposals (404 on a list is an empty list); posting to it is an error", async () => {
    const { api } = against(() => json(404, { error: { code: "not_found", message: "no" } }));
    expect(await api.chat("x")).toEqual([]);
    expect(await api.proposals("x")).toEqual([]);
    const e = (await api.postChat("x", "a").then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code]).toEqual([404, "not_found"]);
  });

  test("accept's refusals arrive as CawError: 409 not_open, 422 anchor_not_in_version", async () => {
    for (const [status, code] of [[409, "not_open"], [422, "anchor_not_in_version"]] as const) {
      const { api } = against(() => json(status, { error: { code, message: "no" } }));
      const e = (await api.acceptProposal("q1").then(() => null, (x: unknown) => x)) as CawError;
      expect([e.status, e.code]).toEqual([status, code]);
    }
  });

  test("caw-back's 400 `validation` (its code for a bad body) reaches the screens' tables: a line of its own, not `other`", async () => {
    const { api } = against(() => json(400, { error: { code: "validation", message: "text: 1-4000 characters" } }));
    const e = (await api.postChat("p1", "").then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code]).toEqual([400, "validation"]);
    expect(chatRefused[e.code]).toBeDefined();
    expect(chatRefused[e.code]).not.toBe(chatRefused.other);
    expect(teamRefused[e.code]).toBeDefined();
    expect(teamRefused[e.code]).not.toBe(teamRefused.other);
  });
});

describe("a spec part (SPEC-A-008 § v1.7)", () => {
  const ctx = { projectId: "bp", version: 3, confirmedAt: "2026-10-12T20:00:00+07:00", part: { key: "SCR-003", kind: "screen", title: "หน้าอนุมัติคำขอ" }, neighbours: [], decisions: [], flows: [], questions: [] };
  test("part: GET /parts/{key}, `version` in the query only when given, the PartContext as it came", async () => {
    const { api, log } = against(() => json(200, ctx));
    expect(await api.part("p1", "SCR-003")).toEqual(ctx as never);
    expect(await api.part("p1", "SCR-003", 2)).toEqual(ctx as never);
    expect(log.map((l) => [l.method, l.path, l.query, l.actor])).toEqual([["GET", "/v1/projects/p1/parts/SCR-003", "", null], ["GET", "/v1/projects/p1/parts/SCR-003", "?version=2", null]]);
  });
  test("404 (part_not_found or an unknown project) → null; 502 blueprint_unreachable → null; an unreachable caw-back → null; another refusal is a CawError", async () => {
    for (const [status, code] of [[404, "part_not_found"], [404, "not_found"], [502, "blueprint_unreachable"]] as const) {
      const { api } = against(() => json(status, { error: { code, message: "no" } }));
      expect(await api.part("p1", "STEP-099")).toBeNull();
    }
    expect(await createHttpApi({ baseUrl: "http://caw.test", fetch: async () => { throw new Error("down"); } }).part("p1", "SCR-003")).toBeNull();
    const { api } = against(() => json(400, { error: { code: "validation", message: "version: an integer ≥ 1" } }));
    const e = (await api.part("p1", "SCR-003", 0).then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code]).toEqual([400, "validation"]);
  });
});

describe("retrying a chat step (SPEC-A-008 § v1.9)", () => {
  test("retryChat: POST /v1/chat/{id}/retry with the operator's actor and no body; 202 resolves to nothing", async () => {
    const { api, log } = against(() => json(202, {}));
    expect(await api.retryChat("m1")).toBeUndefined();
    expect(log).toEqual([{ method: "POST", path: "/v1/chat/m1/retry", query: "", actor: "operator", body: undefined }]);
  });
  test("its refusals arrive as CawError: 409 already_answered / hop_running, 400 not_operator_message, 404 — an unknown message is an error, not null", async () => {
    for (const [status, code] of [[409, "already_answered"], [409, "hop_running"], [400, "not_operator_message"], [404, "not_found"]] as const) {
      const { api } = against(() => json(status, { error: { code, message: "no" } }));
      const e = (await api.retryChat("m1").then(() => null, (x: unknown) => x)) as CawError;
      expect([e.status, e.code]).toEqual([status, code]);
    }
  });
  test("a chat message's chatHop and retryRequestedAt pass through as the back end sent them", async () => {
    const m = { id: "m1", projectId: "p1", author: "operator", text: "x", replyTo: null, replyHopId: null, questions: null, proposalId: null, amendment: null, at: "2026-10-14T09:00:00+07:00",
      chatHop: { id: "h1", endedAt: "2026-10-14T09:00:30+07:00", outcome: "failed" }, retryRequestedAt: "2026-10-14T09:05:00+07:00" };
    const { api } = against(() => json(200, { messages: [m] }));
    expect(await api.chat("p1")).toEqual([m as never]);
  });
});

