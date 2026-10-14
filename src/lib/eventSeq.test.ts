// `lastSeq` reads the log page by page: a log longer than one page still gives its newest seq.
import { describe, expect, test } from "bun:test";
import type { CawApi, CawEvent } from "@/api/caw";
import { lastSeq, withoutHeartbeats } from "./eventSeq";

const logOf = (n: number): CawEvent[] => Array.from({ length: n }, (_, i) => ({ seq: i + 1, at: "", actor: "operator", projectId: "p", type: "chat.posted" }));
const apiOver = (log: CawEvent[]) => { const reads: [number, number][] = []; return { reads, api: { events: async (_: string, q: { after?: number; limit?: number } = {}) => { reads.push([q.after ?? 0, q.limit ?? 0]); return log.filter((e) => e.seq > (q.after ?? 0)).slice(0, q.limit); } } as unknown as CawApi }; };

describe("lastSeq", () => {
  test("an empty log is `after` itself (0 by default)", async () => {
    expect(await lastSeq(apiOver([]).api, "p")).toBe(0);
    expect(await lastSeq(apiOver([]).api, "p", 7)).toBe(7);
  });
  test("nothing newer than `after` → `after`; something newer → the newest seq", async () => {
    expect(await lastSeq(apiOver(logOf(5)).api, "p", 5)).toBe(5);
    expect(await lastSeq(apiOver(logOf(5)).api, "p", 2)).toBe(5);
  });
  test("a log longer than a page (500) is read page by page to its end", async () => {
    const { api, reads } = apiOver(logOf(1203));
    expect(await lastSeq(api, "p")).toBe(1203);
    expect(reads).toEqual([[0, 500], [500, 500], [1000, 500]]);
    const exact = apiOver(logOf(1000));
    expect(await lastSeq(exact.api, "p")).toBe(1000); // a full last page costs one more (empty) read
    expect(exact.reads).toEqual([[0, 500], [500, 500], [1000, 500]]);
  });
});

describe("withoutHeartbeats", () => {
  const ev = (seq: number, type: string): CawEvent => ({ seq, at: "", actor: "runner:r1", projectId: "p", type });
  test("`hop.heartbeat` events (v1.11: one a minute while a hop runs) are left out of any timeline; everything else stays, in order", () => {
    const log = [ev(1, "hop.started"), ev(2, "hop.heartbeat"), ev(3, "card.commented"), ev(4, "hop.heartbeat"), ev(5, "hop.finished")];
    expect(withoutHeartbeats(log).map((e) => e.seq)).toEqual([1, 3, 5]);
    expect(withoutHeartbeats([])).toEqual([]);
  });
});

