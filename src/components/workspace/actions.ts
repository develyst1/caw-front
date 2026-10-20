"use server";

// The folder editor's one write: set the project's workspace roots — and which of them are read-only (D-100, TASK-B-108) — through `CawApi`
// (operator-only on the back end).
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { isCawError } from "@/api/caw";
import { keepReadOnly } from "./roots";

/** `readOnly` left out (FirstSteps adds a folder without knowing kinds) keeps the project's current read-only folders that are still roots — the seam
 *  itself would read a left-out `readOnly` as none and quietly make them writable. */
export async function saveRoots(projectId: string, roots: string[], readOnly?: string[]): Promise<{ ok: true } | { ok: false }> {
  try {
    const ro = readOnly ?? keepReadOnly(roots, (await api.project(projectId))?.workspace.readOnly ?? []);
    const p = await api.setWorkspace(projectId, roots, ro);
    if (!p) return { ok: false };
    revalidatePath(`/p/${projectId}`, "layout"); // the header's warning follows the folders
    return { ok: true };
  } catch (e) {
    if (isCawError(e)) return { ok: false }; // a 400 on the paths, or a back end that is down: the editor shows its hint
    throw e;
  }
}
