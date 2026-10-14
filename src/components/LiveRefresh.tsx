"use client";
// Keeps a screen current without a reload (D-063): while mounted it asks the server whether the project's event log has grown and, if so, refreshes
// the page's server data (`router.refresh()`). No markup, no look — the screen that mounts it gives `after` (the newest seq at render time) and
// `busy` (a run or a hop is open: poll every 3 s, else every 30 s). Stops while the tab is hidden.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { newestSeq } from "@/lib/liveEvents";
import { startPoller } from "@/lib/livePoll";

export function LiveRefresh({ projectId, after, busy }: { projectId: string; after: number; busy: boolean }) {
  const router = useRouter();
  const seen = useRef(after);
  const isBusy = useRef(busy);
  useEffect(() => { isBusy.current = busy; }, [busy]);
  useEffect(() => { seen.current = Math.max(seen.current, after); }, [after]); // a refresh brings a newer `after`
  useEffect(() => startPoller({
    busy: () => isBusy.current,
    visible: () => document.visibilityState === "visible",
    poll: async () => {
      const seq = await newestSeq(projectId, seen.current);
      if (seq > seen.current) { seen.current = seq; router.refresh(); }
    },
  }), [projectId, router]);
  return null;
}
