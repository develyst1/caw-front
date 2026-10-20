"use server";
// What LiveRefresh (a client component) asks the server: has the project's event log grown past `after`? A server action, because the seam only
// exists on the server (it is the mock's memory, or the back end's address).
import { api } from "@/api";
import { lastSeq } from "./eventSeq";

/** One poll's answer (TASK-B-109, REQ-015 AC-1): the newest seq (as `newestSeq`) and whether the team is running — a runner's check-in writes no
 *  event, so the screen watches it too. One round trip; `running` is null when the status could not be read (no flip, the next poll tries again). */
export async function liveState(projectId: string, after: number): Promise<{ seq: number; running: boolean | null }> {
  const [seq, running] = await Promise.all([newestSeq(projectId, after), api.teamStatus().then((t) => t.running, () => null)]);
  return { seq, running };
}

/** The newest event seq of the project, or `after` when nothing is newer. A back end that cannot be reached is "nothing new" — the next poll tries again. */
export async function newestSeq(projectId: string, after: number): Promise<number> {
  try { return await lastSeq(api, projectId, after); } catch { return after; }
}
