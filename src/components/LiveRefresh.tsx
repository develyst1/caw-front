"use client";
// Keeps a screen current without a reload (D-063, D-088): while mounted it asks the server every 3 s whether the project's event log has grown and, if
// so, refreshes the page's server data (`router.refresh()`). No markup, no look — the screen that mounts it gives `after` (the newest seq at render
// time). Stops while the tab is hidden.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { newestSeq } from "@/lib/liveEvents";
import { startPoller } from "@/lib/livePoll";

export function LiveRefresh({ projectId, after }: { projectId: string; after: number }) {
  const router = useRouter();
  const seen = useRef(after);
  useEffect(() => { seen.current = Math.max(seen.current, after); }, [after]); // a refresh brings a newer `after`
  useEffect(() => startPoller({
    visible: () => document.visibilityState === "visible",
    poll: async () => {
      const seq = await newestSeq(projectId, seen.current);
      if (seq > seen.current) { seen.current = seq; router.refresh(); }
    },
  }), [projectId, router]);
  return null;
}
