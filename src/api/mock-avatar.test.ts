// `Worker.avatar` on the mock (SPEC-A-008 § v1.12, REQ-014 R7): `{ body, color, eyes }` — three short ids — or `null` (not chosen). The core checks the SHAPE,
// not the list of faces (the list is Team B's, in caw-front); a partial object is a 400; a PATCH with an object sets all three and `null` clears it.
import { describe, expect, test } from "bun:test";
import { CawError } from "./caw";
import { STARTING_FACES } from "@/lib/faces";
import { createMockApi } from "./mock";

const FACE = { body: "round", color: "sky", eyes: "dots" };
const expectRefusal = async (p: Promise<unknown>, status: number, code: string) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(CawError);
  expect([(e as CawError).status, (e as CawError).code]).toEqual([status, code]);
};
const make = (api: ReturnType<typeof createMockApi>, name: string, over: object = {}) => api.createWorker({ name, roles: ["FE"], skills: ["x"], ...over });

describe("avatar on a worker", () => {
  test("the seed's workers that are starting-team names carry the approved starting faces (the one list, `STARTING_FACES` — not a copy); any other seeded worker has none", async () => {
    const workers = await createMockApi().workers();
    const named = workers.filter((w) => w.name in STARTING_FACES);
    expect(named.length).toBeGreaterThanOrEqual(4); // ปลา · ฝน · แบงค์ · มิ้นท์ (the seed has no ใบเตย)
    for (const w of named) expect(w.avatar).toEqual(STARTING_FACES[w.name]!);
    expect(workers.filter((w) => !(w.name in STARTING_FACES)).every((w) => w.avatar === null)).toBe(true);
  });

  test("a worker made without an avatar has `avatar: null` — nothing is derived or stored — and so has a combined one", async () => {
    const api = createMockApi();
    expect((await make(api, "ไม่มีหน้า")).avatar).toBeNull();
    const [a, b] = (await api.workers()).slice(0, 2);
    expect((await api.combineWorkers("รวม", [a!.id, b!.id])).avatar).toBeNull();
  });

  test("createWorker with an avatar keeps all three ids, and it reads back from the list and the chain", async () => {
    const api = createMockApi();
    const w = await make(api, "มีหน้า", { avatar: FACE });
    expect(w.avatar).toEqual(FACE);
    expect((await api.workers()).find((x) => x.id === w.id)!.avatar).toEqual(FACE);
    expect((await make(api, "ระบุ null", { avatar: null })).avatar).toBeNull();
  });

  test("the shape is checked: ids are 1–24 characters of a–z, 0–9 and `-`; a partial object, a missing part, an extra word or a non-object → 400 validation, nothing made", async () => {
    const api = createMockApi();
    const before = (await api.workers()).length;
    for (const [i, bad] of ([
      { color: "sky" }, { body: "round", color: "sky" }, { ...FACE, eyes: "" }, { ...FACE, body: "Round" }, { ...FACE, color: "sky blue" },
      { ...FACE, eyes: "a".repeat(25) }, { ...FACE, body: 7 }, "round", [], { ...FACE, hat: "red" },
    ] as unknown[]).entries()) await expectRefusal(make(api, `เสีย${i}`, { avatar: bad }), 400, "validation");
    expect((await api.workers()).length).toBe(before);
    expect((await make(api, "ยาวสุด", { avatar: { body: "a".repeat(24), color: "0-9", eyes: "x" } })).avatar).not.toBeNull(); // 24 is fine
  });

  test("updateWorker: an object sets all three, `null` clears, and it counts as 'something sent' (the only field of a PATCH)", async () => {
    const api = createMockApi();
    const w = await make(api, "แก้หน้า", { avatar: FACE });
    const set = await api.updateWorker(w.id, { avatar: { body: "tall", color: "mint", eyes: "wide" } });
    expect(set.avatar).toEqual({ body: "tall", color: "mint", eyes: "wide" });
    expect([set.name, set.roles, set.skills]).toEqual([w.name, w.roles, w.skills]); // nothing else moved
    const cleared = await api.updateWorker(w.id, { avatar: null });
    expect(cleared.avatar).toBeNull();
    expect((await api.workers()).find((x) => x.id === w.id)!.avatar).toBeNull();
  });

  test("a PATCH without `avatar` leaves the face alone; a partial one → 400 and the face is untouched", async () => {
    const api = createMockApi();
    const w = await make(api, "คงหน้า", { avatar: FACE });
    expect((await api.updateWorker(w.id, { name: "คงหน้า2" })).avatar).toEqual(FACE);
    await expectRefusal(api.updateWorker(w.id, { avatar: { color: "mint" } as never }), 400, "validation");
    expect((await api.workers()).find((x) => x.id === w.id)!.avatar).toEqual(FACE);
  });
});
