"use server";

// The folder editor's one write: set the project's workspace roots through `CawApi` (operator-only on the back end).
import { revalidatePath } from "next/cache";
import { api } from "@/api";
import { isCawError } from "@/api/caw";

export async function saveRoots(projectId: string, roots: string[]): Promise<{ ok: true } | { ok: false }> {
  try {
    const p = await api.setWorkspace(projectId, roots);
    if (!p) return { ok: false };
    revalidatePath(`/p/${projectId}`, "layout"); // the header's warning follows the folders
    return { ok: true };
  } catch (e) {
    if (isCawError(e)) return { ok: false }; // a 400 on the paths, or a back end that is down: the editor shows its hint
    throw e;
  }
}
