"use client";

// The project's mode, one control (REQ-011 R5): แบบสั่งทีละขั้น ↔ อัตโนมัติ. Choosing อัตโนมัติ first asks for the hop budget
// (default 10, SPEC-B-002), then switches and opens a run; choosing แบบสั่งทีละขั้น switches at once. The page around it is
// never reset — only the header's mode and budget change.
import { Button, InputNumber, Popover, Segmented } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Mode } from "@/api/caw";
import { switchMode } from "@/app/p/[id]/actions";
import { budget, mode as modeWord } from "@/words";
import s from "./board.module.css";

const DEFAULT_BUDGET = 10;
// the field's label is the REQ's own `งบ {n} ก้าว` — the first half of the budget words, never a new word
const budgetLabel = (n: number) => budget(n, 0).split(" · ")[0]!;

export function ModeControl({ projectId, mode, hopBudget, hopsUsed }: { projectId: string; mode: Mode; hopBudget: number; hopsUsed: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [n, setN] = useState<number>(DEFAULT_BUDGET);
  const [pending, start] = useTransition();
  const go = (next: Mode, hops?: number) => start(async () => { await switchMode(projectId, next, hops); setAsking(false); router.refresh(); });

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
              <InputNumber size="large" min={1} max={500} value={n} onChange={(v) => setN(typeof v === "number" ? v : DEFAULT_BUDGET)} autoFocus />
            </label>
            <Button size="large" type="primary" htmlType="submit" loading={pending}>{modeWord.dispatcher}</Button>
          </form>
        }
      >
        <Segmented<Mode>
          size="large"
          value={mode}
          disabled={pending}
          options={[{ value: "manual", label: modeWord.manual }, { value: "dispatcher", label: modeWord.dispatcher }]}
          onChange={(next) => (next === "dispatcher" ? setAsking(true) : go("manual"))}
        />
      </Popover>
      <span className={s.budget}>{budget(hopBudget, hopsUsed)}</span>
    </div>
  );
}
