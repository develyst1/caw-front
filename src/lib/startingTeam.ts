// The starting team of a new project (SPEC-B-003 Decision 2, D-061): five seats made with routes the back end already has — no core change.
// Not atomic, so every step skips what is already there (`already_member` / `edge_exists` are fine, a worker with the name is reused): a second
// call is a no-op and a retry after a drop finishes the team. The five names and the chain are `team-proposed`.
import { CawError, isCawError, type CawApi, type Chain, type WorkerRole } from "@/api/caw";
import { STARTING_FACES } from "./faces";
import { skillsFor } from "./roles";

export const STARTING_TEAM: { name: string; role: WorkerRole }[] = [
  { name: "ปลา", role: "PM" }, { name: "ใบเตย", role: "SA" }, { name: "ฝน", role: "FE" }, { name: "แบงค์", role: "BE" }, { name: "มิ้นท์", role: "QA" },
];
/** who hands work to whom, by role: PM → SA · SA → FE · SA → BE · BE ↔ FE (REQ-121: the BE hands the page to the FE, and back) · FE → QA · BE → QA · QA → PM */
export const STARTING_EDGES: [WorkerRole, WorkerRole][] = [["PM", "SA"], ["SA", "FE"], ["SA", "BE"], ["BE", "FE"], ["FE", "BE"], ["FE", "QA"], ["BE", "QA"], ["QA", "PM"]];
const ENTRY: WorkerRole = "PM";

/** Runs `step`; a refusal that only says "already there" is success, any other error is the caller's. */
const idempotent = async (step: () => Promise<unknown>, already: string) => {
  try { await step(); } catch (e) { if (!(isCawError(e) && e.status === 409 && e.code === already)) throw e; }
};

/** Makes the starting team in the project's chain and returns the chain as it is after. */
export async function ensureStartingTeam(api: CawApi, projectId: string): Promise<Chain> {
  if (!(await api.project(projectId))) throw new CawError(404, "not_found", "no such project");
  const known = await api.workers();
  const seat = new Map<WorkerRole, string>();
  for (const { name, role } of STARTING_TEAM) {
    // workers are global: one with this name is reused, whatever it was made as; only a missing one is created
    // (a worker it creates gets its chosen face; one that exists is left exactly as it is — a face someone has is never overwritten)
    const worker = known.find((w) => w.name === name) ?? (await api.createWorker({ name, roles: [role], skills: skillsFor([role]), avatar: STARTING_FACES[name] }));
    seat.set(role, worker.id);
    await idempotent(() => api.addMember(projectId, worker.id), "already_member");
  }
  for (const [from, to] of STARTING_EDGES) await idempotent(() => api.addEdge(projectId, seat.get(from)!, seat.get(to)!), "edge_exists");
  return api.setEntry(projectId, seat.get(ENTRY)!); // PUT is a set, so repeating it is harmless
}
