// The starting team (SPEC-B-003 Decision 2, D-061): five seats made from existing routes — idempotent, so a retry finishes a half-made team.
import { describe, expect, test } from "bun:test";
import { CawError, type CawApi } from "@/api/caw";
import { createMockApi } from "@/api/mock";
import { ensureStartingTeam, STARTING_EDGES, STARTING_TEAM } from "./startingTeam";

/** an empty project on the mock (the seed project already has a chain) */
const fresh = async (api: CawApi = createMockApi()) => ({ api, id: (await api.createProject({ blueprintProjectId: "11111111-2222-4333-8444-555555555555", version: 1 })).id });
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
    const real = createMockApi();
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
