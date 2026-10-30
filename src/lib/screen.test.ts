// screenOf's `open` (REQ-122): the team is running and this worker's CLI is open in this project. Against the mock, through the same seam the screen uses
// (`CAW_API=mock` and the one in-memory copy `@/api` hands out).
import { beforeEach, describe, expect, test } from "bun:test";
import { createMockApi } from "@/api/mock";
import { screenOf } from "./screen";

process.env.CAW_API = "mock";
const WORKER = "w-screen";
let mock: ReturnType<typeof createMockApi>;

beforeEach(() => { mock = createMockApi(); globalThis.__cawMock = mock; });

const firstProject = async () => (await mock.projects())[0]!.id;

describe("screenOf — open", () => {
  test("no session → open is false, and the rest of the answer still comes back", async () => {
    const pid = await firstProject();
    expect(await screenOf(pid, WORKER, -1)).toEqual({ hop: null, entries: [], more: false, open: false });
  });

  test("a session of this project and this worker → open is true", async () => {
    const pid = await firstProject();
    mock.setSessions([{ projectId: pid, workerId: WORKER, state: "idle" }]);
    expect((await screenOf(pid, WORKER, -1)).open).toBe(true);
  });

  test("a session of another project, or of another worker → open is false", async () => {
    const pid = await firstProject();
    mock.setSessions([{ projectId: "other-project", workerId: WORKER, state: "idle" }, { projectId: pid, workerId: "other-worker", state: "idle" }]);
    expect((await screenOf(pid, WORKER, -1)).open).toBe(false);
  });

  test("the team is down → open is false even with a session stored", async () => {
    const pid = await firstProject();
    mock.setSessions([{ projectId: pid, workerId: WORKER, state: "idle" }]);
    mock.setTeamRunning(false);
    expect((await screenOf(pid, WORKER, -1)).open).toBe(false);
  });

  test("a team status that throws → open is false and the answer still comes back", async () => {
    const pid = await firstProject();
    mock.teamStatus = async () => { throw new Error("down"); };
    expect(await screenOf(pid, WORKER, -1)).toEqual({ hop: null, entries: [], more: false, open: false });
  });
});
