"use client";

// The board (REQ-011 R2, direction § 1): the question cards in one strip above the columns (shown once, only there — SA-B
// 2026-10-13); five uncoloured columns of work cards, `ติดอยู่` amber and `รอตรวจ` with a blue rule; a worker filter
// (none chosen = everyone, choosing narrows — no "everyone" word, SA-B Q2). At ≤ 640 px the columns scroll sideways with a
// snap and a peek, and a row of column chips (name + count) jumps to one.
import {
  ApiOutlined, BranchesOutlined, CloudServerOutlined, DatabaseOutlined, MobileOutlined, NodeIndexOutlined, ProjectOutlined,
  QuestionCircleOutlined, SwapOutlined, SyncOutlined, UserOutlined, WarningOutlined,
} from "@ant-design/icons";
import { Tag } from "antd";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { Card, CardStatus, Worker } from "@/api/caw";
import { group, kindGroup } from "@/theme/tokens";
import { cardMark, column, columnOrder } from "@/words";
import s from "./board.module.css";

export type PartRef = { kind: string; title: string };

const kindIcon: Record<string, ComponentType<{ "aria-hidden"?: boolean }>> = {
  work: ProjectOutlined, step: NodeIndexOutlined, interaction: SwapOutlined, role: UserOutlined, screen: MobileOutlined,
  api: ApiOutlined, system: CloudServerOutlined, data: DatabaseOutlined, decision: BranchesOutlined, question: QuestionCircleOutlined,
};

/** The spec part a card is about: Blueprint's kind icon and colour, then the part's name (the same look as its tile in Blueprint). */
function PartChip({ part }: { part: PartRef | undefined }) {
  if (!part) return null;
  const Icon = kindIcon[part.kind] ?? ProjectOutlined;
  const g = group[kindGroup[part.kind] ?? "journey"];
  return (
    <span className={s.part}>
      <span className={s.partIcon} style={{ color: g.fg, background: g.bg }}><Icon aria-hidden /></span>
      <span className={s.partName}>{part.title}</span>
    </span>
  );
}

function initial(name: string) { return [...name][0] ?? ""; }

function WorkCard({ card, worker, part, waiting }: { card: Card; worker: Worker | undefined; part: PartRef | undefined; waiting: boolean }) {
  return (
    <li>
      <article className={s.card} tabIndex={0} aria-labelledby={`t-${card.id}`} data-card={card.id}>
        <h3 id={`t-${card.id}`} className={s.title}>{card.title}</h3>
        <PartChip part={part} />
        <div className={s.foot}>
          {worker && <span className={s.worker}><span className={s.avatar} aria-hidden>{initial(worker.name)}</span>{worker.name}</span>}
          {(card.specChangedVersion !== null || waiting) && (
            <span className={s.marks}>
              {card.specChangedVersion !== null && <Tag className={s.markSpec} icon={<SyncOutlined aria-hidden />}>{cardMark.specChanged}</Tag>}
              {waiting && <Tag className={s.markWait} icon={<QuestionCircleOutlined aria-hidden />}>{cardMark.waitingAnswer}</Tag>}
            </span>
          )}
        </div>
      </article>
    </li>
  );
}

export function Board({ cards, workers, parts }: { cards: Card[]; workers: Worker[]; parts: Record<string, PartRef> }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const byId = new Map(workers.map((w) => [w.id, w]));
  const openQuestions = new Set(cards.filter((c) => c.kind === "question" && c.answer === null).map((c) => c.id));
  const questions = cards.filter((c) => openQuestions.has(c.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number);
  const work = cards.filter((c) => c.kind === "work" && (chosen.size === 0 || (c.assigneeId !== null && chosen.has(c.assigneeId))));
  const inColumn = (st: CardStatus) => work.filter((c) => c.status === st).sort((a, b) => a.number - b.number);
  const toggle = (id: string) => setChosen((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // the sideways row at ≤ 640 px: mark which ends have more, so the CSS fades that edge
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const mark = () => {
      const a = el.scrollLeft > 2, b = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      el.dataset.more = a && b ? "both" : a ? "start" : b ? "end" : "";
    };
    mark();
    el.addEventListener("scroll", mark, { passive: true });
    const ro = new ResizeObserver(mark);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", mark); ro.disconnect(); };
  }, []);

  return (
    <div className={s.board}>
      <div className={s.filter}>
        {workers.map((w) => (
          <Tag.CheckableTag key={w.id} checked={chosen.has(w.id)} onChange={() => toggle(w.id)} className={s.chip}>
            <span className={s.avatar} aria-hidden>{initial(w.name)}</span>{w.name}
          </Tag.CheckableTag>
        ))}
      </div>

      {questions.length > 0 && (
        <ul className={s.questions}>
          {questions.map((q) => (
            <li key={q.id}>
              <article className={s.question} tabIndex={0} aria-labelledby={`t-${q.id}`} data-card={q.id} data-question>
                <QuestionCircleOutlined aria-hidden className={s.questionIcon} />
                <div className={s.questionBody}>
                  <h3 id={`t-${q.id}`} className={s.questionText}>{q.question?.text ?? q.title}</h3>
                  <PartChip part={parts[q.anchor.key]} />
                </div>
                <Tag className={s.markWait} icon={<QuestionCircleOutlined aria-hidden />}>{cardMark.waitingAnswer}</Tag>
              </article>
            </li>
          ))}
        </ul>
      )}

      <nav className={s.jump}>
        {columnOrder.map((st) => (
          <a key={st} href={`#col-${st}`} className={st === "stuck" ? `${s.jumpChip} ${s.jumpStuck}` : s.jumpChip}>
            {column[st]} <span className={s.count}>{inColumn(st).length}</span>
          </a>
        ))}
      </nav>

      <div ref={row} className={s.columns}>
        {columnOrder.map((st) => {
          const list = inColumn(st);
          return (
            <section key={st} id={`col-${st}`} className={`${s.column} ${st === "stuck" ? s.colStuck : ""} ${st === "review" ? s.colReview : ""}`}
              aria-labelledby={`h-${st}`} data-column={st}>
              <h2 id={`h-${st}`} className={s.colHead}>
                {st === "stuck" && <WarningOutlined aria-hidden />}
                <span>{column[st]}</span>
                <span className={s.count}>{list.length}</span>
              </h2>
              <ul className={s.list}>
                {list.map((c) => (
                  <WorkCard key={c.id} card={c} worker={c.assigneeId ? byId.get(c.assigneeId) : undefined} part={parts[c.anchor.key]}
                    waiting={c.dependsOn.some((d) => openQuestions.has(d))} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
