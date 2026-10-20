"use client";
// Keeps a screen current without a reload (D-063, D-088): while mounted it asks the server every 3 s whether the project's event log has grown and, if
// so, refreshes the page's server data (`router.refresh()`). No markup, no look — the screen that mounts it gives `after` (the newest seq at render
// time). Stops while the tab is hidden. It also refreshes when the team starts or stops running (TASK-B-109, REQ-015 AC-1): that writes no event, and
// the board and the chat show a line for it. What the page was drawn with is read once at mount: the team-down line (`[data-team-down]`) is there
// or not — so the first poll already knows whether the team flipped since the page was drawn.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { liveState } from "@/lib/liveEvents";
import { startPoller } from "@/lib/livePoll";

type Seen = { seq: number; running: boolean | null };
/** Refresh when the event log grew, or when the team's running flipped between two known values (null = not known, never a flip). */
export const needsRefresh = (seen: Seen, now: Seen) => now.seq > seen.seq || (seen.running !== null && now.running !== null && now.running !== seen.running);

export function LiveRefresh({ projectId, after }: { projectId: string; after: number }) {
  const router = useRouter();
  const seen = useRef<Seen>({ seq: after, running: null });
  useEffect(() => { seen.current = { ...seen.current, seq: Math.max(seen.current.seq, after) }; }, [after]); // a refresh brings a newer `after`
  useEffect(() => { seen.current = { ...seen.current, running: !document.querySelector("[data-team-down]") }; }, []); // as drawn
  useEffect(() => startPoller({
    visible: () => document.visibilityState === "visible",
    poll: async () => {
      const now = await liveState(projectId, seen.current.seq);
      const refresh = needsRefresh(seen.current, now);
      seen.current = { seq: Math.max(seen.current.seq, now.seq), running: now.running ?? seen.current.running };
      if (refresh) router.refresh();
    },
  }), [projectId, router]);
  return null;
}
