// `CawApi` over caw-back's HTTP API (SPEC-A-008 § API v1), through the client generated from its OpenAPI (`bun run gen:api` →
// `schema.d.ts`) — so a route, a body or a status the back end changes shows up here as a type error. Every write carries
// `X-CAW-Actor: operator` (the operator is the only actor this app has). Base URL: `CAW_API_URL`, default `http://127.0.0.1:4500`.
// A refusal (`{ error: { code, message, details? } }`) becomes a `CawError`; a back end that cannot be reached becomes
// `CawError(0, "unreachable")`. A 404 on a read of one thing is `null` (or an empty list), not an error.
import createClient from "openapi-fetch";
import {
  CawError, type Card, type CardContext, type CawApi, type Chain, type ChatMessage, type Hop, type Note, type PartContext, type Project,
  type ProjectSummary, type Run, type Worker,
} from "./caw";
import type { paths } from "./schema";

type Settled<T> = { data?: T; error?: unknown; response: Response };

/** What `fetch` is to this client: a request in, a response out (a test passes its own). */
type Fetcher = (req: Request) => Promise<Response>;

export function createHttpApi(opts: { baseUrl?: string; fetch?: Fetcher } = {}): CawApi {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl ?? process.env.CAW_API_URL ?? "http://127.0.0.1:4500",
    // not `globalThis.fetch` captured now: Next patches it per request, and a test passes its own
    fetch: (req) => (opts.fetch ?? ((r) => globalThis.fetch(r)))(req),
  });
  client.use({
    onRequest({ request }) {
      if (request.method !== "GET") request.headers.set("X-CAW-Actor", "operator");
      return request;
    },
  });

  /** The settled call, or a `CawError` — one place that reads the back end's error body. */
  const call = async <T>(p: Promise<Settled<T>>): Promise<Settled<T>> => {
    try { return await p; }
    catch (e) { throw new CawError(0, "unreachable", e instanceof Error ? e.message : "caw-back cannot be reached"); }
  };
  const refusal = (r: Settled<unknown>): never => {
    const body = (r.error as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
    throw new CawError(r.response.status, body?.code ?? "error", body?.message ?? r.response.statusText, body?.details);
  };
  const ok = async <T>(p: Promise<Settled<T>>): Promise<T> => { const r = await call(p); return r.data !== undefined ? r.data : refusal(r); };
  const orNull = async <T>(p: Promise<Settled<T>>): Promise<T | null> => {
    const r = await call(p);
    if (r.response.status === 404) return null;
    return r.data !== undefined ? r.data : refusal(r);
  };
  const orEmpty = async <T>(p: Promise<Settled<{ [k: string]: T[] }>>, key: string): Promise<T[]> => {
    const r = await call(p);
    if (r.response.status === 404) return [];
    return r.data !== undefined ? r.data[key]! : refusal(r);
  };
  const notYet = (what: string): never => { throw new CawError(501, "not_implemented", `${what} is not in caw-back's contract yet (REQ-013)`); };

  return {
    projects: async () => (await ok(client.GET("/v1/projects"))).projects as ProjectSummary[],
    project: (id) => orNull(client.GET("/v1/projects/{id}", { params: { path: { id } } })) as Promise<Project | null>,
    setMode: (id, mode, hopBudget) => orNull(client.PATCH("/v1/projects/{id}/mode", { params: { path: { id } }, body: { mode, hopBudget } })) as Promise<Project | null>,
    setWorkspace: (id, roots) => orNull(client.PATCH("/v1/projects/{id}/workspace", { params: { path: { id } }, body: { roots } })) as Promise<Project | null>,
    // the back end takes `workable` as the words "true" / "false" (the generated type says so)
    cards: (id, q = {}) => orEmpty<Card>(client.GET("/v1/projects/{id}/cards", { params: { path: { id }, query: { ...q, workable: q.workable === undefined ? undefined : q.workable ? "true" : "false" } } }) as Promise<Settled<{ cards: Card[] }>>, "cards"),
    card: (cardId) => orNull(client.GET("/v1/cards/{cardId}", { params: { path: { cardId } } })) as Promise<Card | null>,
    cardContext: async (cardId) => {
      const c = await orNull(client.GET("/v1/cards/{cardId}/context", { params: { path: { cardId } } }));
      return c ? ({ ...c, spec: c.spec as PartContext } as CardContext) : null;
    },
    workers: async () => (await ok(client.GET("/v1/workers"))).workers as Worker[],
    chain: (id) => orNull(client.GET("/v1/projects/{id}/chain", { params: { path: { id } } })) as Promise<Chain | null>,
    hops: (id, q = {}) => orEmpty<Hop>(client.GET("/v1/projects/{id}/hops", { params: { path: { id }, query: q } }) as Promise<Settled<{ hops: Hop[] }>>, "hops"),
    runs: (id, limit) => orEmpty<Run>(client.GET("/v1/projects/{id}/runs", { params: { path: { id }, query: { limit } } }) as Promise<Settled<{ runs: Run[] }>>, "runs"),
    startRun: (id, hopBudget) => ok(client.POST("/v1/projects/{id}/runs", { params: { path: { id } }, body: { hopBudget } })) as Promise<Run>,

    createProject: (body) => ok(client.POST("/v1/projects", { body })) as Promise<Project>,
    comment: (cardId, text) => ok(client.POST("/v1/cards/{cardId}/comments", { params: { path: { cardId } }, body: { text } })) as Promise<Note>,
    setStatus: (cardId, status) => ok(client.PATCH("/v1/cards/{cardId}/status", { params: { path: { cardId } }, body: { status } })) as Promise<Card>,
    assign: (cardId, workerId) => ok(client.PATCH("/v1/cards/{cardId}/assignee", { params: { path: { cardId } }, body: { workerId } })) as Promise<Card>,
    handoff: (cardId, toWorkerId, text) => ok(client.POST("/v1/cards/{cardId}/handoff", { params: { path: { cardId } }, body: { toWorkerId, text } })) as Promise<Card>,
    answer: (cardId, answer) => ok(client.POST("/v1/cards/{cardId}/answer", { params: { path: { cardId } }, body: { answer } })) as Promise<Card>,
    clearSpecChange: (cardId) => ok(client.POST("/v1/cards/{cardId}/spec-change/clear", { params: { path: { cardId } } })) as Promise<Card>,
    createWorker: (body) => ok(client.POST("/v1/workers", { body })) as Promise<Worker>,
    combineWorkers: (name, workerIds) => ok(client.POST("/v1/workers/combine", { body: { name, workerIds } })) as Promise<Worker>,
    addMember: (id, workerId) => ok(client.POST("/v1/projects/{id}/chain/members", { params: { path: { id } }, body: { workerId } })) as Promise<Chain>,
    removeMember: (id, workerId, reassignTo) => ok(client.DELETE("/v1/projects/{id}/chain/members/{workerId}", { params: { path: { id, workerId }, query: { reassignTo } } })) as Promise<Chain>,
    addEdge: (id, from, to) => ok(client.POST("/v1/projects/{id}/chain/edges", { params: { path: { id } }, body: { from, to } })) as Promise<Chain>,
    removeEdge: (id, from, to) => ok(client.DELETE("/v1/projects/{id}/chain/edges", { params: { path: { id } }, body: { from, to } })) as Promise<Chain>,
    setEntry: (id, workerId) => ok(client.PUT("/v1/projects/{id}/chain/entry", { params: { path: { id } }, body: { workerId } })) as Promise<Chain>,

    chat: async (): Promise<ChatMessage[]> => notYet("the chat"),
    sendChat: async (): Promise<ChatMessage[]> => notYet("the chat"),
  };
}
