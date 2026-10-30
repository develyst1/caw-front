// The one seam between caw-front's screens and the back end (SPEC-B-002 Decision 2): every screen reads and writes through
// `CawApi`. The shapes below are SPEC-A-008 § API v1 + § Shapes (REQ-010 contract v1.0 + v1.1) VERBATIM — field names and enums —
// hand-typed until `openapi.json` exists in `caw-back` (then `gen:api` and these come from it). Today the implementation is
// `mock.ts`; `http.ts` will implement the same interface, sending `X-CAW-Actor: operator` on every write; screens do not change.
// caw-front never touches a database.

import type { components } from "./schema";

export type Mode = "manual" | "dispatcher";
export type CardStatus = "todo" | "doing" | "review" | "done" | "stuck";
export type CardKind = "work" | "question";
export type WorkerRole = "PM" | "BA" | "SA" | "FE" | "BE" | "QA" | "other"; // v1.10: BA is new
export type Role = WorkerRole;
export type ModelName = "opus" | "sonnet" | "haiku";
export type Effort = "low" | "medium" | "high";
export type StopReason = "budget_spent" | "nothing_workable" | "failed_review_twice" | "limit_reached" | "operator_stopped" | "error" | "no_progress";
export type HopOutcome = "commented" | "handed_off" | "status" | "asked" | "failed" | "stopped" | "interrupted";

export interface Project {
  id: string;
  name: string;                  // Blueprint's project name at creation, for display
  blueprintProjectId: string;
  version: number;               // the LABEL number when the project started (0 = no label then) — REQ-105
  latestSeenVersion: number;     // the latest label number seen (0 = none)
  latestLabel: { version: number; label: string | null } | null; // REQ-105: the latest label's number and words (`label` null = a label with no name, Q6); null = none yet
  spec: { revision: number; reachable: boolean; lastPullAt: string | null }; // REQ-105: how up to date CAW's view of the spec is
  mode: Mode;
  hopBudget: number;
  hopsUsed: number;
  entryWorkerId: string | null;
  workspace: { roots: string[]; readOnly: string[] }; // v1.1: the folders the team may use; Revision 2 (D-100): `readOnly` ⊆ `roots` are the ones it may read but not write (generated: `components["schemas"]["Project"]["workspace"]`)
  codeMap: components["schemas"]["Project"]["codeMap"]; // Revision 1 A3 (REQ-015 R2): what the team learned about the code — a `CodeMap`, or null until a worker saves one
  createdAt: string;
}
/** The project's code map (SPEC-A-009 Revision 1 A3) — written by a worker, never by this app; the operator can only confirm it. From caw-back's OpenAPI. `rules` may be
 *  empty (the screen says `ไม่มี`). Saving again replaces the map and clears `confirmedAt`. */
export type CodeMap = components["schemas"]["CodeMap"];
/** `stuck` counts cards with status `stuck`, open question cards and cards with `specChangedVersion` set. */
export interface ProjectSummary extends Project { cardsDone: number; cardsTotal: number; stuckCount: number }

/** A worker's face (v1.12, REQ-014 R7): three short ids — each `^[a-z0-9-]{1,24}$`. The core checks the shape, not the list: the list of bodies, colours and
 *  eyes is caw-front's (`lib/faces.ts`), so a stored id the list no longer has is drawn as the face derived from the name. */
export interface Avatar { body: string; color: string; eyes: string }

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;               // deprecated (v1.10): `roles[0]` — read `roles`
  roles: WorkerRole[];            // v1.10: ≥ 1, no repeats, in the order picked
  skills: string[];
  model: ModelName;
  effort: Effort;
  combinedFrom: string[] | null;
  avatar: Avatar | null;          // v1.12: `null` = not chosen — the screen derives a face from the name, nothing derived is stored
  deletedAt: string | null;       // v1.14: set when the worker was deleted — `GET /v1/workers` still lists them; screens hide them from every picker
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
  anchor: { key: string; version: number }; // the Blueprint part it is about; `version` = the LABEL number when the card was cut (0 = no label then)
  anchorLabel: string | null;               // REQ-105: that label's words; null = none
  anchorRemoved: boolean;                   // REQ-105 D12: the part is no longer in the spec — the card is not workable and its context answers 404 `anchor_removed`
  specChangedVersion: number | null;        // set when that part changed in a newer version
  dependsOn: string[];            // card ids
  question: null | { text: string; proposedDefault: string; cases: string[] }; // for `kind: "question"`
  answer: string | null;
  workable: boolean;              // computed by the server: kind work · todo|doing · every dependency done · no spec change
  stoppedMidway: { hopId: string; at: string; reason: string } | null; // REQ-111: the last hop ended without finishing (failed, stopped or interrupted); the card is back in `todo`
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

/** Blueprint's v2 `PartContext` (SPEC-106 route 2), as caw-back returns it inside `CardContext.spec` — untouched. REQ-105: `revision`, `savedAt` and `latestLabel` replace `version`, `confirmedAt`. */
export interface PartContext {
  projectId: string;
  revision: number;
  savedAt: string | null;
  latestLabel: { version: number; label: string | null } | null;
  part: { key: string; kind: string; title: string; body: Record<string, unknown>; origin: { stamp: string; date: string; channel?: string; note?: string; sourceId?: string }; createdIn?: string };
  neighbours: { direction: "out" | "in"; linkKind: string; label: string | null; position: number | null; part: { key: string; kind: string; title: string } }[];
  decisions: PartContext["part"][];
  flows: { work: { key: string; title: string }; steps: { key: string; title: string; position: number | null }[]; at: string[] }[];
  questions: PartContext["part"][];
}

export interface CardContext {
  card: Card;
  spec: PartContext;
  specRead: { revision: number; readAt: string; fromCache: boolean; pinned: boolean }; // REQ-105: where `spec` came from; `fromCache` = Blueprint could not be reached
  notes: Note[];                  // oldest first
  decisions: { cardId: string; number: number; question: string; answer: string }[]; // answered question cards this card depends on
}

/** SPEC-109 § API, camelCase as caw-back sends it. `uncovered` is sorted by key; empty = every rule is covered. */
export interface Coverage { revision: number; uncovered: { key: string; kind: string; title: string; decisions: string[] }[] }

export interface Hop {
  id: string;
  projectId: string;
  runId: string | null;           // null = a manual hop
  messageId: string | null;       // v1.4: the chat message this hop answers (a chat hop); null for a card hop
  claimedBy: string | null;       // the runner instance
  cardId: string | null;          // null for a chat hop (it answers `messageId`, not a card)
  workerId: string;
  startedAt: string;
  endedAt: string | null;         // null while running
  lastActivityAt: string;         // v1.11, never null: `startedAt`, then moved by each runner heartbeat — `endedAt === null` and 10 min old = `เงียบไป`
  outcome: HopOutcome | null;
  tokensIn: number | null;
  tokensOut: number | null;
  note: string;
}

/** One line of what a hop's CLI showed (REQ-104, SPEC-103 § API): rendered and redacted by the runner. `seq` rises per hop but is not contiguous. */
export interface HopOutputEntry {
  seq: number;
  at: string;                     // ISO 8601, when the runner saw the line
  kind: "line" | "gap" | "truncated";
  text: string;                   // ≤ 2000 chars; "" for `gap` and `truncated`
  gapSeconds: number | null;      // ≥ 1 for `gap`, null otherwise
}

export interface HopOutput {
  hopId: string;
  entries: HopOutputEntry[];      // seq > `after`, ascending
  more: boolean;                  // more entries wait past `limit`
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
/** A refusal from the API, checked by its shape (a numeric `status` + a string `code`) and not only by class: a seeded mock (`/test-reset?state=…`)
 *  builds its errors in another module graph, where a class test is false (TASK-B-086 Q1 → B-087). */
export const isCawError = (e: unknown): e is CawError =>
  e instanceof Error && typeof (e as CawError).status === "number" && typeof (e as CawError).code === "string";

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
  anchor: { key: string; version?: number }; // REQ-105: `version` is optional and ignored by the back end
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
/** GET /v1/team-status (contract v1.16, SPEC-A-009 § 1b, Revision 1) — from caw-back's OpenAPI. `running` = the last check-in said `running` and is ≤ 45 s old. */
export type TeamStatus = components["schemas"]["TeamStatus"];

export interface CawEvent { seq: number; at: string; actor: string; projectId: string | null; type: string; data?: unknown }

export interface CawApi {
  projects(): Promise<ProjectSummary[]>;                                        // GET /v1/projects
  project(id: string): Promise<Project | null>;                                 // GET /v1/projects/{id} (a `Project`: the counts come with the list)
  /** PATCH /v1/projects/{id}/mode — never touches `hopsUsed`, cards or hops (REQ-011 AC-6). */
  setMode(id: string, mode: Mode, hopBudget?: number): Promise<Project | null>;
  /** PATCH /v1/projects/{id}/workspace — 0–20 absolute paths, no `..` segment, ≤ 500 chars each; else a 400. `readOnly` (Revision 2) must be a subset of `roots`, else a 400
   *  `validation`; left out it is `[]` — every folder writable — so a caller that does not know about read-only folders sends none and loses none it did not have. */
  setWorkspace(id: string, roots: string[], readOnly?: string[]): Promise<Project | null>;
  cards(projectId: string, query?: { assigneeId?: string; status?: CardStatus; workable?: boolean }): Promise<Card[]>; // GET …/cards
  card(cardId: string): Promise<Card | null>;                                   // GET /v1/cards/{cardId}
  cardContext(cardId: string): Promise<CardContext | null>;                     // GET /v1/cards/{cardId}/context
  /** GET /v1/projects/{id}/parts/{key} (v1.7) — a spec part by key, whether or not a card holds it; always the latest spec (REQ-105 D4). `null` when the
   *  project or the part is not there — and, over http, when Blueprint cannot be reached (the caller draws the key instead). */
  part(projectId: string, key: string): Promise<PartContext | null>;
  workers(): Promise<Worker[]>;                                                 // GET /v1/workers (global)
  chain(projectId: string): Promise<Chain | null>;                              // GET /v1/projects/{id}/chain
  hops(projectId: string, query?: { limit?: number; runId?: string }): Promise<Hop[]>;  // GET …/hops (newest first)
  runs(projectId: string, limit?: number): Promise<Run[]>;                      // GET …/runs (newest first)
  /** GET /v1/hops/{hopId}/output?after=&limit= (REQ-104) — a read, no actor. `after` = a seq (default -1 = from the start), `limit` 1..1000 (default 500). 404 `not_found`: no such hop. */
  hopOutput(hopId: string, query?: { after?: number; limit?: number }): Promise<HopOutput>;
  /** POST /v1/projects/{id}/runs — one open run per project: a second is refused with `CawError(409, "run_open")`. */
  startRun(projectId: string, hopBudget: number): Promise<Run>;
  /** PATCH /v1/runs/{runId} `{ stopReason: "operator_stopped", report: "" }` — the operator stops an open run (D-056, TASK-B-055); the
   *  mode is untouched. A run already over is refused `CawError(409, "already_finished")` — the screen takes that as done. */
  stopRun(runId: string): Promise<Run>;
  /** POST /v1/projects/{id}/hops — the operator starts one step of a card for a worker (`ทำต่อ` in แบบสั่งทีละขั้น, REQ-016 AC-4, D-105): the runner then claims the running hop.
   *  Refused: 404 (no such project, card or worker) · 409 `no_budget` · 409 `not_workable` (the card cannot be worked now) · 409 `hop_running` (a project has one running hop; `details: { hopId }`). */
  startHop(projectId: string, cardId: string, workerId: string): Promise<Hop>;

  // ---- the operator's other writes (SPEC-A-008 § API v1; every one carries `X-CAW-Actor: operator` in the http implementation) ----
  /** POST /v1/projects — 201, or 409 `already_exists` (`details.id` = the existing project — v1.15: for the same Blueprint project at ANY version), 404 `blueprint_project_not_found`, 502 `blueprint_unreachable`.
   *  REQ-105: `version` is optional and ignored by the back end; a project starts with no label too. */
  createProject(input: { blueprintProjectId: string; version?: number }): Promise<Project>;
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
  createWorker(input: { name: string; skills: string[]; model?: ModelName; effort?: Effort; avatar?: Avatar | null } & ({ roles: WorkerRole[] } | { role: WorkerRole })): Promise<Worker>;
  /** PATCH /v1/workers/{id} (v1.10) — sets only the fields sent (at least one, else 400 `validation`); changing `roles` leaves skills, model and effort alone.
   *  404 · 409 `name_taken`. */
  updateWorker(workerId: string, patch: { name?: string; roles?: WorkerRole[]; skills?: string[]; model?: ModelName; effort?: Effort; avatar?: Avatar | null }): Promise<Worker>;
  /** DELETE /v1/workers/{id} (v1.14) — operator only. 204; 404 for an unknown or already-deleted worker; 409 `worker_in_chain` `{ projectIds }` while any chain has
   *  them as a member. The worker stays in `workers()` with `deletedAt` set, and a new worker may take their name. */
  deleteWorker(workerId: string): Promise<void>;
  /** POST /v1/workers/combine — skills = union, model = the stronger, effort = the higher, role `other`, `combinedFrom` = both; the two stay. */
  combineWorkers(name: string, workerIds: [string, string]): Promise<Worker>;
  /** POST /v1/projects/{id}/chain/members — 409 `already_member`. */
  addMember(projectId: string, workerId: string): Promise<Chain>;
  /** DELETE /v1/projects/{id}/chain/members/{workerId} — the checks run in this order: 404 → 409 `hop_running` `{ hopId }` (they have a running hop, v1.14) →
   *  409 `is_entry` → 409 `has_open_cards` (no `reassignTo`). */
  removeMember(projectId: string, workerId: string, reassignTo?: string): Promise<Chain>;
  /** POST /v1/projects/{id}/chain/edges — 400 (not members / self), 409 `edge_exists`. */
  addEdge(projectId: string, from: string, to: string): Promise<Chain>;
  /** DELETE /v1/projects/{id}/chain/edges — 404 when the edge is not there. */
  removeEdge(projectId: string, from: string, to: string): Promise<Chain>;
  /** PUT /v1/projects/{id}/chain/entry — 400 when the worker is not a member. */
  setEntry(projectId: string, workerId: string): Promise<Chain>;


  /** GET /v1/projects/{id}/events?after=&limit= — oldest first; `after` = a seq (default 0), `limit` ≤ 500. An unknown project has no events. */
  events(projectId: string, query?: { after?: number; limit?: number }): Promise<CawEvent[]>;

  /** POST /v1/projects/{id}/code-map/confirm (operator only) — 200 the code map with `confirmedAt` set. Refused: 404 `not_found` (no such project) · 409 `no_code_map`
   *  (no worker has saved one yet). The screen never writes a map; a worker does. */
  confirmCodeMap(projectId: string): Promise<CodeMap>;

  /** GET /v1/projects/{projectId}/coverage[?proposalId=] (REQ-112, SPEC-109 § API) — the decisions no card (and, with `proposalId`, no item of that proposal) covers, grouped under
   *  the part they are about. Advisory only: it never blocks anything. A refusal (404 `not_found`, 502 `blueprint_unreachable`) is a CawError; the screens draw nothing then. */
  coverage(projectId: string, proposalId?: string): Promise<Coverage>;

  /** GET /v1/team-status — a read, no actor, not tied to a project: is the team (the runner) checking in right now? `running` = the last check-in was `running` and is ≤ 45 s old. */
  teamStatus(): Promise<TeamStatus>;

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
