// The one seam between caw-front's screens and the back end (SPEC-B-002 Decision 2): every screen reads and writes through
// `CawApi`. The shapes below are SPEC-A-008 § API v1 + § Shapes (REQ-010 contract v1.0 + v1.1) VERBATIM — field names and enums —
// hand-typed until `openapi.json` exists in `caw-back` (then `gen:api` and these come from it). Today the implementation is
// `mock.ts`; `http.ts` will implement the same interface, sending `X-CAW-Actor: operator` on every write; screens do not change.
// caw-front never touches a database.

export type Mode = "manual" | "dispatcher";
export type CardStatus = "todo" | "doing" | "review" | "done" | "stuck";
export type CardKind = "work" | "question";
export type WorkerRole = "PM" | "BA" | "SA" | "FE" | "BE" | "QA" | "other"; // v1.10: BA is new
export type Role = WorkerRole;
export type ModelName = "opus" | "sonnet" | "haiku";
export type Effort = "low" | "medium" | "high";
export type StopReason = "budget_spent" | "nothing_workable" | "failed_review_twice" | "limit_reached" | "operator_stopped" | "error";
export type HopOutcome = "commented" | "handed_off" | "status" | "asked" | "failed" | "stopped" | "interrupted";

export interface Project {
  id: string;
  name: string;                  // Blueprint's project name at creation, for display
  blueprintProjectId: string;
  version: number;               // the confirmed Blueprint version it was made from
  latestSeenVersion: number;
  mode: Mode;
  hopBudget: number;
  hopsUsed: number;
  entryWorkerId: string | null;
  workspace: { roots: string[] }; // v1.1: the folders the team may write in
  createdAt: string;
}
/** `stuck` counts cards with status `stuck`, open question cards and cards with `specChangedVersion` set. */
export interface ProjectSummary extends Project { cardsDone: number; cardsTotal: number; stuckCount: number }

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;               // deprecated (v1.10): `roles[0]` — read `roles`
  roles: WorkerRole[];            // v1.10: ≥ 1, no repeats, in the order picked
  skills: string[];
  model: ModelName;
  effort: Effort;
  combinedFrom: string[] | null;
}

export interface Chain { members: Worker[]; edges: { from: string; to: string }[]; entryWorkerId: string | null }

export interface Card {
  id: string;
  projectId: string;
  number: number;                 // per project, from 1
  kind: CardKind;
  title: string;
  todo: string;                   // what to do
  status: CardStatus;
  assigneeId: string | null;      // a question card's assignee is null = the operator
  anchor: { key: string; version: number }; // the Blueprint part it is about, at the version it was cut from
  specChangedVersion: number | null;        // set when that part changed in a newer version
  dependsOn: string[];            // card ids
  question: null | { text: string; proposedDefault: string; cases: string[] }; // for `kind: "question"`
  answer: string | null;
  workable: boolean;              // computed by the server: kind work · todo|doing · every dependency done · no spec change
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  type: "comment" | "handoff" | "handoff_refused"; // v1.3: a hand-off the chain refused (409 chain_broken) is recorded too
  actor: string;                  // "operator" or "worker:<id>"
  text: string;
  fromWorkerId: string | null;    // handoff / handoff_refused only
  toWorkerId: string | null;
  allowed: string[] | null;       // v1.3: handoff_refused only — whom the chain does allow from `fromWorkerId`; null for every other type
  at: string;
}

/** Blueprint's `PartContext`, as caw-back returns it inside `CardContext.spec` — untouched (copied from blueprint-back's OpenAPI). */
export interface PartContext {
  projectId: string;
  version: number;
  confirmedAt: string;
  part: { key: string; kind: string; title: string; body: Record<string, unknown>; origin: { stamp: string; date: string; channel?: string; note?: string; sourceId?: string }; createdIn?: string };
  neighbours: { direction: "out" | "in"; linkKind: string; label: string | null; position: number | null; part: { key: string; kind: string; title: string } }[];
  decisions: PartContext["part"][];
  flows: { work: { key: string; title: string }; steps: { key: string; title: string; position: number | null }[]; at: string[] }[];
  questions: PartContext["part"][];
}

export interface CardContext {
  card: Card;
  spec: PartContext;
  notes: Note[];                  // oldest first
  decisions: { cardId: string; number: number; question: string; answer: string }[]; // answered question cards this card depends on
}

export interface Hop {
  id: string;
  projectId: string;
  runId: string | null;           // null = a manual hop
  claimedBy: string | null;       // the runner instance
  cardId: string;
  workerId: string;
  startedAt: string;
  endedAt: string | null;         // null while running
  lastActivityAt: string;         // v1.11, never null: `startedAt`, then moved by each runner heartbeat — `endedAt === null` and 10 min old = `เงียบไป`
  outcome: HopOutcome | null;
  tokensIn: number | null;
  tokensOut: number | null;
  note: string;
}

export interface Run {
  id: string;
  projectId: string;
  mode: Mode;                     // at start
  hopBudget: number;              // the hops this run may use
  startedAt: string;
  endedAt: string | null;         // null while the run is open
  stopReason: StopReason | null;
  report: string | null;
  hopsUsed: number;               // its finished hops, computed on read
}

/** A back-end refusal: `{ error: { code, message, details? } }` with its HTTP status (e.g. 409 `run_open`). */
export class CawError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) { super(message); }
}

// ---- the chat and the card proposals (SPEC-A-008 § v1.4, REQ-013) — shapes verbatim; hand-typed until caw-back's openapi.json has them ----

/** One question a worker asks the operator in a reply, with the answer it would give and the cases it sees. */
export interface ChatQuestion { text: string; proposedDefault: string; cases: string[] }

export interface ChatMessage {
  id: string;
  projectId: string;
  author: "operator" | `worker:${string}`;
  text: string;                    // 1-4 000 characters
  replyTo: string | null;          // the message a worker's reply answers
  replyHopId: string | null;       // on the operator's message: the hop that answered it
  questions: ChatQuestion[] | null;
  proposalId: string | null;       // the card proposal this reply made
  amendment: { blueprintMessageId: string; link: string } | null; // an amendment sent to Blueprint's chat
  chatHop: { id: string; endedAt: string | null; outcome: HopOutcome | null } | null; // v1.9: the newest hop on this message — computed on read, never stored
  retryRequestedAt: string | null; // v1.9: set by `retryChat`; cleared when the runner starts the next hop on this message
  at: string;
}

/** One card a proposal would make. `dependsOn` are indexes into the proposal's `items`, not card ids (there are no cards yet). */
export interface ProposalItem {
  title: string;
  todo: string;
  anchor: { key: string; version: number };
  workerId: string;
  dependsOn: number[];
  hops: number;                    // ≥ 1: what the item is expected to cost
}

export type ProposalStatus = "open" | "accepted" | "superseded";

export interface Proposal {
  id: string;
  projectId: string;
  messageId: string;               // the operator message it answers
  version: number;                 // the confirmed Blueprint version its anchors refer to
  items: ProposalItem[];           // 1-50
  status: ProposalStatus;
  cardIds: string[] | null;        // set when accepted
  createdAt: string;
  hopsTotal: number;               // computed on read: the sum of the items' hops — never stored
}

/** One line of the project's event log (SPEC-A-008 § Event types): every write is one event. `data` is the write's input — the screens only look at `seq`, `at`, `actor`
 *  and `type` (what changed, when, by whom). */
export interface CawEvent { seq: number; at: string; actor: string; projectId: string | null; type: string; data?: unknown }

export interface CawApi {
  projects(): Promise<ProjectSummary[]>;                                        // GET /v1/projects
  project(id: string): Promise<Project | null>;                                 // GET /v1/projects/{id} (a `Project`: the counts come with the list)
  /** PATCH /v1/projects/{id}/mode — never touches `hopsUsed`, cards or hops (REQ-011 AC-6). */
  setMode(id: string, mode: Mode, hopBudget?: number): Promise<Project | null>;
  /** PATCH /v1/projects/{id}/workspace — 0–20 absolute paths, no `..` segment, ≤ 500 chars each; else a 400. */
  setWorkspace(id: string, roots: string[]): Promise<Project | null>;
  cards(projectId: string, query?: { assigneeId?: string; status?: CardStatus; workable?: boolean }): Promise<Card[]>; // GET …/cards
  card(cardId: string): Promise<Card | null>;                                   // GET /v1/cards/{cardId}
  cardContext(cardId: string): Promise<CardContext | null>;                     // GET /v1/cards/{cardId}/context
  /** GET /v1/projects/{id}/parts/{key}?version= (v1.7) — a spec part by key, whether or not a card holds it. `version` defaults to the project's
   *  `latestSeenVersion`; 400 on a version that is not an integer ≥ 1. `null` when the project or the part is not there — and, over http, when
   *  Blueprint cannot be reached (the caller draws the key instead). */
  part(projectId: string, key: string, version?: number): Promise<PartContext | null>;
  workers(): Promise<Worker[]>;                                                 // GET /v1/workers (global)
  chain(projectId: string): Promise<Chain | null>;                              // GET /v1/projects/{id}/chain
  hops(projectId: string, query?: { limit?: number; runId?: string }): Promise<Hop[]>;  // GET …/hops (newest first)
  runs(projectId: string, limit?: number): Promise<Run[]>;                      // GET …/runs (newest first)
  /** POST /v1/projects/{id}/runs — one open run per project: a second is refused with `CawError(409, "run_open")`. */
  startRun(projectId: string, hopBudget: number): Promise<Run>;
  /** PATCH /v1/runs/{runId} `{ stopReason: "operator_stopped", report: "" }` — the operator stops an open run (D-056, TASK-B-055); the
   *  mode is untouched. A run already over is refused `CawError(409, "already_finished")` — the screen takes that as done. */
  stopRun(runId: string): Promise<Run>;

  // ---- the operator's other writes (SPEC-A-008 § API v1; every one carries `X-CAW-Actor: operator` in the http implementation) ----
  /** POST /v1/projects — 201, or 409 `already_exists` (`details.id` = the existing project), 404 `blueprint_project_not_found`, 409 `version_not_confirmed`, 502 `blueprint_unreachable`. */
  createProject(input: { blueprintProjectId: string; version: number }): Promise<Project>;
  /** POST /v1/cards/{id}/comments */
  comment(cardId: string, text: string): Promise<Note>;
  /** PATCH /v1/cards/{id}/status — 409 `waiting_on_question` (to `doing` while a dependency is open). */
  setStatus(cardId: string, status: CardStatus): Promise<Card>;
  /** PATCH /v1/cards/{id}/assignee — the operator's authority ignores the chain; 400 `not_a_member`. */
  assign(cardId: string, workerId: string): Promise<Card>;
  /** POST /v1/cards/{id}/handoff — must follow a chain edge: else 409 `chain_broken` with `details { from, allowed }`. */
  handoff(cardId: string, toWorkerId: string, text: string): Promise<Card>;
  /** POST /v1/cards/{id}/answer — 400 `not_a_question`, 409 `already_answered`; the card becomes `done` and frees its dependants. */
  answer(cardId: string, answer: string): Promise<Card>;
  /** POST /v1/cards/{id}/spec-change/clear */
  clearSpecChange(cardId: string): Promise<Card>;
  /** POST /v1/workers — 409 `name_taken`. v1.10: `roles` (≥ 1, distinct) or the old single `role` (read as `[role]`) — both or neither is a 400
   *  `validation`. `model` / `effort` default to the strongest of the picked roles'. `skills` is the client's list (see `lib/roles.ts`). */
  createWorker(input: { name: string; skills: string[]; model?: ModelName; effort?: Effort } & ({ roles: WorkerRole[] } | { role: WorkerRole })): Promise<Worker>;
  /** PATCH /v1/workers/{id} (v1.10) — sets only the fields sent (at least one, else 400 `validation`); changing `roles` leaves skills, model and effort alone.
   *  404 · 409 `name_taken`. */
  updateWorker(workerId: string, patch: { name?: string; roles?: WorkerRole[]; skills?: string[]; model?: ModelName; effort?: Effort }): Promise<Worker>;
  /** POST /v1/workers/combine — skills = union, model = the stronger, effort = the higher, role `other`, `combinedFrom` = both; the two stay. */
  combineWorkers(name: string, workerIds: [string, string]): Promise<Worker>;
  /** POST /v1/projects/{id}/chain/members — 409 `already_member`. */
  addMember(projectId: string, workerId: string): Promise<Chain>;
  /** DELETE /v1/projects/{id}/chain/members/{workerId} — 409 `has_open_cards` (no `reassignTo`), 409 `is_entry`. */
  removeMember(projectId: string, workerId: string, reassignTo?: string): Promise<Chain>;
  /** POST /v1/projects/{id}/chain/edges — 400 (not members / self), 409 `edge_exists`. */
  addEdge(projectId: string, from: string, to: string): Promise<Chain>;
  /** DELETE /v1/projects/{id}/chain/edges — 404 when the edge is not there. */
  removeEdge(projectId: string, from: string, to: string): Promise<Chain>;
  /** PUT /v1/projects/{id}/chain/entry — 400 when the worker is not a member. */
  setEntry(projectId: string, workerId: string): Promise<Chain>;


  /** GET /v1/projects/{id}/events?after=&limit= — oldest first; `after` = a seq (default 0), `limit` ≤ 500. An unknown project has no events. */
  events(projectId: string, query?: { after?: number; limit?: number }): Promise<CawEvent[]>;

  // ---- the chat with the entry worker, and the cards it proposes (REQ-013) ----
  /** GET /v1/projects/{id}/chat — oldest first; `after` = a message id, `limit` ≤ 200. An unknown project has no messages. */
  chat(projectId: string, query?: { after?: string; limit?: number }): Promise<ChatMessage[]>;
  /** POST /v1/projects/{id}/chat — the operator's message (1-4 000 characters). The worker's answer is the runner's, not ours. */
  postChat(projectId: string, text: string): Promise<ChatMessage>;
  /** GET /v1/projects/{id}/proposals — newest first, optionally those made on one message. */
  proposals(projectId: string, query?: { messageId?: string }): Promise<Proposal[]>;
  /** POST /v1/proposals/{id}/accept — makes the cards in one go and returns them: 409 `not_open` (already accepted, or superseded),
   *  422 `anchor_not_in_version` (a part is gone from Blueprint; nothing is written). */
  acceptProposal(proposalId: string): Promise<Card[]>;
  /** POST /v1/chat/{messageId}/retry (v1.9, D-057) — 202: ask the runner to try the operator's message again. A second retry before the runner
   *  picks it up only moves `retryRequestedAt`. Refused: 404 · 400 `not_operator_message` · 409 `already_answered` · 409 `hop_running`. */
  retryChat(messageId: string): Promise<void>;
}
