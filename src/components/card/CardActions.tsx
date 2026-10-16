"use client";

// The operator's actions on a card (TASK-B-041): status and re-assign beside the title, answering on a question card, and the
// comment box under the timeline. Each calls a server action, then refreshes the page; a refusal is shown in words
// (`cardRefused`) in a role="alert" line beside the control that caused it.
import { Button, Input, Select } from "antd";
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
        <Select<CardStatus> id={ids.status} size="large" value={status} disabled={pending} className={s.select} data-control="status"
          aria-describedby={blocked ? depsId : undefined}
          options={columnOrder.map((st) => ({ value: st, label: column[st], disabled: st === "doing" && blocked && status !== "doing" }))}
          onChange={(v) => go(() => setCardStatus(projectId, cardId, v))} />
      </div>
      <div className={s.field}>
        <label htmlFor={ids.assignee} className={s.fieldLabel}>{assigneeLabel}</label>
        <Select<string> id={ids.assignee} size="large" value={assigneeId ?? undefined} disabled={pending} className={s.select} data-control="assignee"
          options={members.map((w) => ({ value: w.id, label: w.name }))}
          onChange={(v) => go(() => assignCard(projectId, cardId, v))} />
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
      <Button size="large" type="primary" disabled={pending} onClick={() => go(() => answerCard(projectId, cardId, proposed))} data-action="accept">
        {acceptAnswer}
      </Button>
      <form className={s.row} onSubmit={(e) => { e.preventDefault(); const t = own.trim(); if (t) go(() => answerCard(projectId, cardId, t), () => setOwn("")); }}>
        <Input size="large" value={own} onChange={(e) => setOwn(e.target.value)} placeholder={answerOwn} aria-label={answerOwn} />
        <Button size="large" htmlType="submit" disabled={pending || !own.trim()}>{send}</Button>
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
      <Input.TextArea size="large" autoSize={{ minRows: 2, maxRows: 8 }} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={commentPlaceholder} aria-label={commentPlaceholder} />
      <div className={s.commentRow}>
        <Refused text={error} />
        {/* one primary per screen (STUDY-002 B7): the card's primary is the answer's ตามนั้น; the comment's ส่ง is secondary */}
        <Button size="large" htmlType="submit" disabled={pending || !text.trim()}>{send}</Button>
      </div>
    </form>
  );
}
