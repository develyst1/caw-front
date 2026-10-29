// What a hop's CLI showed (REQ-104, SPEC-103): the mock's running hop grows with time, a finished hop's lines are fixed (one has a 12 s gap, one has none),
// `after` and `limit` work, and an unknown hop is a 404. The clock is wound by hand with setSystemTime.
import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { CawError } from "./caw";
import { createMockApi, MOCK_PROJECT_ID as PID } from "./mock";

afterEach(() => setSystemTime());

const ID = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("hop output on the mock", () => {
  test("the running hop's entries grow with time: one more line every 2 s since its start", async () => {
    const api = createMockApi();
    const hop = (await api.hops(PID)).find((h) => h.endedAt === null)!;
    const start = Date.parse(hop.startedAt);
    setSystemTime(new Date(start + 500));
    const a = await api.hopOutput(hop.id);
    setSystemTime(new Date(start + 6500));
    const b = await api.hopOutput(hop.id);
    expect(a.entries.map((e) => e.seq)).toEqual([0]);
    expect(b.entries.map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    expect(b.entries.every((e) => e.kind === "line" && e.gapSeconds === null && e.text !== "")).toBe(true);
    expect(b.entries.slice(0, a.entries.length)).toEqual(a.entries); // earlier lines never change
    expect(b.hopId).toBe(hop.id);
    expect(b.more).toBe(false);
  });

  test("a finished hop's entries are fixed whatever the time, and one holds a gap of 12 s", async () => {
    const api = createMockApi();
    const first = await api.hopOutput(ID(1));
    setSystemTime(new Date(Date.now() + 3_600_000));
    const later = await api.hopOutput(ID(1));
    expect(later).toEqual(first);
    const gap = first.entries.filter((e) => e.kind === "gap");
    expect(gap).toHaveLength(1);
    expect(gap[0]).toMatchObject({ gapSeconds: 12, text: "" });
    // seq rises and the gap sits between lines
    const seqs = first.entries.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(first.entries[first.entries.findIndex((e) => e.kind === "gap") - 1]!.kind).toBe("line");
    expect(first.entries[first.entries.findIndex((e) => e.kind === "gap") + 1]!.kind).toBe("line");
  });

  test("`after` returns only newer entries and `limit` cuts the page, with `more` saying so", async () => {
    const api = createMockApi();
    const all = (await api.hopOutput(ID(1))).entries;
    expect(all.length).toBeGreaterThanOrEqual(4);
    const tail = await api.hopOutput(ID(1), { after: all[1]!.seq });
    expect(tail.entries).toEqual(all.slice(2));
    expect(tail.more).toBe(false);
    const page = await api.hopOutput(ID(1), { after: -1, limit: 2 });
    expect(page.entries).toEqual(all.slice(0, 2));
    expect(page.more).toBe(true);
    const none = await api.hopOutput(ID(1), { after: all[all.length - 1]!.seq });
    expect(none.entries).toEqual([]);
    expect(none.more).toBe(false);
  });

  test("a hop with no output answers entries: []", async () => {
    const api = createMockApi();
    expect(await api.hopOutput(ID(5))).toEqual({ hopId: ID(5), entries: [], more: false });
  });

  test("an unknown hop is a 404 not_found", async () => {
    const api = createMockApi();
    const err = await api.hopOutput(ID(999)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CawError);
    expect(err).toMatchObject({ status: 404, code: "not_found" });
  });
});
