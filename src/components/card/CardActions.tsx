"use client";

// The operator's actions on a card (TASK-B-041): status and re-assign beside the title, answering on a question card, and the
// comment box under the timeline. Each calls a server action, then refreshes the page; a refusal is shown in words
// (`cardRefused`) in a role="alert" line beside the control that caused it.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { CardStatus, Worker } from "@/api/caw";
import { answerCard, assignCard, commentOn, setCardStatus, type ActionResult } from "@/app/p/[id]/c/[cardId]/actions";
import { acceptAnswer, answerOwn, assigneeLabel, cardRefused, column, columnOrder, commentPlaceholder, send, statusLabel } from "@/words";
import s from "./card.module.css";

const refusal = (r: ActionResult) => (r.ok ? null : cardRefused[r.code] ?? cardRefused.other!);

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const go = (fn: () => Promise<ActionResult>, after?: () => void) => start(async () => {
    setError(null);
    const r = await fn();
    setError(refusal(r));
    if (r.ok) after?.();
    router.refresh();
  });
  return { pending, error, go };
}

function Refused({ text }: { text: string | null }) {
  return text ? <p className={s.refused} role="alert">{text}</p> : null;
}

/** Status and assignee — a work card only. `กำลังทำ` is off while a card it depends on is open (the back end would refuse). */
export function CardControls({ projectId, cardId, status, assigneeId, members, blocked, depsId }: {
  projectId: string; cardId: string; status: CardStatus; assigneeId: string | null; members: Worker[]; blocked: boolean; depsId: string;
}) {
  const { pending, error, go } = useAction();
  const ids = { status: useId(), assignee: useId() };
  return (
    <div className={s.controls}>
      <div className={s.field}>
        <label htmlFor={ids.status} className={s.fieldLabel}>{statusLabel}</label>
        <Select value={status} disabled={pending} onValueChange={(v) => go(() => setCardStatus(projectId, cardId, v as CardStatus))}>
          <SelectTrigger id={ids.status} className={`${s.select} h-11 data-[size=default]:h-11 text-[15px]`} data-control="status" aria-describedby={blocked ? depsId : undefined}><SelectValue /></SelectTrigger>
          <SelectContent>
            {columnOrder.map((st) => <SelectItem key={st} value={st} className="min-h-11" disabled={st === "doing" && blocked && status !== "doing"}>{column[st]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className={s.field}>
        <label htmlFor={ids.assignee} className={s.fieldLabel}>{assigneeLabel}</label>
        <Select value={assigneeId ?? undefined} disabled={pending} onValueChange={(v) => go(() => assignCard(projectId, cardId, v))}>
          <SelectTrigger id={ids.assignee} className={`${s.select} h-11 data-[size=default]:h-11 text-[15px]`} data-control="assignee"><SelectValue /></SelectTrigger>
          <SelectContent>{members.map((w) => <SelectItem key={w.id} value={w.id} className="min-h-11">{w.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Refused text={error} />
    </div>
  );
}

/** A question card: take the proposed answer (ตามนั้น) or write your own. Once answered the card is done and leaves the strip. */
export function AnswerQuestion({ projectId, cardId, proposed }: { projectId: string; cardId: string; proposed: string }) {
  const { pending, error, go } = useAction();
  const [own, setOwn] = useState("");
  return (
    <div className={s.answer}>
      <Button className="min-h-11 px-5 font-semibold" disabled={pending} onClick={() => go(() => answerCard(projectId, cardId, proposed))} data-action="accept">
        {acceptAnswer}
      </Button>
      <form className={s.row} onSubmit={(e) => { e.preventDefault(); const t = own.trim(); if (t) go(() => answerCard(projectId, cardId, t), () => setOwn("")); }}>
        <Input className="h-11 text-[15px]" value={own} onChange={(e) => setOwn(e.target.value)} placeholder={answerOwn} aria-label={answerOwn} />
        <Button type="submit" variant="outline" className="min-h-11" disabled={pending || !own.trim()}>{send}</Button>
      </form>
      <Refused text={error} />
    </div>
  );
}

/** The comment box, under the timeline. */
export function CommentBox({ projectId, cardId }: { projectId: string; cardId: string }) {
  const { pending, error, go } = useAction();
  const [text, setText] = useState("");
  return (
    <form className={s.comment} onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) go(() => commentOn(projectId, cardId, t), () => setText("")); }}>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={commentPlaceholder} aria-label={commentPlaceholder}
        className="min-h-[72px] w-full resize-y rounded-md border border-hair2 bg-sheet px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink3" />
      <div className={s.commentRow}>
        <Refused text={error} />
        {/* one primary per screen (STUDY-002 B7): the card's primary is the answer's ตามนั้น; the comment's ส่ง is secondary */}
        <Button type="submit" variant="outline" className="min-h-11" disabled={pending || !text.trim()}>{send}</Button>
      </div>
    </form>
  );
}
