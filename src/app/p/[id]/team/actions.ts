"use server";

// The team + chain writes (REQ-011 R4, TASK-B-042) through `CawApi`: workers are global, the chain is this project's. Each
// refreshes the project and returns `{ ok }` or the refusal's code (+ details: `has_open_cards` carries `{ count }`).
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { CawError, type Avatar, type Effort, type ModelName, type WorkerRole } from "@/api/caw";

export type TeamResult = { ok: true } | { ok: false; code: string; details?: unknown };

async function run(projectId: string, fn: () => Promise<unknown>): Promise<TeamResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return e instanceof CawError ? { ok: false, code: e.code, details: e.details } : { ok: false, code: "unreachable" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}

export async function createWorker(projectId: string, input: { name: string; roles: WorkerRole[]; skills: string[]; model?: ModelName; effort?: Effort; avatar?: Avatar | null }) {
  return run(projectId, () => api.createWorker(input));
}
/** Edit a person (v1.10 / v1.12): roles (1+), skills, or the face — all three face parts or none (`null` = derive from the name). */
export async function updateWorker(projectId: string, workerId: string, patch: { roles?: WorkerRole[]; skills?: string[]; avatar?: Avatar | null }) {
  return run(projectId, () => api.updateWorker(workerId, patch));
}
// TASK-B-065: `รวมสองคน` is gone (D-060) — a person holds several roles instead; a worker combined earlier still shows `combinedFrom`.
export async function addMember(projectId: string, workerId: string) { return run(projectId, () => api.addMember(projectId, workerId)); }
export async function removeMember(projectId: string, workerId: string, reassignTo?: string) { return run(projectId, () => api.removeMember(projectId, workerId, reassignTo)); }
export async function addEdge(projectId: string, from: string, to: string) { return run(projectId, () => api.addEdge(projectId, from, to)); }
export async function removeEdge(projectId: string, from: string, to: string) { return run(projectId, () => api.removeEdge(projectId, from, to)); }
export async function setEntry(projectId: string, workerId: string) { return run(projectId, () => api.setEntry(projectId, workerId)); }
