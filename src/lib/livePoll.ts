// The loop behind LiveRefresh (D-063): ask "has anything changed?" every 3 s while a run or a hop is open, every 30 s otherwise. One poll at a time (the
// next wait starts only when the poll has finished), nothing while the tab is hidden, a failed poll does not stop the loop. The clock is injected so
// a test winds it by hand.
export const BUSY_MS = 3000;
export const IDLE_MS = 30000;

export interface PollerOptions {
  /** is a run or a hop open right now? read again before every wait, so a switch takes effect on the next one */
  busy: () => boolean;
  visible: () => boolean;
  poll: () => Promise<void>;
  /** queue `fn` after `ms`; returns the cancel (default: setTimeout) */
  schedule?: (fn: () => void, ms: number) => () => void;
}

const real = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); };

/** Starts the loop; the returned function stops it. */
export function startPoller({ busy, visible, poll, schedule = real }: PollerOptions): () => void {
  let cancel: () => void = () => {};
  let stopped = false;
  const wait = () => { cancel = schedule(tick, busy() ? BUSY_MS : IDLE_MS); };
  const tick = async () => {
    if (stopped) return;
    if (visible()) { try { await poll(); } catch { /* the next tick tries again */ } }
    if (!stopped) wait();
  };
  wait();
  return () => { stopped = true; cancel(); };
}
