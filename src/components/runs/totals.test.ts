import { describe, expect, test } from "bun:test";
import type { Hop, Run } from "@/api/caw";
import { groupHops, hopWallMs, totalsOf } from "./totals";

const hop = (id: string, runId: string | null, start: string, end: string | null, tokens: [number, number] | null): Hop => ({
  id, projectId: "p", runId, claimedBy: runId ? "runner" : null, cardId: "c", workerId: "w", startedAt: start, endedAt: end, lastActivityAt: start,
  outcome: end ? "commented" : null, tokensIn: tokens?.[0] ?? null, tokensOut: tokens?.[1] ?? null, note: "",
});
const run = (id: string): Run => ({ id, projectId: "p", mode: "dispatcher", hopBudget: 3, startedAt: "2026-10-13T08:00:00+07:00", endedAt: null, stopReason: null, report: null, hopsUsed: 0 });

describe("totalsOf", () => {
  test("hops, wall time and tokens add up from the finished hops; a running hop counts as a hop and adds nothing else", () => {
    const hops = [
      hop("a", "r", "2026-10-13T08:00:00+07:00", "2026-10-13T08:00:38+07:00", [3100, 1100]),
      hop("b", "r", "2026-10-13T08:02:00+07:00", "2026-10-13T08:02:52+07:00", [4500, 1600]),
      hop("c", "r", "2026-10-13T08:05:00+07:00", null, null),
    ];
    expect(hops.map(hopWallMs)).toEqual([38_000, 52_000, 0]);
    expect(totalsOf(hops)).toEqual({ hops: 3, wallMs: 90_000, tokensIn: 7600, tokensOut: 2700 });
    expect(totalsOf([])).toEqual({ hops: 0, wallMs: 0, tokensIn: 0, tokensOut: 0 });
  });
});

describe("groupHops", () => {
  test("each run's hops oldest first; the hops with no run are the manual group; a hop of an unlisted run is left out", () => {
    const hops = [
      hop("m", null, "2026-10-13T09:00:00+07:00", "2026-10-13T09:01:00+07:00", [1, 1]),
      hop("r1b", "r1", "2026-10-13T08:02:00+07:00", "2026-10-13T08:03:00+07:00", [1, 1]),
      hop("r1a", "r1", "2026-10-13T08:00:00+07:00", "2026-10-13T08:01:00+07:00", [1, 1]),
      hop("old", "gone", "2026-10-12T08:00:00+07:00", "2026-10-12T08:01:00+07:00", [1, 1]),
    ];
    const g = groupHops([run("r1"), run("r2")], hops);
    expect(g.byRun.get("r1")!.map((h) => h.id)).toEqual(["r1a", "r1b"]);
    expect(g.byRun.get("r2")).toEqual([]);
    expect(g.manual.map((h) => h.id)).toEqual(["m"]);
    expect([...g.byRun.keys()]).toEqual(["r1", "r2"]);
  });
});
