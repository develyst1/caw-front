"use server";

// The mode switch (SPEC-B-002 § Contract "Mode switch = run open"): to อัตโนมัติ = set the mode with its budget and open a run;
// back to แบบสั่งทีละขั้น = set the mode only (the runner ends the open run). A second open run is refused by the back end
// (409 run_open): the open run stays, nothing on screen resets.
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { CawError, type Mode } from "@/api/caw";

export async function switchMode(projectId: string, mode: Mode, hopBudget?: number): Promise<{ ok: true } | { ok: false; code: string }> {
  try {
    await api.setMode(projectId, mode, mode === "dispatcher" ? hopBudget : undefined);
    if (mode === "dispatcher") {
      try { await api.startRun(projectId, hopBudget ?? 10); }
      catch (e) { if (!(e instanceof CawError && e.code === "run_open")) throw e; }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e instanceof CawError ? e.code : "error" };
  } finally {
    revalidatePath(`/p/${projectId}`, "layout");
  }
}
