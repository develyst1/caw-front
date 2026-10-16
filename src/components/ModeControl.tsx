"use client";

// The project's mode, one control (REQ-011 R5): แบบสั่งทีละขั้น ↔ อัตโนมัติ. Choosing อัตโนมัติ first asks for the hop budget —
// the box starts at the project's own budget (the last one set; 10 only when none was ever set, D-051) — then switches and
// opens a run. With a run still open, nothing changes and the control says so beside it (DEF-2). Mode อัตโนมัติ whose run has
// stopped does not look like it is running: the last stop reason shows, with how to start the next run (D-052). Choosing
// แบบสั่งทีละขั้น switches at once. An open run, in either mode, has หยุดการรันนี้ beside กำลังรัน (D-056, B-056): it stops the run
// and leaves the mode, so on อัตโนมัติ the stopped line above takes over. The page around it is never reset — only the header's state changes.
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Mode, StopReason } from "@/api/caw";
import { stopOpenRun, switchMode } from "@/app/p/[id]/actions";
import { modeLine } from "@/words";
import { budget, cardRefused, mode as modeWord, runRunning, runStillOpen, runStopped, stopReason, stopThisRun } from "@/words";
import s from "./board.module.css";

const DEFAULT_BUDGET = 10;
// the field's label is the REQ's own `งบ {n} ก้าว` — the first half of the budget words, never a new word
const budgetLabel = (n: number) => budget(n, 0).split(" · ")[0]!;

export type LastRun = { open: boolean; stopReason: StopReason | null; hopBudget: number; hopsUsed: number; mode: Mode } | null;

export function ModeControl({ projectId, mode, hopBudget, hopsUsed, lastRun }: {
  projectId: string; mode: Mode; hopBudget: number; hopsUsed: number; lastRun: LastRun;
}) {
  const router = useRouter();
  const start0 = hopBudget > 0 ? hopBudget : DEFAULT_BUDGET;
  const [asking, setAsking] = useState(false);
  const [n, setN] = useState<number>(start0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ask = () => { setError(null); setN(start0); setAsking(true); };
  const go = (next: Mode, hops?: number) => start(async () => {
    const r = await switchMode(projectId, next, hops);
    setError(r.ok ? null : r.code === "run_open" ? runStillOpen : (cardRefused[r.code] ?? cardRefused.other!));
    setAsking(false);
    router.refresh();
  });
  // หยุดการรันนี้: no confirm — stopping undoes no work, and the next run is one press away (frontend-finish: no needless dialog)
  const stop = () => start(async () => {
    const r = await stopOpenRun(projectId);
    setError(r.ok ? null : (cardRefused[r.code] ?? cardRefused.other!));
    router.refresh();
  });
  // อัตโนมัติ with no open run: stopped, not running (D-052)
  const stopped = mode === "dispatcher" && lastRun !== null && !lastRun.open;
  // an open run, whatever the mode (TASK-B-056): the runner may hold one open while the project is on แบบสั่งทีละขั้น
  const running = lastRun?.open === true;

  return (
    <div className={s.mode}>
      {/* TASK-B-085: the mode is a ToggleGroup (Radix, one of two — role radio). The chosen side is a filled indigo-tint object;
          on อัตโนมัติ that has stopped it is outlined only, so the header does not look like it is running (D-052). */}
      <ToggleGroup
        type="single"
        value={mode}
        disabled={pending}
        aria-label={`${modeWord.manual} / ${modeWord.dispatcher}`}
        spacing={0}
        variant="outline"
        className="rounded-lg"
        onValueChange={(next) => { if (next === "dispatcher") ask(); else if (next === "manual") go("manual"); }}
        data-mode-control
        data-stopped={stopped || undefined}
      >
        {(["manual", "dispatcher"] as const).map((m) => (
          <ToggleGroupItem key={m} value={m}
            className="min-h-11 px-4 text-[15px] text-ink2 data-[state=on]:bg-now-soft data-[state=on]:text-now data-[state=on]:font-semibold hover:bg-now-soft hover:text-ink group-data-[stopped]/toggle-group:data-[state=on]:bg-transparent group-data-[stopped]/toggle-group:data-[state=on]:text-ink2">
            {modeWord[m]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {/* อัตโนมัติ first asks for the budget (TASK-B-088: a small Radix Dialog; same words, same data-budget field) */}
      <Dialog open={asking} onOpenChange={(o) => { if (!o) setAsking(false); }}>
        <DialogContent showCloseButton={false} aria-describedby={undefined} className="w-[min(360px,calc(100vw-32px))] gap-4 border-hair bg-sheet p-6" data-budget-ask>
          <DialogTitle className="m-0 text-[17px] font-semibold text-ink">{modeWord.dispatcher}</DialogTitle>
          <form className={s.budgetAsk} onSubmit={(e) => { e.preventDefault(); go("dispatcher", n); }}>
            <label className={s.budgetLabel}>
              <span>{budgetLabel(n)}</span>
              <Input type="number" min={1} max={500} value={n} onChange={(e) => { const v = Number(e.target.value); setN(Number.isFinite(v) && v >= 1 ? Math.min(500, Math.round(v)) : start0); }}
                className="h-11 text-[15px]" autoFocus data-budget />
            </label>
            <Button type="submit" className="min-h-11 px-5 font-semibold" disabled={pending}>{modeWord.dispatcher}</Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* A4 (TASK-B-074): the budget only while an automatic run is open — that run's own งบ / ใช้ไป; otherwise nothing */}
      {running && lastRun!.mode === "dispatcher" && <span className={s.budget}>{budget(lastRun!.hopBudget, lastRun!.hopsUsed)}</span>}
      {running && <span className="inline-flex min-h-[26px] items-center rounded-md bg-now-soft px-2 text-sm font-semibold text-now" data-run-state="open">{runRunning}</span>}
      {running && <Button variant="outline" className="min-h-11" onClick={stop} disabled={pending} data-stop-run>{stopThisRun}</Button>}
      {stopped && lastRun?.stopReason && (
        <span className={s.runStopped} data-run-state="stopped">
          <span id="caw-run-stopped" className={s.stopLine}>{runStopped(stopReason[lastRun.stopReason])}</span>
          {/* the Segmented's selected option fires no change, so the next run starts from a real button — also the keyboard path */}
          <Button variant="outline" className="min-h-11" onClick={ask} disabled={pending} aria-describedby="caw-run-stopped">{modeWord.dispatcher}</Button>
        </span>
      )}
      {/* the mode switch explains itself (D-063, TASK-B-064): one line for the mode in effect */}
      <span className={s.modeLine} data-mode-line>{modeLine[mode]}</span>
      {error && <p className={s.modeError} role="alert">{error}</p>}
    </div>
  );
}
