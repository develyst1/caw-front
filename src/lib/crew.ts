// Who is doing what, at a glance (REQ-014 R4): one seat per chain member — the entry worker first, then the chain's own order — and what that
// seat is up to. Pure: the screen reads the chain, the cards and the hops and hands them here.
import type { Card, CawApi, Chain, Hop, Worker } from "@/api/caw";

export type SeatState = "working" | "stuck" | "waitingOnYou" | "idleWithWork" | "free";
/** `n` is set for `idleWithWork` only: how many cards of theirs are in `doing` (D-066 C3). */
export interface Seat { worker: Worker; state: SeatState; card: Card | null; n?: number }

/** Priority: a running card hop → `working` (its card); else a stuck card of theirs → `stuck`; else an open question waiting for the operator
 *  (one assigned to them, or one a card of theirs depends on) → `waitingOnYou`; else cards of theirs in `doing` with nobody running them →
 *  `idleWithWork` (D-066: with the count); else `free`. With several cards the lowest number is shown. */
export function crewState(chain: Chain, cards: Card[], hops: Hop[]): Seat[] {
  const byNumber = [...cards].sort((a, b) => a.number - b.number);
  const openQuestion = (c: Card) => c.kind === "question" && c.answer === null;
  const members = [...chain.members].sort((a, b) => Number(b.id === chain.entryWorkerId) - Number(a.id === chain.entryWorkerId)); // stable: entry first, the rest as listed
  return members.map((worker) => {
    const running = hops.find((h) => h.workerId === worker.id && h.endedAt === null);
    if (running) return { worker, state: "working", card: cards.find((c) => c.id === running.cardId) ?? null };
    const mine = byNumber.filter((c) => c.assigneeId === worker.id);
    const stuck = mine.find((c) => c.status === "stuck");
    if (stuck) return { worker, state: "stuck", card: stuck };
    const waiting = byNumber.find((c) => openQuestion(c) && (c.assigneeId === worker.id || mine.some((m) => m.status !== "done" && m.dependsOn.includes(c.id))));
    if (waiting) return { worker, state: "waitingOnYou", card: waiting };
    const doing = mine.filter((c) => c.status === "doing");
    if (doing.length > 0) return { worker, state: "idleWithWork", card: doing[0]!, n: doing.length };
    return { worker, state: "free", card: null };
  });
}

/** What the home shows for a project: who is working (the first working seat's name, else null), how many seats are stuck, how many wait on you (D-066 C4). */
export interface CrewSummary { working: string | null; stuck: number; waitingOnYou: number }

export function crewSummary(seats: Seat[]): CrewSummary {
  return {
    working: seats.find((s) => s.state === "working")?.worker.name ?? null,
    stuck: seats.filter((s) => s.state === "stuck").length,
    waitingOnYou: seats.filter((s) => s.state === "waitingOnYou").length,
  };
}

/** The summaries for the home, by project id. **Three reads per project**: its chain, its cards and its newest hop — a project has one running hop at a
 *  time, so if there is a running hop it is the newest one (`hops(id, { limit: 1 })`, newest first). The projects are read in parallel. A project the back
 *  end no longer has (no chain) reads as an empty crew. */
export async function homeSummaries(api: CawApi, projects: { id: string }[]): Promise<Record<string, CrewSummary>> {
  const entries = await Promise.all(projects.map(async ({ id }) => {
    const [chain, cards, hops] = await Promise.all([api.chain(id), api.cards(id), api.hops(id, { limit: 1 })]);
    return [id, crewSummary(chain ? crewState(chain, cards, hops) : [])] as const;
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
