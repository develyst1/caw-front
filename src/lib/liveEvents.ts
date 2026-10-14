"use server";
// What LiveRefresh (a client component) asks the server: has the project's event log grown past `after`? A server action, because the seam only
// exists on the server (it is the mock's memory, or the back end's address).
import { api } from "@/api";
import { lastSeq } from "./eventSeq";

/** The newest event seq of the project, or `after` when nothing is newer. A back end that cannot be reached is "nothing new" — the next poll tries again. */
export async function newestSeq(projectId: string, after: number): Promise<number> {
  try { return await lastSeq(api, projectId, after); } catch { return after; }
}
