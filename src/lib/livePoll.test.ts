// The poll loop behind LiveRefresh (D-063 → D-088, TASK-B-092): every 3 s, always; one poll at a time; nothing while the tab is hidden. Driven with a
// hand-made clock, so no test waits for real time.
import { describe, expect, test } from "bun:test";
import { POLL_MS, startPoller } from "./livePoll";

/** a clock the test winds by hand: `schedule` queues one callback, `advance(ms)` runs what is due */
const clock = () => {
  let now = 0;
  const queue: { at: number; fn: () => void; id: number }[] = [];
  let n = 0;
  return {
    schedule: (fn: () => void, ms: number) => { const id = ++n; queue.push({ at: now + ms, fn, id }); return () => { const i = queue.findIndex((q) => q.id === id); if (i >= 0) queue.splice(i, 1); }; },
    async advance(ms: number) {
      const end = now + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const next = queue[0];
        if (!next || next.at > end) break;
        queue.shift(); now = next.at; next.fn();
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      }
      now = end;
    },
    pending: () => queue.length,
  };
};

describe("startPoller", () => {
  test("the interval is 3 s", () => { expect(POLL_MS).toBe(3000); });

  test("polls every 3 s, always — never a 30 s idle wait (DEF-4: a hop started elsewhere shows within one tick)", async () => {
    const c = clock();
    let polls = 0;
    const stop = startPoller({ visible: () => true, poll: async () => { polls++; }, schedule: c.schedule });
    await c.advance(2999); expect(polls).toBe(0);
    await c.advance(1); expect(polls).toBe(1);
    await c.advance(3000); expect(polls).toBe(2);
    await c.advance(27_000); expect(polls).toBe(11);
    stop();
  });

  test("never two polls at once: a slow poll holds the next one back until it has finished", async () => {
    const c = clock();
    let inFlight = 0, maxInFlight = 0, polls = 0;
    let release: () => void = () => {};
    const stop = startPoller({
      visible: () => true, schedule: c.schedule,
      poll: () => new Promise<void>((resolve) => { polls++; inFlight++; maxInFlight = Math.max(maxInFlight, inFlight); release = () => { inFlight--; resolve(); }; }),
    });
    await c.advance(3000); expect(polls).toBe(1);
    await c.advance(20_000); expect(polls).toBe(1); // still waiting on the first
    release(); await c.advance(0);
    await c.advance(3000); expect(polls).toBe(2);
    release(); stop();
    expect(maxInFlight).toBe(1);
  });

  test("a hidden tab does not poll — it keeps the clock ticking and polls again once visible", async () => {
    const c = clock();
    let visible = false, polls = 0;
    const stop = startPoller({ visible: () => visible, poll: async () => { polls++; }, schedule: c.schedule });
    await c.advance(12_000); expect(polls).toBe(0);
    visible = true;
    await c.advance(3000); expect(polls).toBe(1);
    stop();
  });

  test("a poll that throws does not stop the loop", async () => {
    const c = clock();
    let polls = 0;
    const stop = startPoller({ visible: () => true, poll: async () => { polls++; throw new Error("down"); }, schedule: c.schedule });
    await c.advance(9000); expect(polls).toBe(3);
    stop();
  });

  test("stop() cancels what is waiting, and nothing polls after it", async () => {
    const c = clock();
    let polls = 0;
    const stop = startPoller({ visible: () => true, poll: async () => { polls++; }, schedule: c.schedule });
    await c.advance(3000); expect(polls).toBe(1);
    stop();
    expect(c.pending()).toBe(0);
    await c.advance(60_000); expect(polls).toBe(1);
  });

  test("stop() while a poll is still running: when that poll finishes nothing is scheduled again", async () => {
    const c = clock();
    let polls = 0, release: () => void = () => {};
    const stop = startPoller({ visible: () => true, schedule: c.schedule, poll: () => new Promise<void>((resolve) => { polls++; release = resolve; }) });
    await c.advance(3000); expect(polls).toBe(1);
    stop();
    release(); await c.advance(0);
    expect(c.pending()).toBe(0);
    await c.advance(60_000); expect(polls).toBe(1);
  });
});

// TASK-B-109 (REQ-015 AC-1): a runner's check-in writes no event, so LiveRefresh also refreshes when the team's running flips
import { needsRefresh } from "@/components/LiveRefresh";
describe("needsRefresh", () => {
  test("a newer seq refreshes; so does the team flipping, with no new seq", () => {
    expect(needsRefresh({ seq: 5, running: true }, { seq: 6, running: true })).toBe(true);
    expect(needsRefresh({ seq: 5, running: true }, { seq: 5, running: false })).toBe(true);
    expect(needsRefresh({ seq: 5, running: false }, { seq: 5, running: true })).toBe(true);
  });
  test("no new seq and no flip does not; an unknown running (the call failed) is no flip", () => {
    expect(needsRefresh({ seq: 5, running: true }, { seq: 5, running: true })).toBe(false);
    expect(needsRefresh({ seq: 5, running: true }, { seq: 5, running: null })).toBe(false);
    expect(needsRefresh({ seq: 5, running: null }, { seq: 5, running: false })).toBe(false); // the first answer only sets what was seen
  });
});
