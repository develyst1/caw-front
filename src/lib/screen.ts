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
}

/** `api.hops` answers newest first, so the first hop of this worker is the newest. A back end that cannot be reached throws: the screen keeps what it has. */
export async function screenOf(projectId: string, workerId: string, after: number): Promise<ScreenAnswer> {
  const hop = (await api.hops(projectId, { limit: 50 })).find((h) => h.workerId === workerId);
  if (!hop) return { hop: null, entries: [], more: false };
  const out = await api.hopOutput(hop.id, { after });
  return { hop: { id: hop.id, startedAt: hop.startedAt, endedAt: hop.endedAt }, entries: out.entries, more: out.more };
}
