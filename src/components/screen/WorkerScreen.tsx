"use client";

// A worker's read-only "screen" (REQ-104, SPEC-103 § caw-front): what the CLI of the worker's newest hop shows, drawn as plain lines in a side sheet like
// PersonDrawer's. It is opened only by the person pressing ดูหน้าจอ and has no input of any kind — nothing typed here could reach the CLI. While it is open,
// visible and the hop runs it asks the server every 2 s for the lines after the last one it has (`screenOf`); it stops when the hop has ended and nothing
// more waits, and starts again from the first line when the newest hop changes. A poll that fails keeps what is shown; the next one tries again.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { HopOutputEntry } from "@/api/caw";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { screenOf, type ScreenAnswer } from "@/lib/screen";
import { screen, teamPage } from "@/words";

export const SCREEN_POLL_MS = 2000;

const when = (iso: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));

interface View { hop: ScreenAnswer["hop"]; entries: HopOutputEntry[]; open: boolean }

function Line({ e }: { e: HopOutputEntry }) {
  if (e.kind === "gap") return <li className="py-1 text-sm font-semibold text-stuck" data-kind="gap">{screen.gap(e.gapSeconds ?? 0)}</li>;
  if (e.kind === "truncated") return <li className="py-1 text-sm font-semibold text-ink2" data-kind="truncated">{screen.truncated}</li>;
  return <li className="whitespace-pre-wrap [overflow-wrap:anywhere]" data-kind="line">{e.text}</li>;
}

export function WorkerScreen({ projectId, workerId, workerName, onClose }: { projectId: string; workerId: string; workerName: string; onClose: () => void }) {
  const [view, setView] = useState<View | null>(null); // null until the first answer
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // stay at the bottom unless the person has scrolled up

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hopId: string | null | undefined; // undefined: nothing asked yet
    let last = -1;
    const step = async () => {
      let again = true; // a failed or skipped poll tries again
      if (document.visibilityState === "visible") {
        try {
          let a = await screenOf(projectId, workerId, last);
          if (stopped) return;
          const now = a.hop?.id ?? null;
          const fresh = now !== hopId; // the first look, or the newest hop changed: start from the first line
          if (fresh && last !== -1) { a = await screenOf(projectId, workerId, -1); if (stopped) return; }
          hopId = a.hop?.id ?? null;
          last = a.entries.length > 0 ? a.entries[a.entries.length - 1]!.seq : fresh ? -1 : last;
          setView((prev) => (fresh || !prev ? { hop: a.hop, entries: a.entries, open: a.open } : { hop: a.hop, entries: [...prev.entries, ...a.entries], open: a.open }));
          again = !a.hop || a.hop.endedAt === null || a.more || a.open; // no hop yet: one may start; the worker's CLI is open (REQ-122): the next hop may start; ended, nothing more waiting and not open: stop
        } catch { /* keep what is shown; the next poll tries again */ }
      }
      if (!stopped && again) timer = setTimeout(step, SCREEN_POLL_MS);
    };
    void step();
    return () => { stopped = true; clearTimeout(timer); };
  }, [projectId, workerId]);

  // follow the newest line while the person is at the bottom
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [view?.entries.length]);

  const hop = view?.hop ?? null;
  const running = !!hop && hop.endedAt === null;
  const idle = !!view?.open && !running; // REQ-122: the CLI is open and waiting
  return (
    <Sheet open modal={false} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}
        className="gap-0 border-hair bg-sheet p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]" data-screen data-screen-worker={workerId}>
        <div className="flex items-start justify-between gap-4 border-b border-hair px-6 py-5">
          <div className="grid min-w-0 gap-1">
            <SheetTitle className="m-0 text-[22px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]" data-name title={workerName}>{screen.title(workerName)}</SheetTitle>
            <SheetDescription asChild>
              <div className="m-0 grid gap-0.5 text-sm text-ink2">
                {running && <span className="inline-flex min-h-[26px] w-fit items-center rounded-md bg-now-soft px-2 font-semibold text-now" data-live>{screen.live}</span>}
                {idle && <span className="inline-flex min-h-[26px] w-fit items-center rounded-md border border-hair px-2 font-semibold text-ink2" data-idle>{screen.idle}</span>}
                {hop && !running && <span data-ended>{screen.finished(when(hop.endedAt!))}</span>}
                {hop && <span data-started>{screen.started(when(hop.startedAt))}</span>}
                {view && !hop && !idle && <span data-none>{screen.empty}</span>}
              </div>
            </SheetDescription>
          </div>
          <Button variant="ghost" className="min-h-11 min-w-11 shrink-0" onClick={onClose}>{teamPage.close}</Button>
        </div>
        <div ref={box} role="log" aria-live="off" tabIndex={0} data-screen-lines
          onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-4 font-mono text-[13px] leading-relaxed text-ink">
          {hop && <ol className="m-0 grid list-none p-0">{view!.entries.map((e) => <Line key={e.seq} e={e} />)}</ol>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
