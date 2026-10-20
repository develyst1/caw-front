"use client";

// One card (REQ-011 R3): where it sits in the spec FIRST — the part (kind word + name, Blueprint's icon), the parts it links to,
// the answered questions it rests on, and a link that opens the part in Blueprint — then what to do, the timeline of comments
// and hand-offs, and the cards it waits on. The operator's actions — status and re-assign under the title, answering on a
// question card, the comment box under the timeline — are in CardActions. Words only from src/words.ts. No back link of its own: the บอร์ด
// tab is marked current here (K-1, TASK-B-100).
import { CircleHelp, RefreshCw } from "lucide-react";
import type { Card, CardContext, Worker } from "@/api/caw";
import {
  card as cardWord, cardMark, column, decisionsHeading, dependsOnHeading, handoffLine, linkKind, linkedWith, operatorName,
  partKind, proposedAnswer, redesign, refusedHandoff, timelineHeading, todoHeading, toSpec, cardPage,
} from "@/words";
import { Avatar, Person } from "@/components/Person";
import { AnswerQuestion, CardControls, CommentBox } from "./CardActions";
import { Part, PartIcon } from "./Part";
import s from "./card.module.css";

const when = (iso: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));

/** `running`: who runs a hop on this card right now (TASK-B-088) — shown with the same "now" mark as the roster and the board. */
export function CardView({ projectId, ctx, workers, members, deps, blueprintHref, openQuestions, running = null }: {
  projectId: string; ctx: CardContext; workers: Worker[]; members: Worker[]; deps: Card[]; blueprintHref: string; openQuestions: string[]; running?: Worker | null;
}) {
  const { card, spec, notes, decisions } = ctx;
  const byId = new Map(workers.map((w) => [w.id, w]));
  const nameOf = (actorOrId: string | null) => {
    if (!actorOrId || actorOrId === "operator") return operatorName;
    const id = actorOrId.startsWith("worker:") ? actorOrId.slice(7) : actorOrId;
    return byId.get(id)?.name ?? id;
  };
  const worker = card.assigneeId ? byId.get(card.assigneeId) : undefined;
  // the worker behind a timeline actor (`worker:<id>`); the operator has no face here — the name `คุณ` says it
  const actorWorker = (actor: string | null) => (actor?.startsWith("worker:") ? byId.get(actor.slice(7)) : undefined);
  const waiting = card.dependsOn.some((d) => openQuestions.includes(d));
  const part = spec.part;
  const blocked = deps.some((d) => d.status !== "done"); // the back end refuses กำลังทำ until every dependency is done

  return (
    <div className={s.page}>
      <header className={s.head}>
        <h2 className={s.title}>{card.title}</h2>
        <div className={s.meta}>
          {/* status and assignee once each (TASK-B-088): a work card shows them as its two controls below; a question card has no controls */}
          {card.kind !== "work" && <span className={card.status === "stuck" ? s.tagStuck : s.tag}>{column[card.status]}</span>}
          {card.kind !== "work" && worker && <span className={s.worker}><Person name={worker.name} avatar={worker.avatar} roles={worker.roles} size="sm" /></span>}
          {running && <span className={s.now} data-running><Person name={running.name} avatar={running.avatar} size="sm" state="working" showRoles={false} /><span>{redesign.workingNow}</span></span>}
          {card.specChangedVersion !== null && <span className={s.markSpec}><RefreshCw aria-hidden className="size-3.5" />{cardMark.specChanged}</span>}
          {waiting && <span className={s.markWait}><CircleHelp aria-hidden className="size-3.5" />{cardMark.waitingAnswer}</span>}
        </div>
        {card.kind === "work" && (
          <CardControls projectId={projectId} cardId={card.id} status={card.status} assigneeId={card.assigneeId} members={members}
            blocked={blocked} depsId="deps" />
        )}
      </header>

      <div className={s.grid}>
        {/* where it sits in the spec — first in reading order, and the left column at 1440 */}
        <section className={s.spec} aria-labelledby="where">
          <h3 id="where" className={s.h2}>{cardWord.whereInSpec}</h3>
          <div className={s.partHead}>
            <PartIcon kind={part.kind} size="lg" />
            <div className={s.partText}>
              <span className={s.kind}>{partKind[part.kind] ?? part.kind}</span>
              <span className={s.partTitle}>{part.title}</span>
            </div>
          </div>
          <a className={s.toSpec} href={blueprintHref} data-blueprint>{toSpec}</a>

          {spec.neighbours.length > 0 && (
            <div className={s.block}>
              <h4 className={s.h3}>{linkedWith}</h4>
              <ul className={s.links}>
                {spec.neighbours.map((n, i) => (
                  <li key={i} className={s.linkRow}>
                    <span className={s.linkWord}>{linkKind[n.linkKind]?.[n.direction] ?? n.label ?? ""}</span>
                    <Part kind={n.part.kind} title={n.part.title} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {spec.decisions.length > 0 && (
            <div className={s.block}>
              <h4 className={s.h3}>{partKind.decision}</h4>
              <ul className={s.links}>{spec.decisions.map((d) => <li key={d.key}><Part kind={d.kind} title={d.title} /></li>)}</ul>
            </div>
          )}

          {decisions.length > 0 && (
            <div className={s.block}>
              <h4 className={s.h3}>{decisionsHeading}</h4>
              <ul className={s.answers}>
                {decisions.map((d) => <li key={d.cardId}><p className={s.q}>{d.question}</p><p className={s.a}>{d.answer}</p></li>)}
              </ul>
            </div>
          )}
        </section>

        <div className={s.work}>
          <section className={s.panel} aria-labelledby="todo">
            <h3 id="todo" className={s.h2}>{todoHeading}</h3>
            {card.kind === "question" && card.question ? (
              <div className={s.question}>
                <p className={s.questionText}>{card.question.text}</p>
                <p className={s.label}>{proposedAnswer}</p>
                <p>{card.question.proposedDefault}</p>
                {card.question.cases.length > 0 && <ul className={s.cases}>{card.question.cases.map((c) => <li key={c}>{c}</li>)}</ul>}
                {card.answer !== null
                  ? <p className={s.answered} data-answer>{card.answer}</p>
                  : <AnswerQuestion projectId={projectId} cardId={card.id} proposed={card.question.proposedDefault} />}
              </div>
            ) : (
              <p className={s.todo}>{card.todo}</p>
            )}
          </section>

          {deps.length > 0 && (
            <section className={s.panel} aria-labelledby="deps">
              <h3 id="deps" className={s.h2}>{dependsOnHeading}</h3>
              <ul className={s.deps}>
                {deps.map((d) => (
                  <li key={d.id}>
                    <a className={s.dep} href={`/p/${projectId}/c/${d.id}`}>
                      <span className={s.depTitle}>{d.title}</span>
                      <span className={d.status === "stuck" ? s.tagStuck : s.tag}>{column[d.status]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={s.panel} aria-labelledby="timeline">
            <h3 id="timeline" className={s.h2}>{timelineHeading}</h3>
            {notes.length === 0 && <p className={s.none} data-no-activity>{cardPage.noActivity}</p>}
            {notes.length > 0 && <ol className={s.timeline}>
              {notes.map((n) => (
                <li key={n.id} className={n.type === "handoff" ? `${s.note} ${s.handoff}` : n.type === "handoff_refused" ? `${s.note} ${s.refusedNote}` : s.note} data-note={n.type}>
                  <div className={s.noteHead}>
                    {n.type === "comment" && actorWorker(n.actor) && <Avatar name={actorWorker(n.actor)!.name} avatar={actorWorker(n.actor)!.avatar} size="sm" />}
                    <span className={s.who}>{n.type === "handoff" ? handoffLine(nameOf(n.fromWorkerId), nameOf(n.toWorkerId))
                      : n.type === "handoff_refused" ? refusedHandoff(nameOf(n.toWorkerId), nameOf(n.fromWorkerId)) /* v1.3, D-051 */
                      : nameOf(n.actor)}</span>
                    <time className={s.at} dateTime={n.at}>{when(n.at)}</time>
                  </div>
                  {n.text && <p className={s.noteText}>{n.text}</p>}
                </li>
              ))}
            </ol>}
            <CommentBox projectId={projectId} cardId={card.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
