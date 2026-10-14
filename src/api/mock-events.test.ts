// The project's event log on the mock (SPEC-A-008 l.85, `GET /v1/projects/{id}/events?after=&limit=`): every write the mock does appends one event,
// seq rising, oldest first — enough for the screens' live refresh to see "something changed" the way it will against caw-back.
import { describe, expect, test } from "bun:test";
import { createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

describe("events", () => {
  test("a fresh mock has no events; an unknown project has none either", async () => {
    const api = createMockApi();
    expect(await api.events(PID)).toEqual([]);
    expect(await api.events("p-nope")).toEqual([]);
  });

  test("every write appends one event of its project — seq rising by one, oldest first, with the actor, a time and the type", async () => {
    const api = createMockApi();
    const [c1] = await api.cards(PID);
    await api.comment(c1!.id, "สวัสดี");
    await api.setStatus(c1!.id, "doing");
    await api.postChat(PID, "ข้อความ");
    await api.setWorkspace(PID, ["/work/app"]);
    const evs = await api.events(PID);
    expect(evs.map((e) => e.type)).toEqual(["card.commented", "card.status_set", "chat.posted", "project.workspace_set"]);
    expect(evs.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect(evs.every((e) => e.projectId === PID && e.actor === "operator" && !Number.isNaN(Date.parse(e.at)))).toBe(true);
  });

  test("a refused write appends nothing", async () => {
    const api = createMockApi();
    await api.comment("c-nope", "x").catch(() => null);
    await api.setWorkspace(PID, ["relative"]).catch(() => null);
    expect(await api.events(PID)).toEqual([]);
  });

  test("after = a seq: only what came after it; limit caps the list (≤ 500); after past the end is empty", async () => {
    const api = createMockApi();
    for (let i = 0; i < 5; i++) await api.postChat(PID, `m${i}`);
    expect((await api.events(PID, { after: 2 })).map((e) => e.seq)).toEqual([3, 4, 5]);
    expect((await api.events(PID, { limit: 2 })).map((e) => e.seq)).toEqual([1, 2]);
    expect((await api.events(PID, { after: 1, limit: 2 })).map((e) => e.seq)).toEqual([2, 3]);
    expect(await api.events(PID, { after: 5 })).toEqual([]);
  });

  test("events belong to their project: a write in one project is not in another's log", async () => {
    const api = createMockApi({ state: "new-project" });
    const other = (await api.projects()).find((p) => p.id !== PID)!;
    await api.postChat(PID, "x");
    expect(await api.events(other.id)).toEqual([]);
    expect(await api.events(PID)).toHaveLength(1);
  });

  test("the writes of the chain, the workers and the runs are in the log too (so a team page refreshes on them)", async () => {
    const api = createMockApi();
    const w = await api.createWorker({ name: "ใหม่", roles: ["FE"], skills: ["x"] });
    await api.addMember(PID, w.id);
    await api.updateWorker(w.id, { name: "ใหม่2" });
    await api.setMode(PID, "dispatcher", 10);
    await api.startRun(PID, 3).catch(() => null);
    const types = (await api.events(PID)).map((e) => e.type);
    expect(types).toContain("chain.member_added");
    expect(types).toContain("project.mode_set");
  });
});
