// What a run (or the manual hops) cost: how many hops, how long they took, how many tokens — from the hops themselves, never stored
// (REQ-011 R6: "cost must be visible"). A running hop has no end or tokens yet, so it counts as a hop but adds no time or tokens.
import type { Hop, Run } from "@/api/caw";

export interface Totals { hops: number; wallMs: number; tokensIn: number; tokensOut: number }

export const hopWallMs = (h: Hop) => (h.endedAt ? Math.max(0, Date.parse(h.endedAt) - Date.parse(h.startedAt)) : 0);

export function totalsOf(hops: Hop[]): Totals {
  return hops.reduce<Totals>((t, h) => ({
    hops: t.hops + 1, wallMs: t.wallMs + hopWallMs(h), tokensIn: t.tokensIn + (h.tokensIn ?? 0), tokensOut: t.tokensOut + (h.tokensOut ?? 0),
  }), { hops: 0, wallMs: 0, tokensIn: 0, tokensOut: 0 });
}

/** The hops of each run (oldest first, as they happened) and the manual ones (no run), from one list of hops. */
export function groupHops(runs: Run[], hops: Hop[]): { byRun: Map<string, Hop[]>; manual: Hop[] } {
  const oldestFirst = [...hops].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const byRun = new Map<string, Hop[]>(runs.map((r) => [r.id, []]));
  const manual: Hop[] = [];
  for (const h of oldestFirst) {
    if (h.runId === null) manual.push(h);
    else byRun.get(h.runId)?.push(h); // a hop of a run that is not in the list (older than the page's limit) is left out, not misfiled
  }
  return { byRun, manual };
}

// Thai Buddhist-era dates, one fixed time zone: the page reads the same wherever the server runs (Blueprint writes พ.ศ. too).
const when = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const clock = new Intl.DateTimeFormat("th-TH", { timeStyle: "short", timeZone: "Asia/Bangkok" });
export const whenOf = (iso: string) => when.format(new Date(iso));
export const clockOf = (iso: string) => clock.format(new Date(iso));
