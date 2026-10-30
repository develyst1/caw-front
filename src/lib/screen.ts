"use server";
// What a worker's screen (WorkerScreen, a client component) asks the server (REQ-104, SPEC-103 § caw-front): the worker's newest hop in this project, and the
// lines of that hop's CLI after `after`. A server action, because the seam only exists on the server (the mock's memory, or the back end's address).
import { api } from "@/api";
import type { HopOutputEntry } from "@/api/caw";

export interface ScreenAnswer {
  /** null: the worker has no hop in this project yet */
  hop: { id: string; startedAt: string; endedAt: string | null } | null;
  entries: HopOutputEntry[];
  more: boolean;
  /** REQ-122: the team is running and this worker's CLI is open in this project, waiting for work */
  open: boolean;
}

/** `api.hops` answers newest first, so the first hop of this worker is the newest. A back end that cannot be reached throws: the screen keeps what it has.
 *  The team status is read beside the hops; if only that read fails the answer still comes back, with `open: false`. */
export async function screenOf(projectId: string, workerId: string, after: number): Promise<ScreenAnswer> {
  const [hops, status] = await Promise.all([api.hops(projectId, { limit: 50 }), api.teamStatus().catch(() => null)]);
  const open = !!status && status.running && status.sessions.some((s) => s.projectId === projectId && s.workerId === workerId);
  const hop = hops.find((h) => h.workerId === workerId);
  if (!hop) return { hop: null, entries: [], more: false, open };
  const out = await api.hopOutput(hop.id, { after });
  return { hop: { id: hop.id, startedAt: hop.startedAt, endedAt: hop.endedAt }, entries: out.entries, more: out.more, open };
}
