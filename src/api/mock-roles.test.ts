// Roles on the mock (SPEC-A-008 § v1.10, REQ-014 R6): `roles` ≥ 1 and distinct, BA exists, the model / effort default is the STRONGEST of the picked
// roles', `role` stays as `roles[0]`, and PATCH changes only what it is sent.
import { describe, expect, test } from "bun:test";
import { CawError, type CawApi } from "./caw";
import { createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

const expectRefusal = async (p: Promise<unknown>, status: number, code: string) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(CawError);
  expect([(e as CawError).status, (e as CawError).code]).toEqual([status, code]);
};
const make = (api: CawApi, name: string, roles: Parameters<CawApi["createWorker"]>[0] extends infer I ? (I extends { roles: infer R } ? R : never) : never, over: object = {}) =>
  api.createWorker({ name, roles, skills: ["x"], ...over });

describe("roles on a worker", () => {
  test("every seeded worker has roles = [role]", async () => {
    for (const w of await createMockApi().workers()) expect(w.roles).toEqual([w.role]);
  });

  test("createWorker with `roles`: kept in the order picked, `role` = roles[0]; the old single `role` is read as [role]", async () => {
    const api = createMockApi();
    const w = await make(api, "สองบทบาท", ["BE", "FE"]);
    expect([w.roles, w.role]).toEqual([["BE", "FE"], "BE"]);
    const old = await api.createWorker({ name: "แบบเก่า", role: "QA", skills: ["role-qa"] });
    expect([old.roles, old.role]).toEqual([["QA"], "QA"]);
    expect((await api.workers()).find((x) => x.id === w.id)!.roles).toEqual(["BE", "FE"]);
  });

  test("BA is a role, and a thinking one: opus / medium", async () => {
    const ba = await make(createMockApi(), "นักวิเคราะห์", ["BA"]);
    expect([ba.model, ba.effort]).toEqual(["opus", "medium"]);
  });

  test("model and effort default to the strongest of the picked roles (haiku < sonnet < opus, low < medium < high); what is sent wins", async () => {
    const api = createMockApi();
    expect((await make(api, "ก", ["FE", "BE"])).model).toBe("sonnet");
    expect((await make(api, "ข", ["FE", "PM"])).model).toBe("opus"); // PM pulls the pair up
    expect((await make(api, "ค", ["FE", "BA"])).model).toBe("opus");
    expect((await make(api, "ง", ["other"])).model).toBe("sonnet");
    const sent = await make(api, "จ", ["PM", "SA"], { model: "haiku", effort: "high" });
    expect([sent.model, sent.effort]).toEqual(["haiku", "high"]);
  });

  test("roles: at least one, no repeats, a known word; both `role` and `roles`, or neither → 400 validation", async () => {
    const api = createMockApi();
    await expectRefusal(make(api, "ว่าง", []), 400, "validation");
    await expectRefusal(make(api, "ซ้ำ", ["FE", "FE"]), 400, "validation");
    await expectRefusal(make(api, "แปลก", ["WIZARD" as never]), 400, "validation");
    await expectRefusal(api.createWorker({ name: "ทั้งสอง", role: "FE", roles: ["FE"], skills: ["x"] } as never), 400, "validation");
    await expectRefusal(api.createWorker({ name: "ไม่มี", skills: ["x"] } as never), 400, "validation");
    expect((await api.workers()).some((w) => ["ว่าง", "ซ้ำ", "แปลก", "ทั้งสอง", "ไม่มี"].includes(w.name))).toBe(false);
  });

  test("combine is kept: a combined worker is roles [other]", async () => {
    const api = createMockApi();
    const [a, b] = (await api.workers()).slice(0, 2);
    const w = await api.combineWorkers("รวม", [a!.id, b!.id]);
    expect([w.role, w.roles]).toEqual(["other", ["other"]]);
  });
});

describe("updateWorker (PATCH /v1/workers/{id})", () => {
  test("sets only what is sent: changing roles leaves skills, model and effort alone", async () => {
    const api = createMockApi();
    const w = await make(api, "แก้ไข", ["FE"], { model: "haiku", effort: "low" });
    const u = await api.updateWorker(w.id, { roles: ["FE", "BE"] });
    expect(u).toMatchObject({ id: w.id, name: "แก้ไข", roles: ["FE", "BE"], role: "FE", skills: ["x"], model: "haiku", effort: "low" });
    const v = await api.updateWorker(w.id, { skills: ["x", "role-be"], model: "opus" });
    expect(v).toMatchObject({ roles: ["FE", "BE"], skills: ["x", "role-be"], model: "opus", effort: "low", name: "แก้ไข" });
    expect((await api.workers()).find((x) => x.id === w.id)).toEqual(v);
  });

  test("`role` follows roles[0] when the roles change", async () => {
    const api = createMockApi();
    const w = await make(api, "ลำดับ", ["FE", "BE"]);
    expect((await api.updateWorker(w.id, { roles: ["BE", "FE"] })).role).toBe("BE");
  });

  test("a rename is allowed to the same name, refused to another worker's name (409 name_taken)", async () => {
    const api = createMockApi();
    const w = await make(api, "ชื่อเดิม", ["QA"]);
    expect((await api.updateWorker(w.id, { name: "ชื่อเดิม" })).name).toBe("ชื่อเดิม");
    await expectRefusal(api.updateWorker(w.id, { name: "ปลา" }), 409, "name_taken");
    expect((await api.updateWorker(w.id, { name: "ชื่อใหม่" })).name).toBe("ชื่อใหม่");
  });

  test("nothing to change, bad values → 400 validation; an unknown worker → 404 — and nothing is written", async () => {
    const api = createMockApi();
    const w = await make(api, "ตรวจ", ["FE"]);
    await expectRefusal(api.updateWorker(w.id, {}), 400, "validation");
    await expectRefusal(api.updateWorker(w.id, { roles: [] }), 400, "validation");
    await expectRefusal(api.updateWorker(w.id, { roles: ["FE", "FE"] }), 400, "validation");
    await expectRefusal(api.updateWorker(w.id, { skills: [] }), 400, "validation");
    await expectRefusal(api.updateWorker(w.id, { name: "" }), 400, "validation");
    await expectRefusal(api.updateWorker("w-nope", { name: "x" }), 404, "not_found");
    expect((await api.workers()).find((x) => x.id === w.id)).toEqual(w);
  });

  test("a project's chain shows the worker as it is now", async () => {
    const api = createMockApi();
    const pla = (await api.chain(PID))!.members.find((m) => m.name === "ปลา")!;
    await api.updateWorker(pla.id, { roles: ["PM", "BA"] });
    expect((await api.chain(PID))!.members.find((m) => m.id === pla.id)!.roles).toEqual(["PM", "BA"]);
  });
});
