// The starting team (SPEC-B-003 Decision 2, D-061): five seats made from existing routes — idempotent, so a retry finishes a half-made team.
import { describe, expect, test } from "bun:test";
import { CawError, type CawApi } from "@/api/caw";
import { createMockApi, MOCK_NEW_PROJECT_ID } from "@/api/mock";
import { STARTING_FACES } from "./faces";
import { ensureStartingTeam, STARTING_EDGES, STARTING_TEAM } from "./startingTeam";

/** an empty project on the mock (the seed project already has a chain) */
/** an empty project on the mock: the `new-project` state's second project (v1.15: a Blueprint project has only one project, so `createProject` cannot make another) */
const fresh = async (api: CawApi = createMockApi({ state: "new-project" })) => ({ api, id: MOCK_NEW_PROJECT_ID });
const names = (c: { members: { name: string }[] }) => c.members.map((m) => m.name).sort();
const WANT = ["ใบเตย", "ฝน", "ปลา", "มิ้นท์", "แบงค์"].sort();

describe("the starting team", () => {
  test("the five seats and the chain between them, as the spec writes them", () => {
    expect(STARTING_TEAM.map((s) => [s.name, s.role])).toEqual([["ปลา", "PM"], ["ใบเตย", "SA"], ["ฝน", "FE"], ["แบงค์", "BE"], ["มิ้นท์", "QA"]]);
    expect(STARTING_EDGES).toEqual([["PM", "SA"], ["SA", "FE"], ["SA", "BE"], ["FE", "QA"], ["BE", "QA"], ["QA", "PM"]]);
  });

  test("on an empty project: five members, six edges, entry = the PM; a worker that already exists is reused, the missing one is made with its role and skills", async () => {
    const { api, id } = await fresh();
    const before = (await api.workers()).length;
    const chain = await ensureStartingTeam(api, id);
    expect(names(chain)).toEqual(WANT);
    expect(chain.edges).toHaveLength(6);
    const by = Object.fromEntries(chain.members.map((m) => [m.name, m]));
    expect(chain.entryWorkerId).toBe(by["ปลา"]!.id);
    const has = (a: string, b: string) => chain.edges.some((e) => e.from === by[a]!.id && e.to === by[b]!.id);
    for (const [a, b] of [["ปลา", "ใบเตย"], ["ใบเตย", "ฝน"], ["ใบเตย", "แบงค์"], ["ฝน", "มิ้นท์"], ["แบงค์", "มิ้นท์"], ["มิ้นท์", "ปลา"]] as const) expect(has(a, b)).toBe(true);
    expect((await api.workers()).length).toBe(before + 1); // only ใบเตย was missing
    expect(by["ใบเตย"]).toMatchObject({ role: "SA", roles: ["SA"], skills: ["role-sa"] });
    expect(by["ปลา"]!.skills).toEqual(["role-pm"]); // the seeded one, untouched
  });

  test("a second call changes nothing: the same chain, no new worker", async () => {
    const { api, id } = await fresh();
    const first = await ensureStartingTeam(api, id);
    const workers = (await api.workers()).length;
    const second = await ensureStartingTeam(api, id);
    expect(second).toEqual(first);
    expect((await api.workers()).length).toBe(workers);
  });

  test("a half-made team is finished: members but no edges, and a drop in the middle of the steps then a retry", async () => {
    const half = await fresh();
    const pla = (await half.api.workers()).find((w) => w.name === "ปลา")!;
    await half.api.addMember(half.id, pla.id);
    expect(names(await ensureStartingTeam(half.api, half.id))).toEqual(WANT);
    expect((await half.api.chain(half.id))!.edges).toHaveLength(6);

    // the network drops on the third edge
    const real = createMockApi({ state: "new-project" });
    let edges = 0;
    const flaky: CawApi = { ...real, addEdge: (...a) => { if (++edges === 3) throw new CawError(0, "unreachable", "down"); return real.addEdge(...a); } };
    const { id } = await fresh(real);
    await expect(ensureStartingTeam(flaky, id)).rejects.toBeInstanceOf(CawError);
    expect((await real.chain(id))!.edges).toHaveLength(2);
    const done = await ensureStartingTeam(flaky, id); // the retry
    expect([names(done), done.edges.length]).toEqual([WANT, 6]);
  });

  test("a project that is not there is the back end's error, not a crash", async () => {
    const api = createMockApi();
    await expect(ensureStartingTeam(api, "p-nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("the starting team's faces (REQ-014 R7)", () => {
  /** an API that remembers what is asked of it: no workers at first, so all five are made */
  const recorder = (existing: { id: string; name: string; avatar: unknown }[] = []) => {
    const created: { name: string; avatar: unknown; roles: unknown }[] = [];
    const calls: string[] = [];
    const workers = existing.map((w) => ({ ...w, role: "FE", roles: ["FE"], skills: ["x"], model: "sonnet", effort: "medium", combinedFrom: null }));
    const chain = { members: [] as unknown[], edges: [] as unknown[], entryWorkerId: null as string | null };
    const api = {
      project: async () => ({ id: "p" }),
      workers: async () => [...workers],
      createWorker: async (input: { name: string; avatar?: unknown; roles: unknown }) => { created.push({ name: input.name, avatar: input.avatar, roles: input.roles }); const w = { id: `new-${input.name}`, name: input.name, avatar: input.avatar ?? null }; workers.push(w as never); return w; },
      updateWorker: async () => { calls.push("updateWorker"); },
      addMember: async () => chain, addEdge: async () => chain, setEntry: async () => chain,
    } as unknown as CawApi;
    return { api, created, calls };
  };

  test("a worker it creates gets its chosen face; the five are different and are the approved ones", async () => {
    const { api, created } = recorder();
    await ensureStartingTeam(api, "p");
    expect(created.map((c) => [c.name, c.avatar])).toEqual(STARTING_TEAM.map((s) => [s.name, STARTING_FACES[s.name]]));
    expect(new Set(created.map((c) => JSON.stringify(c.avatar))).size).toBe(5);
  });

  test("it never overwrites a face someone already has, and never edits an existing worker: only the missing ones are made, with their own faces", async () => {
    const mine = { body: "gem", color: "ink", eyes: "one" };
    const { api, created, calls } = recorder([{ id: "w-pla", name: "ปลา", avatar: mine }, { id: "w-fern", name: "ฝน", avatar: null }]);
    await ensureStartingTeam(api, "p");
    expect(created.map((c) => c.name)).toEqual(["ใบเตย", "แบงค์", "มิ้นท์"]);
    expect(created.every((c) => JSON.stringify(c.avatar) === JSON.stringify(STARTING_FACES[c.name]))).toBe(true);
    expect(calls).toEqual([]); // no updateWorker: ปลา keeps `mine`, ฝน stays "not chosen" (it was not created here)
  });

  test("a second call on a finished team makes nobody", async () => {
    const first = recorder();
    await ensureStartingTeam(first.api, "p");
    const all = first.created.map((c) => ({ id: `new-${c.name}`, name: c.name, avatar: c.avatar }));
    const second = recorder(all);
    await ensureStartingTeam(second.api, "p");
    expect(second.created).toEqual([]);
  });

  test("on the seeded mock the one it creates (ใบเตย) has dome/teal/beans, and the seeded ones keep the faces the seed gave them", async () => {
    const { api, id } = await fresh();
    const chain = await ensureStartingTeam(api, id);
    const by = Object.fromEntries(chain.members.map((m) => [m.name, m]));
    expect(by["ใบเตย"]!.avatar).toEqual({ body: "dome", color: "teal", eyes: "beans" });
    expect(by["ปลา"]!.avatar).toEqual(STARTING_FACES["ปลา"]!);
  });
});

