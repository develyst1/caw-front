// The one seam between caw-front's screens and the back end (SPEC-B-002 Decision 2): every screen reads and writes through
// `CawApi`. The shapes below are SPEC-A-008 § API v1 + § Shapes (REQ-010 contract v1.0 + v1.1) VERBATIM — field names and enums —
// hand-typed until `openapi.json` exists in `caw-back` (then `gen:api` and these come from it). Today the implementation is
// `mock.ts`; `http.ts` will implement the same interface, sending `X-CAW-Actor: operator` on every write; screens do not change.
// caw-front never touches a database.

export type Mode = "manual" | "dispatcher";
export type CardStatus = "todo" | "doing" | "review" | "done" | "stuck";
export type CardKind = "work" | "question";
export type WorkerRole = "PM" | "SA" | "FE" | "BE" | "QA" | "other";
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
  role: WorkerRole;
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
  type: "comment" | "handoff";
  actor: string;                  // "operator" or "worker:<id>"
  text: string;
  fromWorkerId: string | null;    // handoff only
  toWorkerId: string | null;
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

export interface ChatMessage { id: string; at: string; from: "operator" | "worker"; text: string } // TODO REQ-013 (not in the REQ-010 contract)

export interface CawApi {
  projects(): Promise<ProjectSummary[]>;                                        // GET /v1/projects
  project(id: string): Promise<ProjectSummary | null>;                          // GET /v1/projects/{id}
  /** PATCH /v1/projects/{id}/mode — never touches `hopsUsed`, cards or hops (REQ-011 AC-6). */
  setMode(id: string, mode: Mode, hopBudget?: number): Promise<ProjectSummary | null>;
  /** PATCH /v1/projects/{id}/workspace — 0–20 absolute paths, no `..` segment, ≤ 500 chars each; else a 400. */
  setWorkspace(id: string, roots: string[]): Promise<ProjectSummary | null>;
  cards(projectId: string, query?: { assigneeId?: string; status?: CardStatus; workable?: boolean }): Promise<Card[]>; // GET …/cards
  card(cardId: string): Promise<Card | null>;                                   // GET /v1/cards/{cardId}
  cardContext(cardId: string): Promise<CardContext | null>;                     // GET /v1/cards/{cardId}/context
  workers(): Promise<Worker[]>;                                                 // GET /v1/workers (global)
  chain(projectId: string): Promise<Chain | null>;                              // GET /v1/projects/{id}/chain
  hops(projectId: string, query?: { limit?: number; runId?: string }): Promise<Hop[]>;  // GET …/hops (newest first)
  runs(projectId: string, limit?: number): Promise<Run[]>;                      // GET …/runs (newest first)
  /** POST /v1/projects/{id}/runs — one open run per project: a second is refused with `CawError(409, "run_open")`. */
  startRun(projectId: string, hopBudget: number): Promise<Run>;
  chat(projectId: string): Promise<ChatMessage[]>;
  sendChat(projectId: string, text: string): Promise<ChatMessage[]>;
}
