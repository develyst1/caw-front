"use client";

// แชต (REQ-011 R7, REQ-013, TASK-B-050): the thread with the entry worker, oldest first, and the box to write to it.
//  · a worker's reply may ask questions — drawn like Blueprint's question cards: the question, คำตอบที่เสนอ, the cases;
//  · a reply that proposes cards shows each proposal on the operator message it answers, newest first: the estimate
//    `{n} งาน ใช้ประมาณ {h} ก้าว`, its items numbered (dependencies point at those numbers) with spec part, worker, what each waits
//    for; an open one has สร้างการ์ด, an accepted one says so, a superseded one reads as old and has no button;
//  · a reply that sent an amendment to Blueprint says so, with its link;
//  · an operator message the team failed to answer (its chat step ended, no reply, no retry asked — D-057) says so under it, with
//    ลองอีกครั้ง; once a retry is asked it reads as waiting again. It is a quiet note on the message, not an error.
// Writes are server actions; a refusal shows in words (`chatRefused`) beside its control.
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Button, Input, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type KeyboardEvent } from "react";
import type { ChatMessage, Proposal, Worker } from "@/api/caw";
import { acceptProposal, postMessage, retryMessage, type ChatResult } from "@/app/p/[id]/chat/actions";
import { Part } from "@/components/card/Part";
import { chat as words, chatRefused, operatorName, proposedAnswer, section, send } from "@/words";
import s from "./chat.module.css";

export type PartRef = { kind: string; title: string };

const when = (iso: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));
const refusal = (r: ChatResult) => (r.ok ? null : chatRefused[r.code] ?? chatRefused.other!);

function ProposalCard({ projectId, p, nameOf, parts }: { projectId: string; p: Proposal; nameOf: (id: string) => string; parts: Record<string, PartRef> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = () => start(async () => { const r = await acceptProposal(projectId, p.id); setError(refusal(r)); router.refresh(); });
  return (
    <section className={`${s.proposal} ${p.status === "superseded" ? s.superseded : ""}`} data-proposal={p.status} aria-label={words.estimate(p.items.length, p.hopsTotal)}>
      <div className={s.proposalHead}>
        <span className={s.estimate}>{words.estimate(p.items.length, p.hopsTotal)}</span>
        {p.status === "superseded" && <Tag className={s.tagOld}>{words.superseded}</Tag>}
        {p.status === "accepted" && <Tag className={s.tagDone}>{words.accepted}</Tag>}
      </div>
      <ol className={s.items}>
        {p.items.map((it, i) => {
          const part = parts[it.anchor.key];
          return (
            <li key={i} className={s.item}>
              <span className={s.num} aria-hidden>{i + 1}</span>
              <div className={s.itemBody}>
                <span className={s.itemTitle}>{it.title}</span>
                <span className={s.itemMeta}>
                  {part ? <Part kind={part.kind} title={part.title} withKind /> : <span className={s.key}>{it.anchor.key}</span>}
                  <span className={s.worker}><span className={s.avatar} aria-hidden>{[...nameOf(it.workerId)][0]}</span>{nameOf(it.workerId)}</span>
                  {it.dependsOn.length > 0 && <span className={s.waits}>{words.waitsFor(it.dependsOn.map((d) => d + 1).join(", "))}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {p.status === "open" && (
        <div className={s.proposalFoot}>
          <Button size="large" type="primary" onClick={create} loading={pending} data-create>{words.createCards}</Button>
          {error && <p className={s.refused} role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}

/** ทีมยังตอบข้อความนี้ไม่ได้ + ลองอีกครั้ง (SPEC-B-002 § A chat step that failed) */
function FailedStep({ projectId, messageId }: { projectId: string; messageId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const retry = () => start(async () => { const r = await retryMessage(projectId, messageId); setError(refusal(r)); router.refresh(); });
  return (
    <div className={s.failed} data-chat-failed>
      <span className={s.failedText}>{words.failed}</span>
      <Button size="large" onClick={retry} loading={pending}>{words.retry}</Button>
      {error && <p className={s.refused} role="alert">{error}</p>}
    </div>
  );
}

export function Chat({ projectId, messages, proposals, workers, parts }: {
  projectId: string; messages: ChatMessage[]; proposals: Proposal[]; workers: Worker[]; parts: Record<string, PartRef>;
}) {
  const router = useRouter();
  const byId = new Map(workers.map((w) => [w.id, w]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const author = (a: ChatMessage["author"]) => (a === "operator" ? operatorName : nameOf(a.slice("worker:".length)));
  // the proposals on each operator message, newest first; drawn under the worker's reply to that message
  const onMessage = (messageId: string) => proposals.filter((p) => p.messageId === messageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hint = useId();
  const sendIt = () => {
    const t = text.trim();
    if (!t || pending) return;
    start(async () => { const r = await postMessage(projectId, t); setError(refusal(r)); if (r.ok) setText(""); router.refresh(); });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendIt(); } };

  return (
    <div className={s.page}>
      <h2 className={s.h2}>{section.chat}</h2>
      {messages.length === 0 ? <p className={s.empty}>{words.empty}</p> : (
        <ol className={s.thread}>
          {messages.map((m) => {
            const mine = m.author === "operator";
            const failed = mine && m.replyHopId === null && !!m.chatHop?.endedAt && m.retryRequestedAt === null;
            return (
              <li key={m.id} className={mine ? `${s.msg} ${s.mine}` : s.msg} data-message={mine ? "operator" : "worker"}>
                <div className={s.bubble}>
                  <div className={s.msgHead}><span className={s.who}>{author(m.author)}</span><time className={s.at} dateTime={m.at}>{when(m.at)}</time></div>
                  <p className={s.text}>{m.text}</p>
                  {m.questions?.map((q, i) => (
                    <div key={i} className={s.question} data-question>
                      <p className={s.qText}><QuestionCircleOutlined aria-hidden className={s.qIcon} />{q.text}</p>
                      <p className={s.label}>{proposedAnswer}</p>
                      <p className={s.qAnswer}>{q.proposedDefault}</p>
                      {q.cases.length > 0 && <ul className={s.cases}>{q.cases.map((c) => <li key={c}>{c}</li>)}</ul>}
                    </div>
                  ))}
                  {m.amendment && (
                    <p className={s.amendment} data-amendment>{words.notInSpec} <a href={m.amendment.link}>{words.openAmendment}</a></p>
                  )}
                </div>
                {failed && <FailedStep projectId={projectId} messageId={m.id} />}
                {!mine && m.replyTo && onMessage(m.replyTo).map((p) => <ProposalCard key={p.id} projectId={projectId} p={p} nameOf={nameOf} parts={parts} />)}
              </li>
            );
          })}
        </ol>
      )}
      <form className={s.composer} onSubmit={(e) => { e.preventDefault(); sendIt(); }}>
        <Input.TextArea size="large" autoSize={{ minRows: 2, maxRows: 8 }} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          placeholder={words.placeholder} aria-label={words.placeholder} aria-describedby={hint} />
        <div className={s.composerRow}>
          <span id={hint} className={s.hint}>{words.enterHint}</span>
          {error && <p className={s.refused} role="alert">{error}</p>}
          <Button size="large" type="primary" htmlType="submit" disabled={pending || !text.trim()}>{send}</Button>
        </div>
      </form>
    </div>
  );
}
