"use client";

// The project's mode, one control (REQ-011 R5): แบบสั่งทีละขั้น ↔ อัตโนมัติ. Choosing อัตโนมัติ first asks for the hop budget —
// the box starts at the project's own budget (the last one set; 10 only when none was ever set, D-051) — then switches and
// opens a run. With a run still open, nothing changes and the control says so beside it (DEF-2). Mode อัตโนมัติ whose run has
// stopped does not look like it is running: the last stop reason shows, with how to start the next run (D-052). Choosing
// แบบสั่งทีละขั้น switches at once. An open run, in either mode, has หยุดการรันนี้ beside กำลังรัน (D-056, B-056): it stops the run
// and leaves the mode, so on อัตโนมัติ the stopped line above takes over. The page around it is never reset — only the header's state changes.
import { Button, InputNumber, Popover, Segmented, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Mode, StopReason } from "@/api/caw";
import { stopOpenRun, switchMode } from "@/app/p/[id]/actions";
import { budget, cardRefused, mode as modeWord, runRunning, runStillOpen, runStopped, stopReason, stopThisRun } from "@/words";
import s from "./board.module.css";

const DEFAULT_BUDGET = 10;
// the field's label is the REQ's own `งบ {n} ก้าว` — the first half of the budget words, never a new word
const budgetLabel = (n: number) => budget(n, 0).split(" · ")[0]!;

export type LastRun = { open: boolean; stopReason: StopReason | null } | null;

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
      <Popover
        open={asking}
        onOpenChange={(o) => { if (!o) setAsking(false); }}
        trigger="click"
        placement="bottomRight"
        content={
          <form className={s.budgetAsk} onSubmit={(e) => { e.preventDefault(); go("dispatcher", n); }}>
            <label className={s.budgetLabel}>
              <span>{budgetLabel(n)}</span>
              <InputNumber size="large" min={1} max={500} value={n} onChange={(v) => setN(typeof v === "number" ? v : start0)} autoFocus data-budget />
            </label>
            <Button size="large" type="primary" htmlType="submit" loading={pending}>{modeWord.dispatcher}</Button>
          </form>
        }
      >
        <Segmented<Mode>
          size="large"
          value={mode}
          disabled={pending}
          className={stopped ? s.modeStopped : undefined}
          options={[{ value: "manual", label: modeWord.manual }, { value: "dispatcher", label: modeWord.dispatcher }]}
          onChange={(next) => (next === "dispatcher" ? ask() : go("manual"))}
        />
      </Popover>
      <span className={s.budget}>{budget(hopBudget, hopsUsed)}</span>
      {running && <Tag className={s.runTag} data-run-state="open">{runRunning}</Tag>}
      {running && <Button size="large" onClick={stop} loading={pending} data-stop-run>{stopThisRun}</Button>}
      {stopped && lastRun?.stopReason && (
        <span className={s.runStopped} data-run-state="stopped">
          <span id="caw-run-stopped" className={s.stopLine}>{runStopped(stopReason[lastRun.stopReason])}</span>
          {/* the Segmented's selected option fires no change, so the next run starts from a real button — also the keyboard path */}
          <Button size="large" onClick={ask} disabled={pending} aria-describedby="caw-run-stopped">{modeWord.dispatcher}</Button>
        </span>
      )}
      {error && <p className={s.modeError} role="alert">{error}</p>}
    </div>
  );
}
