"use server";

// The mode switch (SPEC-B-002 § Contract "Mode switch = run open", TASK-B-047): to อัตโนมัติ = first check that no run is
// still open — if one is, change nothing and say so (`run_open`); otherwise set the mode with its budget and open a run. If
// opening the run is refused anyway (409 run_open — another start won the race), the mode and budget go back to what they were,
// and the screen says the same words. Back to แบบสั่งทีละขั้น = set the mode only (the runner ends the open run).
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { CawError, type Mode } from "@/api/caw";
import { ensureStartingTeam } from "@/lib/startingTeam";

export type ModeResult = { ok: true } | { ok: false; code: string };

export async function switchMode(projectId: string, mode: Mode, hopBudget?: number): Promise<ModeResult> {
  try {
    if (mode === "manual") { await api.setMode(projectId, "manual"); return { ok: true }; }
    const [before, [latest]] = await Promise.all([api.project(projectId), api.runs(projectId, 1)]);
    if (!before) return { ok: false, code: "not_found" };
    if (latest && latest.endedAt === null) return { ok: false, code: "run_open" }; // DEF-2: nothing changed
    const budget = hopBudget ?? before.hopBudget;
    await api.setMode(projectId, "dispatcher", budget);
    try {
      await api.startRun(projectId, budget);
    } catch (e) {
      if (e instanceof CawError && e.code === "run_open") {
        await api.setMode(projectId, before.mode, before.hopBudget); // put back what this action changed
        return { ok: false, code: "run_open" };
      }
      throw e;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e instanceof CawError ? e.code : "unreachable" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}

/** หยุดการรันนี้ (D-056, TASK-B-055): stop the project's open run — the newest run, if it is still open. The mode is not touched, so the
 *  header then shows D-052's stopped line. A run already over (409 already_finished, or none open by now) is what was wanted: done. */
export async function stopOpenRun(projectId: string): Promise<ModeResult> {
  try {
    const [latest] = await api.runs(projectId, 1);
    if (!latest || latest.endedAt !== null) return { ok: true };
    await api.stopRun(latest.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof CawError && e.code === "already_finished") return { ok: true };
    return { ok: false, code: e instanceof CawError ? e.code : "unreachable" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}

/** ใช้ทีมเริ่มต้น (REQ-014 R2, SPEC-B-003 Decision 2, TASK-B-064): makes the five-seat starting team through Bob's idempotent `ensureStartingTeam` —
 *  a second press, or a retry after a drop, finishes the team and changes nothing else. */
export async function useStartingTeam(projectId: string): Promise<ModeResult> {
  try {
    await ensureStartingTeam(api, projectId);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e instanceof CawError ? e.code : "unreachable" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}
