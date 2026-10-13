// The http implementation against a fake `fetch` — what it sends (route, query, body, the actor header on writes only) and how it
// reads a refusal. Against the real caw-back it is checked by hand (TASK-B-040 DoD 3), because that needs the back end running.
import { describe, expect, test } from "bun:test";
import { CawError } from "./caw";
import { createHttpApi } from "./http";

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

  test("the chat is not in the contract: 501 not_implemented, said out loud", async () => {
    const { api } = against(() => json(200, {}));
    const e = (await api.chat("p1").then(() => null, (x: unknown) => x)) as CawError;
    expect([e.status, e.code]).toEqual([501, "not_implemented"]);
  });
});
