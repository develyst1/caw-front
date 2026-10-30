// Who is doing what, at a glance (REQ-014 R4): one seat per chain member — the entry worker first, then the chain's own order — and what that
// seat is up to. Pure: the screen reads the chain, the cards and the hops and hands them here.
import type { Card, CawApi, Chain, ChatMessage, ChatQuestion, Hop, Mode, Proposal, Worker } from "@/api/caw";
import { oneAnswer } from "@/words";

/** `answeringChat`: the running hop is on a chat message, not on a card (D-066 / TASK-B-073 C7) — busy like `working`, with no card to name. */
export type SeatState = "working" | "answeringChat" | "stuck" | "waitingOnYou" | "idleWithWork" | "free";
/** `n` is set for `idleWithWork` only: how many cards of theirs are in `doing` (D-066 C3). */
export interface Seat { worker: Worker; state: SeatState; card: Card | null; n?: number }

/** Does the entry worker wait for the operator in the chat (C3)? Its newest chat reply carries questions and no operator message came after it. */
export function entryAsked(chain: Chain, chat: ChatMessage[]): boolean {
  return entryQuestions(chain, chat) !== null;
}

/** The questions the entry worker asked in its newest reply, while no operator message came after it — the board's "waits on you" sheet shows them
 *  (TASK-B-087 § 2); null when there are none. Same rule as `entryAsked`. */
export function entryQuestions(chain: Chain, chat: ChatMessage[]): { message: ChatMessage; questions: NonNullable<ChatMessage["questions"]> } | null {
  if (!chain.entryWorkerId) return null;
  const mine: ChatMessage["author"] = `worker:${chain.entryWorkerId}`;
  const at = chat.map((m) => m.author).lastIndexOf(mine);
  if (at < 0) return null;
  const reply = chat[at]!;
  if (!reply.questions?.length || chat.slice(at + 1).some((m) => m.author === "operator")) return null;
  return { message: reply, questions: reply.questions };
}

/** The ONE message the operator's answers make (REQ-126 D1): `ข้อ {n}: {answer}` per question, n from 1 in question order, one per line. `from` is the number
 *  of the first answer (the board's single question posts its own number). */
export const acceptText = (answers: string[], from = 1) => answers.map((a, i) => oneAnswer.line(from + i, a)).join("\n");

const ANSWER_LINE = /^ข้อ (\d+): ?/;
/** The answers a message carries as `ข้อ {n}: …` lines, by n. An answer typed on several lines keeps them: a line that does not start a new `ข้อ {n}:` belongs to the one before. */
function answerLines(text: string): Map<number, string> {
  const found = new Map<number, string>();
  let at: number | null = null;
  for (const line of text.split("\n")) {
    const m = ANSWER_LINE.exec(line.trim());
    if (m) { at = Number(m[1]); found.set(at, line.trim().slice(m[0].length)); } else if (at !== null) found.set(at, `${found.get(at)}\n${line}`);
  }
  for (const [n, a] of found) found.set(n, a.trim());
  return found;
}

/** What question `i` (from 0) of `asked` shows once answered (D-105, REQ-126 D2), read from the operator's NEXT message after the asking reply:
 *  1. the line `ข้อ {i+1}: {text}` → `{text}`;
 *  2. else the old form, a line `ตามนั้น — {its proposed answer}` → that answer;
 *  3. else, when the message has neither form and `asked` had exactly one question, the whole text (typed before this change);
 *  4. else null — answered, in words the screen cannot attribute: it says only `ตอบแล้ว`. */
export function answeredWith(chat: ChatMessage[], asked: ChatMessage, i: number): string | null {
  const next = chat.slice(chat.indexOf(asked) + 1).find((m) => m.author === "operator");
  const q: ChatQuestion | undefined = asked.questions?.[i];
  if (!next || !q) return null;
  const lines = answerLines(next.text);
  const mine = lines.get(i + 1);
  if (mine) return mine;
  const old = next.text.split("\n").map((l) => l.trim());
  if (old.some((l) => l === oneAnswer.posted(q.proposedDefault))) return q.proposedDefault;
  const oldForm = old.some((l) => l.startsWith(oneAnswer.posted("")));
  return lines.size === 0 && !oldForm && asked.questions?.length === 1 ? next.text.trim() || null : null;
}

/** Are two proposals the same plan (REQ-126 D5, the back end's rule of D4)? Same number of items, and at each place the same title (trimmed), the same spec
 *  part and the same worker. */
export function samePlan(a: Pick<Proposal, "items">, b: Pick<Proposal, "items">): boolean {
  return a.items.length === b.items.length && a.items.every((x, i) => {
    const y = b.items[i]!;
    return x.title.trim() === y.title.trim() && x.anchor.key === y.anchor.key && x.workerId === y.workerId;
  });
}

/** An OPEN proposal that is the same plan as an accepted one (REQ-126 D5): the screen says `แผนนี้ตกลงไปแล้ว` and gives it no button. */
export const isPlanCopy = (p: Proposal, all: Proposal[]) => p.status === "open" && all.some((a) => a.status === "accepted" && samePlan(p, a));

/** The board says the entry worker's proposal waits for his agreement (D-105 P2, TASK-B-120): the newest message is the entry worker's reply, no question is
 *  open on it, and an OPEN proposal answers the operator message it replies to (a proposal hangs on the operator message, `Proposal.messageId`). */
export function proposalWaits(chain: Chain, chat: ChatMessage[], proposals: Proposal[]): boolean {
  const last = chat.at(-1);
  if (!chain.entryWorkerId || !last || last.author !== `worker:${chain.entryWorkerId}` || last.questions?.length || !last.replyTo) return false;
  // REQ-126 (TASK-169 step 8): an open copy of a plan that was already accepted is not waiting for the agreement — the chat says `แผนนี้ตกลงไปแล้ว` and gives it no button
  return proposals.some((p) => p.status === "open" && p.messageId === last.replyTo && !isPlanCopy(p, proposals));
}

/** Can this card's step be started from the board (D-105, TASK-B-121, SPEC-B-005 Q-1)? Only in แบบสั่งทีละขั้น, on a card the core calls workable, with someone
 *  assigned to run it, and while NO hop is running (a project runs one hop at a time). */
export function canCarryOn(card: Card, mode: Mode, hops: Hop[]): boolean {
  return mode === "manual" && card.workable && card.assigneeId !== null && !hops.some((h) => h.endedAt === null);
}

/** Is the entry worker answering the chat right now (TASK-B-114, D-103)? An open hop of theirs on a chat message, not on a card — the same hop the
 *  board's seat reads as `answeringChat`. */
export function entryAnswering(chain: Chain, hops: Hop[]): boolean {
  return !!chain.entryWorkerId && hops.some((h) => h.workerId === chain.entryWorkerId && h.endedAt === null && h.cardId === null && !!h.messageId);
}

/** The board's notice (TASK-B-098, D-094 § 0 B-1): the newest chat message is a worker's (you have not answered it) and it carries no questions — a reply
 *  with questions is the board's AskSheet instead (B-5), never both. Needs an entry worker, whose face and name the notice shows. */
export function entryWaitsInChat(chain: Chain, chat: ChatMessage[]): boolean {
  const last = chat.at(-1);
  return !!chain.entryWorkerId && !!last && last.author !== "operator" && !last.questions?.length;
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
