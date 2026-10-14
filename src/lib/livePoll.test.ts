// The poll loop behind LiveRefresh (D-063): every 3 s while a run or hop is open, every 30 s otherwise; one poll at a time; nothing while the tab
// is hidden. Driven with a hand-made clock, so no test waits for real time.
import { describe, expect, test } from "bun:test";
import { BUSY_MS, IDLE_MS, startPoller } from "./livePoll";

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
  test("the intervals are 3 s when busy and 30 s when not", () => {
    expect([BUSY_MS, IDLE_MS]).toEqual([3000, 30000]);
  });

  test("polls every 3 s while busy, every 30 s while idle — the interval is read again after each poll, so a switch takes effect on the next one", async () => {
    const c = clock();
    let busy = true, polls = 0;
    const stop = startPoller({ busy: () => busy, visible: () => true, poll: async () => { polls++; }, schedule: c.schedule });
    await c.advance(3000); expect(polls).toBe(1);
    await c.advance(3000); expect(polls).toBe(2);
    busy = false;
    await c.advance(3000); expect(polls).toBe(3); // the one already waiting still fires at 3 s; the next wait is 30 s
    await c.advance(29_000); expect(polls).toBe(3);
    await c.advance(1000); expect(polls).toBe(4);
    busy = true;
    await c.advance(30_000); expect(polls).toBe(5);
    await c.advance(3000); expect(polls).toBe(6);
    stop();
  });

  test("never two polls at once: a slow poll holds the next one back until it has finished", async () => {
    const c = clock();
    let inFlight = 0, maxInFlight = 0, polls = 0;
    let release: () => void = () => {};
    const stop = startPoller({
      busy: () => true, visible: () => true, schedule: c.schedule,
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
    const stop = startPoller({ busy: () => true, visible: () => visible, poll: async () => { polls++; }, schedule: c.schedule });
    await c.advance(12_000); expect(polls).toBe(0);
    visible = true;
    await c.advance(3000); expect(polls).toBe(1);
    stop();
  });

  test("a poll that throws does not stop the loop", async () => {
    const c = clock();
    let polls = 0;
    const stop = startPoller({ busy: () => true, visible: () => true, poll: async () => { polls++; throw new Error("down"); }, schedule: c.schedule });
    await c.advance(9000); expect(polls).toBe(3);
    stop();
  });

  test("stop() cancels what is waiting, and nothing polls after it", async () => {
    const c = clock();
    let polls = 0;
    const stop = startPoller({ busy: () => true, visible: () => true, poll: async () => { polls++; }, schedule: c.schedule });
    await c.advance(3000); expect(polls).toBe(1);
    stop();
    expect(c.pending()).toBe(0);
    await c.advance(60_000); expect(polls).toBe(1);
  });

  test("stop() while a poll is still running: when that poll finishes nothing is scheduled again", async () => {
    const c = clock();
    let polls = 0, release: () => void = () => {};
    const stop = startPoller({ busy: () => true, visible: () => true, schedule: c.schedule, poll: () => new Promise<void>((resolve) => { polls++; release = resolve; }) });
    await c.advance(3000); expect(polls).toBe(1);
    stop();
    release(); await c.advance(0);
    expect(c.pending()).toBe(0);
    await c.advance(60_000); expect(polls).toBe(1);
  });
});
