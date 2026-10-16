"use client";

// The board (REQ-011 R2; direction B, TASK-B-087; comps studies/REQ-014-direction-B/board.html + palettes P1): the roster (the filter), then what waits on
// you — each open question in its own sheet, `ตามนั้น` takes the proposed answer in one press, `ตอบเอง…` goes where it can be answered in words (the card for
// a card question, the chat with the question for the entry worker's) — then five columns divided by hairlines (no grey tubs, D-084), white cards with a
// hairline. A running card is in `กำลังทำ` because the core moves it there (v1.14); the screen never moves a card. At 1280 the five fit (the chat is
// behind its tab below 1440); below 768 the columns scroll sideways with a snap.
import {
  ArrowLeftRight, CircleHelp, Database, FolderKanban, GitBranch, Plug, RefreshCw, Server, Smartphone, TriangleAlert, User, Waypoints, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Card, CardStatus, ChatQuestion, Worker } from "@/api/caw";
import { answerQuestion } from "@/app/p/[id]/actions";
import { postMessage } from "@/app/p/[id]/chat/actions";
import { CrewStrip, type SeatView } from "@/components/CrewStrip";
import { Avatar } from "@/components/Person";
import { Button } from "@/components/ui/button";
import { group, kindGroup } from "@/theme/tokens";
import { acceptAnswer, answerOwn, cardMark, cardRefused, column, columnOrder, partKind, proposedAnswer, redesign, section } from "@/words";

export type PartRef = { kind: string; title: string };
/** The entry worker's open chat questions (crew.ts `entryQuestions`), for the "waits on you" sheet. */
export type ChatAsk = { entry: Worker; questions: ChatQuestion[] } | null;

const kindIcon: Record<string, LucideIcon> = {
  work: FolderKanban, step: Waypoints, interaction: ArrowLeftRight, role: User, screen: Smartphone,
  api: Plug, system: Server, data: Database, decision: GitBranch, question: CircleHelp,
};

/** The spec part a card is about: Blueprint's kind icon and colour, the kind word, then the part's name (… + `title` when long). */
function PartChip({ part }: { part: PartRef | undefined }) {
  if (!part) return null;
  const Icon = kindIcon[part.kind] ?? FolderKanban;
  const g = group[kindGroup[part.kind] ?? "journey"];
  const full = `${partKind[part.kind] ?? part.kind} · ${part.title}`;
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-ink2">
      <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ color: g.fg, background: g.bg }} aria-hidden><Icon className="size-3.5" /></span>
      <span className="name" title={full} data-part-name>{full}</span>
    </span>
  );
}

function WorkCard({ card, worker, part, waiting }: { card: Card; worker: Worker | undefined; part: PartRef | undefined; waiting: boolean }) {
  return (
    <li>
      <a href={`/p/${card.projectId}/c/${card.id}`} aria-labelledby={`t-${card.id}`} data-card={card.id}
        className={`grid gap-2.5 rounded-md border bg-sheet p-3.5 text-ink no-underline transition-colors hover:border-ink3 ${card.status === "stuck" ? "border-stuck" : "border-hair"}`}>
        <h3 id={`t-${card.id}`} className="clamp-2 m-0 text-[15px] font-semibold leading-snug" title={card.title}>{card.title}</h3>
        <PartChip part={part} />
        {worker && (
          <span className="flex min-w-0 items-center gap-2 text-sm text-ink2">
            <Avatar name={worker.name} avatar={worker.avatar} size="sm" />
            <span className="name" data-name title={worker.name}>{worker.name}</span>
          </span>
        )}
        {(card.specChangedVersion !== null || waiting) && (
          <span className="flex flex-wrap gap-1.5">
            {card.specChangedVersion !== null && <span className="inline-flex items-center gap-1 rounded-md bg-stuck-soft px-2 py-0.5 text-sm font-medium text-stuck"><RefreshCw className="size-3.5" aria-hidden />{cardMark.specChanged}</span>}
            {waiting && <span className="inline-flex items-center gap-1 rounded-md bg-now-soft px-2 py-0.5 text-sm font-medium text-now"><CircleHelp className="size-3.5" aria-hidden />{cardMark.waitingAnswer}</span>}
          </span>
        )}
      </a>
    </li>
  );
}

/** One thing that waits on you, in its own sheet: who asks about what, the question, the proposed answer, and the two ways to answer. */
function AskSheet({ meta, text, proposed, face, onAccept, ownHref, cardId, pending, error }: {
  meta: string; text: string; proposed: string; face?: Worker; onAccept: () => void; ownHref: string; cardId?: string; pending: boolean; error: string | null;
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[10px] border border-hair bg-sheet px-6 py-4 max-md:grid-cols-[auto_minmax(0,1fr)] max-md:px-4"
      data-ask={cardId ? "card" : "chat"}>
      {face ? <Avatar name={face.name} avatar={face.avatar} size="md" /> : <span className="grid size-9 place-items-center rounded-full bg-now-soft text-now" aria-hidden><CircleHelp className="size-5" /></span>}
      <span className="name col-start-2 text-sm text-ink2" title={meta}>{meta}</span>
      {/* a card question's text is the way to its card (the full card, its spec part, its timeline) */}
      <h2 className="col-start-2 m-0 text-[17px] font-semibold leading-snug" data-ask-text>
        {cardId ? <a href={ownHref} className="text-ink no-underline hover:underline hover:underline-offset-4" data-question data-card={cardId}>{text}</a> : text}
      </h2>
      <p className="col-start-2 m-0 text-sm text-ink2">{proposedAnswer} <b className="font-semibold text-ink">{proposed}</b></p>
      <span className="col-start-3 row-span-3 row-start-1 flex flex-wrap items-center gap-2 max-md:col-span-2 max-md:col-start-1 max-md:row-auto max-md:mt-2">
        <Button className="min-h-11 px-5 font-semibold" disabled={pending} onClick={onAccept} data-accept>{acceptAnswer}</Button>
        <Button asChild variant="outline" className="min-h-11"><a href={ownHref} data-answer-own>{answerOwn}</a></Button>
      </span>
      {error && <p className="col-span-full m-0 mt-2 rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{error}</p>}
    </li>
  );
}

export function Board({ projectId, cards, workers, parts, seats = [], chatAsk = null }: {
  projectId: string; cards: Card[]; workers: Worker[]; parts: Record<string, PartRef>; seats?: SeatView[]; chatAsk?: ChatAsk;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const byId = new Map(workers.map((w) => [w.id, w]));
  const openQuestions = new Set(cards.filter((c) => c.kind === "question" && c.answer === null).map((c) => c.id));
  const questions = cards.filter((c) => openQuestions.has(c.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number);
  const work = cards.filter((c) => c.kind === "work" && (chosen.size === 0 || (c.assigneeId !== null && chosen.has(c.assigneeId))));
  const inColumn = (st: CardStatus) => work.filter((c) => c.status === st).sort((a, b) => a.number - b.number);
  const toggle = (id: string) => setChosen((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const answer = (key: string, fn: () => Promise<{ ok: boolean; code?: string }>) => start(async () => {
    setErrors((e) => ({ ...e, [key]: null }));
    const r = await fn();
    if (!r.ok) setErrors((e) => ({ ...e, [key]: cardRefused[(r as { code: string }).code] ?? cardRefused.other! }));
    router.refresh();
  });

  return (
    <div className="grid min-w-0 gap-6" data-board>
      {seats.length > 0 && <CrewStrip seats={seats} chosen={chosen} onToggle={toggle} />}

      {(questions.length > 0 || chatAsk) && (
        <ul className="m-0 grid list-none gap-3 p-0" aria-label={redesign.seatWaiting} data-asks>
          {questions.map((q) => (
            <AskSheet key={q.id} cardId={q.id} meta={parts[q.anchor.key] ? `${partKind[parts[q.anchor.key]!.kind] ?? ""} · ${parts[q.anchor.key]!.title}` : q.title}
              text={q.question?.text ?? q.title} proposed={q.question?.proposedDefault ?? ""} ownHref={`/p/${q.projectId}/c/${q.id}`}
              onAccept={() => answer(q.id, () => answerQuestion(projectId, q.id, q.question?.proposedDefault ?? ""))} pending={pending} error={errors[q.id] ?? null} />
          ))}
          {chatAsk?.questions.map((q, i) => (
            <AskSheet key={`chat-${i}`} face={chatAsk.entry} meta={redesign.asks(chatAsk.entry.name, section.chat)} text={q.text} proposed={q.proposedDefault}
              ownHref={`/p/${projectId}/chat?draft=${encodeURIComponent(q.text)}`}
              onAccept={() => answer(`chat-${i}`, () => postMessage(projectId, q.proposedDefault))} pending={pending} error={errors[`chat-${i}`] ?? null} />
          ))}
        </ul>
      )}

      <div className="grid grid-cols-5 overflow-hidden rounded-[10px] border border-hair bg-sheet max-md:flex max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto" data-columns>
        {columnOrder.map((st) => {
          const list = inColumn(st), loud = st === "stuck" && list.length > 0;
          return (
            <section key={st} id={`col-${st}`} aria-labelledby={`h-${st}`} data-column={st}
              className="min-w-0 border-l border-hair px-4 pb-6 pt-4 first:border-l-0 max-md:w-[86%] max-md:flex-none max-md:snap-start">
              <h2 id={`h-${st}`} className={`m-0 flex items-baseline justify-between gap-2 px-1 pb-3.5 text-[15px] font-semibold ${loud ? "text-stuck" : "text-ink"}`}>
                <span className="flex items-center gap-1.5">{loud && <TriangleAlert className="size-4" aria-hidden />}{column[st]}</span>
                <span className="text-sm font-normal tabular-nums text-ink3">{list.length}</span>
              </h2>
              <ul className="m-0 grid list-none gap-2.5 p-0">
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
