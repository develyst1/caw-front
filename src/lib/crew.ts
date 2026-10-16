// Who is doing what, at a glance (REQ-014 R4): one seat per chain member — the entry worker first, then the chain's own order — and what that
// seat is up to. Pure: the screen reads the chain, the cards and the hops and hands them here.
import type { Card, CawApi, Chain, ChatMessage, Hop, Worker } from "@/api/caw";

/** `answeringChat`: the running hop is on a chat message, not on a card (D-066 / TASK-B-073 C7) — busy like `working`, with no card to name. */
export type SeatState = "working" | "answeringChat" | "stuck" | "waitingOnYou" | "idleWithWork" | "free";
/** `n` is set for `idleWithWork` only: how many cards of theirs are in `doing` (D-066 C3). */
export interface Seat { worker: Worker; state: SeatState; card: Card | null; n?: number }

/** Does the entry worker wait for the operator in the chat (C3)? Its newest chat reply carries questions and no operator message came after it. */
export function entryAsked(chain: Chain, chat: ChatMessage[]): boolean {
  if (!chain.entryWorkerId) return false;
  const mine: ChatMessage["author"] = `worker:${chain.entryWorkerId}`;
  const at = chat.map((m) => m.author).lastIndexOf(mine);
  if (at < 0) return false;
  const reply = chat[at]!;
  return (reply.questions?.length ?? 0) > 0 && !chat.slice(at + 1).some((m) => m.author === "operator");
}

/** Priority: a running hop → `working` (its card), or `answeringChat` when the hop is on a chat message; else a stuck card of theirs → `stuck`; else an open
 *  question waiting for the operator (one assigned to them, or one a card of theirs depends on — or, for the entry worker, questions it asked in the chat
 *  that nobody has answered: pass `chat`, oldest first) → `waitingOnYou`; else cards of theirs in `doing` with nobody running them → `idleWithWork`
 *  (D-066: with the count); else `free`. With several cards the lowest number is shown. */
export function crewState(chain: Chain, cards: Card[], hops: Hop[], chat: ChatMessage[] = []): Seat[] {
  const chatAsked = entryAsked(chain, chat);
  const byNumber = [...cards].sort((a, b) => a.number - b.number);
  const openQuestion = (c: Card) => c.kind === "question" && c.answer === null;
  const members = [...chain.members].sort((a, b) => Number(b.id === chain.entryWorkerId) - Number(a.id === chain.entryWorkerId)); // stable: entry first, the rest as listed
  return members.map((worker) => {
    const running = hops.find((h) => h.workerId === worker.id && h.endedAt === null);
    if (running?.messageId) return { worker, state: "answeringChat", card: null };
    if (running) return { worker, state: "working", card: cards.find((c) => c.id === running.cardId) ?? null };
    const mine = byNumber.filter((c) => c.assigneeId === worker.id);
    const stuck = mine.find((c) => c.status === "stuck");
    if (stuck) return { worker, state: "stuck", card: stuck };
    const waiting = byNumber.find((c) => openQuestion(c) && (c.assigneeId === worker.id || mine.some((m) => m.status !== "done" && m.dependsOn.includes(c.id))));
    if (waiting || (chatAsked && worker.id === chain.entryWorkerId)) return { worker, state: "waitingOnYou", card: waiting ?? null };
    const doing = mine.filter((c) => c.status === "doing");
    if (doing.length > 0) return { worker, state: "idleWithWork", card: doing[0]!, n: doing.length };
    return { worker, state: "free", card: null };
  });
}

/** What the home shows for a project: who is working (the first seat that is working or answering the chat, else null), how many CARDS are stuck, how many
 *  ITEMS wait on you (D-066 C4; C2: `stuck` is the board's stuck column — cards in status `stuck` — not the core's stuckCount, which also counts open questions and
 *  spec changes; A2: `waitingOnYou` = the open question cards, assigned or not, plus the entry worker's unanswered chat question as one more — items, not seats:
 *  the seats' own states keep their priority). */
export interface CrewSummary { working: string | null; stuck: number; waitingOnYou: number }

export function crewSummary(seats: Seat[], cards: Card[], chatAsked = false): CrewSummary {
  return {
    working: seats.find((s) => s.state === "working" || s.state === "answeringChat")?.worker.name ?? null,
    stuck: cards.filter((c) => c.status === "stuck").length,
    waitingOnYou: cards.filter((c) => c.kind === "question" && c.answer === null).length + (chatAsked ? 1 : 0),
  };
}

const CHAT_PAGE = 200;
/** The whole thread, oldest first, a page (200, the most the route gives) at a time — one read for any thread under 200 messages. */
async function allChat(api: CawApi, projectId: string): Promise<ChatMessage[]> {
  const all: ChatMessage[] = [];
  for (;;) {
    const page = await api.chat(projectId, { after: all.at(-1)?.id, limit: CHAT_PAGE });
    all.push(...page);
    if (page.length < CHAT_PAGE) return all;
  }
}

/** The summaries for the home, by project id. **Four reads per project**: its chain, its cards, its newest hop — a project has one running hop at a time, so if
 *  there is a running hop it is the newest one (`hops(id, { limit: 1 })`, newest first) — and its chat (C3: a question the entry worker asked; one page of 200,
 *  more pages only for a longer thread). The projects are read in parallel. A project the back end no longer has (no chain) reads as an empty crew. */
export async function homeSummaries(api: CawApi, projects: { id: string }[]): Promise<Record<string, CrewSummary>> {
  const entries = await Promise.all(projects.map(async ({ id }) => {
    const [chain, cards, hops, chat] = await Promise.all([api.chain(id), api.cards(id), api.hops(id, { limit: 1 }), allChat(api, id)]);
    return [id, crewSummary(chain ? crewState(chain, cards, hops, chat) : [], cards, chain ? entryAsked(chain, chat) : false)] as const;
  }));
  return Object.fromEntries(entries);
}

/** A working seat that has been quiet this many minutes reads `เงียบไป {n} นาที` (D-064). */
export const STALE_MINUTES = 10;

/** Whole minutes (rounded down, never negative) since the running hop last showed life — `now − Hop.lastActivityAt` (contract v1.11: the runner's heartbeat
 *  moves it; the core stamps the time). `null` for a hop that has ended: there is nothing to be quiet about. The screen shows `เงียบไป {n} นาที` from
 *  `STALE_MINUTES`. */
export function quietMinutes(hop: Hop, now: Date): number | null {
  if (hop.endedAt !== null) return null;
  return Math.max(0, Math.floor((now.getTime() - Date.parse(hop.lastActivityAt)) / 60_000));
}
