// The one readiness checklist (SPEC-B-003 § overlaps, D-063) for the team page and the chat head: a pure function over the project, its chain and the
// workers → one item per rule, `ok | todo | bad`. Codes only — the words (and the fix each one names) are the screen's. Display only: the core stays
// the authority on what a team may do. Five rules (D-066 took out `roles` — the picker already forces one — and `budget`, which the mode control
// asks for itself). Only a forbidden shape (QA who is also a builder) is `bad`; anything merely missing is `todo`.
import type { Chain, Project, Worker } from "@/api/caw";

export type ReadinessRule = "entry" | "reachable" | "handoff" | "qaNotBuilder" | "folder";
export interface ReadinessItem { rule: ReadinessRule; state: "ok" | "todo" | "bad"; /** the workers the item is about (todo / bad only) */ who?: string[] }

const isBuilder = (w: Worker) => w.roles.some((r) => r === "FE" || r === "BE");

export function readiness(project: Project, chain: Chain, workers: Worker[]): ReadinessItem[] {
  // the seats are the chain's members, in chain order; a member's roles come from `workers` (the newest read) when it is there
  const seats = chain.members.map((m) => workers.find((w) => w.id === m.id) ?? m);
  const empty = seats.length === 0;
  const item = (rule: ReadinessRule, who: string[], todoWhenEmpty = false): ReadinessItem =>
    who.length > 0 ? { rule, state: "todo", who } : empty && todoWhenEmpty ? { rule, state: "todo" } : { rule, state: "ok" };

  // reachable from the entry worker along the edges; with no entry nobody is
  const reached = new Set<string>();
  if (chain.entryWorkerId) {
    const queue = [chain.entryWorkerId];
    while (queue.length) {
      const at = queue.pop()!;
      if (reached.has(at)) continue;
      reached.add(at);
      for (const e of chain.edges) if (e.from === at) queue.push(e.to);
    }
  }
  const handsOff = new Set(chain.edges.map((e) => e.from));
  const qaBuilders = seats.filter((w) => w.roles.includes("QA") && isBuilder(w)).map((w) => w.id);

  return [
    chain.entryWorkerId ? { rule: "entry", state: "ok" } : { rule: "entry", state: "todo" },
    item("reachable", seats.filter((w) => !reached.has(w.id)).map((w) => w.id), true),
    item("handoff", seats.filter((w) => isBuilder(w) && !handsOff.has(w.id)).map((w) => w.id), true),
    qaBuilders.length > 0 ? { rule: "qaNotBuilder", state: "bad", who: qaBuilders } : { rule: "qaNotBuilder", state: "ok" },
    project.workspace.roots.length > 0 ? { rule: "folder", state: "ok" } : { rule: "folder", state: "todo" },
  ];
}
