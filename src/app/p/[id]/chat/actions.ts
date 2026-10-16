"use server";

// The chat's two writes (REQ-013, TASK-B-050) through `CawApi`: post a message to the entry worker; accept a card proposal (its cards
// are made in one go). Each refreshes the project — the board shows the new cards; a refusal comes back as its code.
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { isCawError } from "@/api/caw";

export type ChatResult = { ok: true } | { ok: false; code: string };

async function run(projectId: string, fn: () => Promise<unknown>): Promise<ChatResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, code: isCawError(e) ? e.code : "unreachable" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}

export async function postMessage(projectId: string, text: string) { return run(projectId, () => api.postChat(projectId, text)); }
// ลองอีกครั้ง (D-057, TASK-B-058): ask the runner to answer this message again. `already_answered` / `hop_running` mean the state moved on —
// nothing to tell the operator, the refresh shows it.
export async function retryMessage(projectId: string, messageId: string): Promise<ChatResult> {
  const r = await run(projectId, () => api.retryChat(messageId));
  return !r.ok && (r.code === "already_answered" || r.code === "hop_running") ? { ok: true } : r;
}
export async function acceptProposal(projectId: string, proposalId: string) { return run(projectId, () => api.acceptProposal(proposalId)); }
