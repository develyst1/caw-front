// The newest event seq of a project, read through the seam (the log is read oldest-first, ≤ 500 a page, so a long log takes several reads).
import type { CawApi, CawEvent } from "@/api/caw";

const PAGE = 500;

/** The seq of the project's newest event after `after` — `after` itself when there is nothing newer. */
export async function lastSeq(api: CawApi, projectId: string, after = 0): Promise<number> {
  let seq = after;
  for (;;) {
    const page = await api.events(projectId, { after: seq, limit: PAGE });
    if (page.length > 0) seq = page[page.length - 1]!.seq;
    if (page.length < PAGE) return seq;
  }
}

/** Leaves the heartbeats out (v1.11: a running hop writes one `hop.heartbeat` event about a minute) — any timeline built from events must go through this. */
export const withoutHeartbeats = (events: CawEvent[]): CawEvent[] => events.filter((e) => e.type !== "hop.heartbeat");
