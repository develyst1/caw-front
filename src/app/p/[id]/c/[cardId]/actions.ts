"use server";

// The operator's four actions on a card (REQ-011 R3, TASK-B-041), through `CawApi`: comment, answer a question card, change
// status, re-assign (the operator's authority ignores the chain's edges, not its members — SPEC-A-008). Each refreshes the
// project, so the board shows the change on the next look. A refusal comes back as its code; the screen turns it into words.
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { CawError, type CardStatus } from "@/api/caw";

export type ActionResult = { ok: true } | { ok: false; code: string };

async function run(projectId: string, fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e instanceof CawError ? e.code : "unreachable" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}

export async function commentOn(projectId: string, cardId: string, text: string) { return run(projectId, () => api.comment(cardId, text)); }
export async function answerCard(projectId: string, cardId: string, answer: string) { return run(projectId, () => api.answer(cardId, answer)); }
export async function setCardStatus(projectId: string, cardId: string, status: CardStatus) { return run(projectId, () => api.setStatus(cardId, status)); }
export async function assignCard(projectId: string, cardId: string, workerId: string) { return run(projectId, () => api.assign(cardId, workerId)); }
