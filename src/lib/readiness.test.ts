// The one readiness checklist (SPEC-B-003 § overlaps, D-063): a pure function over the project, its chain and the workers — display only, the core
// stays the authority. Only a forbidden shape (QA who is also a builder) is `bad`; everything else that is missing is `todo`.
import { describe, expect, test } from "bun:test";
import type { Chain, Project, Worker, WorkerRole } from "@/api/caw";
import { readiness, type ReadinessItem } from "./readiness";

const W = (id: string, roles: WorkerRole[]): Worker => ({ id, name: id, role: roles[0]!, roles, skills: ["x"], model: "sonnet", effort: "medium", combinedFrom: null });
const project = (over: Partial<Project> = {}): Project => ({
  id: "p", name: "n", blueprintProjectId: "b", version: 1, latestSeenVersion: 1, mode: "manual", hopBudget: 0, hopsUsed: 0, entryWorkerId: null,
  workspace: { roots: ["/work/app"] }, createdAt: "", ...over,
});
const pm = W("pm", ["PM"]), sa = W("sa", ["SA"]), fe = W("fe", ["FE"]), be = W("be", ["BE"]), qa = W("qa", ["QA"]);
const E = (...pairs: [string, string][]) => pairs.map(([from, to]) => ({ from, to }));
const GOOD_EDGES = E(["pm", "sa"], ["sa", "fe"], ["sa", "be"], ["fe", "qa"], ["be", "qa"], ["qa", "pm"]);
const chain = (members: Worker[], edges = GOOD_EDGES, entry: string | null = "pm"): Chain => ({ members, edges, entryWorkerId: entry });
const FULL = [pm, sa, fe, be, qa];
const item = (items: ReadinessItem[], rule: string) => items.find((i) => i.rule === rule)!;
const run = (c: Chain, p: Partial<Project> = {}) => readiness(project(p), c, c.members);

describe("readiness", () => {
  test("five rules only: `roles` and `budget` are not checked any more (D-066) — a worker with no role, or อัตโนมัติ with no budget, changes nothing", () => {
    const noRole = { ...W("x", []), role: "other" as const };
    const items = readiness(project({ mode: "dispatcher", hopBudget: 0 }), chain([...FULL, noRole], [...GOOD_EDGES, ...E(["pm", "x"])]), [...FULL, noRole]);
    expect(items.map((i) => i.rule)).toEqual(["entry", "reachable", "handoff", "qaNotBuilder", "folder"]);
    expect(items.every((i) => i.state === "ok")).toBe(true);
  });

  test("a good team: every rule `ok`, in the spec's order, and nothing names anyone", () => {
    const items = run(chain(FULL));
    expect(items.map((i) => [i.rule, i.state])).toEqual([
      ["entry", "ok"], ["reachable", "ok"], ["handoff", "ok"], ["qaNotBuilder", "ok"], ["folder", "ok"],
    ]);
    expect(items.every((i) => i.who === undefined)).toBe(true);
  });

  test("entry: no entry worker → todo", () => {
    expect(item(run(chain(FULL, GOOD_EDGES, null)), "entry").state).toBe("todo");
  });

  test("reachable: every member must be reachable from the entry worker along the edges; the ones that are not are named", () => {
    const loose = chain(FULL, E(["pm", "sa"], ["sa", "fe"], ["fe", "qa"], ["be", "qa"])); // nothing leads to `be`
    expect(item(run(loose), "reachable")).toEqual({ rule: "reachable", state: "todo", who: ["be"] });
    const away = chain(FULL, E(["pm", "sa"], ["sa", "fe"], ["sa", "be"], ["fe", "qa"], ["be", "qa"])); // qa → pm is not needed to reach anyone
    expect(item(run(away), "reachable").state).toBe("ok");
    expect(item(run(chain(FULL, [], "pm")), "reachable")).toMatchObject({ state: "todo", who: ["sa", "fe", "be", "qa"] }); // chain order
  });

  test("reachable with no entry: nobody is reachable — every member is named", () => {
    expect(item(run(chain(FULL, GOOD_EDGES, null)), "reachable")).toMatchObject({ state: "todo", who: ["pm", "sa", "fe", "be", "qa"] });
  });

  test("handoff: a builder (FE or BE) with nobody to hand off to is named; a PM or QA with no outgoing edge is not asked", () => {
    const dead = chain(FULL, E(["pm", "sa"], ["sa", "fe"], ["sa", "be"], ["fe", "qa"])); // be → nobody
    expect(item(run(dead), "handoff")).toEqual({ rule: "handoff", state: "todo", who: ["be"] });
    const qaLast = chain(FULL, E(["pm", "sa"], ["sa", "fe"], ["sa", "be"], ["fe", "qa"], ["be", "qa"])); // qa hands to nobody: fine
    expect(item(run(qaLast), "handoff").state).toBe("ok");
    const both = W("fb", ["FE", "BE"]);
    expect(item(run(chain([pm, sa, both, qa], E(["pm", "sa"], ["sa", "fb"], ["fb", "qa"]))), "handoff").state).toBe("ok");
    expect(item(run(chain([pm, sa, both, qa], E(["pm", "sa"], ["sa", "fb"]))), "handoff")).toMatchObject({ state: "todo", who: ["fb"] });
  });

  test("qaNotBuilder: QA who is also FE or BE is the one forbidden shape → `bad`, and the worker is named", () => {
    const both = W("fq", ["FE", "QA"]);
    const items = run(chain([pm, sa, both, be], E(["pm", "sa"], ["sa", "fq"], ["sa", "be"], ["fq", "pm"], ["be", "pm"])));
    expect(item(items, "qaNotBuilder")).toEqual({ rule: "qaNotBuilder", state: "bad", who: ["fq"] });
    expect(items.filter((i) => i.state === "bad")).toHaveLength(1);
    expect(item(run(chain([pm, W("qp", ["QA", "PM"])], E(["pm", "qp"]))), "qaNotBuilder").state).toBe("ok"); // QA + PM is allowed
  });

  test("folder: no writable folder → todo", () => {
    expect(item(run(chain(FULL), { workspace: { roots: [] } }), "folder").state).toBe("todo");
  });

  test("an empty team: the rules that need people are `todo` (nothing to be ok about), the forbidden shape is not there", () => {
    const items = run({ members: [], edges: [], entryWorkerId: null });
    expect(items.map((i) => [i.rule, i.state])).toEqual([
      ["entry", "todo"], ["reachable", "todo"], ["handoff", "todo"], ["qaNotBuilder", "ok"], ["folder", "ok"],
    ]);
  });

  test("`workers` (the second argument's list) is what roles are read from — the chain's members are the seats", () => {
    const changed = { ...fe, roles: ["FE", "QA"] as WorkerRole[] };
    const items = readiness(project(), chain(FULL), FULL.map((w) => (w.id === "fe" ? changed : w)));
    expect(item(items, "qaNotBuilder")).toMatchObject({ state: "bad", who: ["fe"] });
  });
});
