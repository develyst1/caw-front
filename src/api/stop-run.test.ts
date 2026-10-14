// stopRun (D-056, TASK-B-055 DoD 1): the operator stops an open run. The mock ends it `operator_stopped` and leaves the mode alone; a
// second stop is 409 already_finished. Over http it is PATCH /v1/runs/{runId} with `{ stopReason: "operator_stopped", report: "" }` and
// the operator's actor header, and a 409 from caw-back comes back as the same CawError.
import { describe, expect, test } from "bun:test";
import { CawError } from "./caw";
import { createHttpApi } from "./http";
import { createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

describe("mock", () => {
  test("stopping an open run ends it operator_stopped; the mode is untouched; a second stop is 409 already_finished", async () => {
    const api = createMockApi();
    await api.setMode(PID, "dispatcher", 12);
    const open = await api.startRun(PID, 12);
    expect(open.endedAt).toBeNull();
    const stopped = await api.stopRun(open.id);
    expect([stopped.id, stopped.stopReason, stopped.endedAt !== null]).toEqual([open.id, "operator_stopped", true]);
    expect((await api.project(PID))!.mode).toBe("dispatcher");
    expect((await api.runs(PID, 1))[0]!.endedAt).not.toBeNull();
    const again = await api.stopRun(open.id).then(() => null, (e: unknown) => e);
    expect(again).toBeInstanceOf(CawError);
    expect([(again as CawError).status, (again as CawError).code]).toEqual([409, "already_finished"]);
    // a new run may start again (no run_open)
    expect((await api.startRun(PID, 5)).endedAt).toBeNull();
  });

  test("an unknown run is 404", async () => {
    const e = await createMockApi().stopRun("nope").then(() => null, (x: unknown) => x);
    expect([(e as CawError).status, (e as CawError).code]).toEqual([404, "not_found"]);
  });
});

describe("http", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const seen: { method: string; path: string; actor: string | null; body: unknown }[] = [];
  const api = (answer: () => Response) => createHttpApi({
    baseUrl: "http://caw.test",
    fetch: async (req) => {
      const text = await req.clone().text();
      seen.push({ method: req.method, path: new URL(req.url).pathname, actor: req.headers.get("X-CAW-Actor"), body: text ? JSON.parse(text) : undefined });
      return answer();
    },
  });

  test("PATCH /v1/runs/{runId} with operator_stopped and an empty report, as the operator", async () => {
    seen.length = 0;
    const r = await api(() => json(200, { id: "r1", stopReason: "operator_stopped", endedAt: "2026-10-14T10:00:00Z" })).stopRun("r1");
    expect(r.stopReason).toBe("operator_stopped");
    expect(seen).toEqual([{ method: "PATCH", path: "/v1/runs/r1", actor: "operator", body: { stopReason: "operator_stopped", report: "" } }]);
  });

  test("caw-back's 409 already_finished comes back as that CawError", async () => {
    const e = await api(() => json(409, { error: { code: "already_finished", message: "over" } })).stopRun("r1").then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(CawError);
    expect([(e as CawError).status, (e as CawError).code]).toEqual([409, "already_finished"]);
  });
});
