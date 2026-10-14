// What a role brings to a worker (REQ-014 R6, SPEC-A-008 § v1.10): the core does not derive `skills` from `roles` — the screen fills the list from the
// picked roles (the user may add more), and the runner hands a hop every skill in `worker.skills`.
import type { WorkerRole } from "@/api/caw";

export const ROLE_SKILLS: Record<WorkerRole, string[]> = {
  PM: ["role-pm"], BA: ["role-ba"], SA: ["role-sa"], FE: ["role-fe"], BE: ["role-be"], QA: ["role-qa"], other: [],
};

/** The union of the picked roles' skills, in the order the roles were picked, no repeats. */
export const skillsFor = (roles: readonly WorkerRole[]): string[] => [...new Set(roles.flatMap((r) => ROLE_SKILLS[r]))];
