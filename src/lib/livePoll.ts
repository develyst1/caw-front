// The loop behind LiveRefresh (D-063 → D-088 / TASK-B-092): ask "has anything changed?" every 3 s while the tab is visible — always, not only while a
// run or a hop is open. (With a 30 s idle wait a hop started elsewhere showed up only on the next 30 s tick, and the wait after that refresh was queued
// before React had the new `busy`, so it was 30 s again: QA's 18–24 s.) One poll at a time (the next wait starts only when the poll has finished),
// nothing while the tab is hidden, a failed poll does not stop the loop. The clock is injected so a test winds it by hand.
export const POLL_MS = 3000;

export interface PollerOptions {
  visible: () => boolean;
  poll: () => Promise<void>;
  /** queue `fn` after `ms`; returns the cancel (default: setTimeout) */
  schedule?: (fn: () => void, ms: number) => () => void;
}

const real = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); };

/** Starts the loop; the returned function stops it. */
export function startPoller({ visible, poll, schedule = real }: PollerOptions): () => void {
  let cancel: () => void = () => {};
  let stopped = false;
  const wait = () => { cancel = schedule(tick, POLL_MS); };
  const tick = async () => {
    if (stopped) return;
    if (visible()) { try { await poll(); } catch { /* the next tick tries again */ } }
    if (!stopped) wait();
  };
  wait();
  return () => { stopped = true; cancel(); };
}
