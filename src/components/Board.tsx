"use client";

// The board (REQ-011 R2; direction B, TASK-B-087; comps studies/REQ-014-direction-B/board.html + palettes P1): the roster (the filter), then what waits on
// you — each open question in its own sheet, `ตามนั้น` takes the proposed answer in one press, `ตอบเอง…` goes where it can be answered in words (the card for
// a card question, the chat with the question for the entry worker's) — then five columns divided by hairlines (no grey tubs, D-084), white cards with a
// hairline. A running card is in `กำลังทำ` because the core moves it there (v1.14); the screen never moves a card. At 1280 the five fit; below 768 the
// columns scroll sideways with a snap. No chat beside the board at any width (D-093): while the team waits on you in the chat without a structured
// question, one line at the top says so and leads to the แชต tab (TASK-B-098, D-094 § 0).
import {
  ArrowLeftRight, CircleAlert, CircleHelp, Database, FolderKanban, GitBranch, Plug, RefreshCw, Server, Smartphone, TriangleAlert, User, Waypoints, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { Card, CardStatus, ChatQuestion, Hop, Mode, Worker } from "@/api/caw";
import { answerQuestion, startStep } from "@/app/p/[id]/actions";
import { postMessageFor } from "@/app/p/[id]/chat/actions";
import { acceptText, canCarryOn } from "@/lib/crew";
import { CrewStrip, type SeatView } from "@/components/CrewStrip";
import { Avatar } from "@/components/Person";
import { Button } from "@/components/ui/button";
import { group, kindGroup } from "@/theme/tokens";
import { acceptAnswer, agreeStart, answerOwn, cardMark, labelWords, live, chatWaits as waitsWords, distill, oneAnswer, teamDown as downWords, cardRefused, column, columnOrder, partKind, proposedAnswer, redesign, section } from "@/words";

export type PartRef = { kind: string; title: string };

/** The team is not running (REQ-015 R1, SPEC-A-009 § 1b, TASK-B-104): one line in the stuck tone with the start command the back end gives
 *  (`TeamStatus.startCommand`, never written here). Not BackendDown — caw-back answered, only the team is down. It appears and leaves through the
 *  page's LiveRefresh, which watches the team's running too (TASK-B-109). */
export function TeamDown({ startCommand }: { startCommand: string }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-stuck-soft px-6 py-3 text-[15px] font-semibold text-stuck max-md:px-4" role="status" data-team-down>
      <span>{downWords.line}</span>
      <code className="select-all rounded-md bg-sheet px-2.5 py-1 font-mono text-sm font-normal text-ink [overflow-wrap:anywhere]" data-start-command>{startCommand}</code>
    </p>
  );
}
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

/** `carry`: this card's step can be started from here (crew.ts `canCarryOn`, D-105, TASK-B-121) — a `ทำต่อ` under the card's link, in the same item but never
 *  inside the link; `primary` makes it the board's one filled button. */
function WorkCard({ card, worker, part, waiting, carry = null }: {
  card: Card; worker: Worker | undefined; part: PartRef | undefined; waiting: boolean;
  carry?: { primary: boolean; pending: boolean; onPress: () => void; error: string | null } | null;
}) {
  return (
    <li className="grid gap-2">
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
        {(card.specChangedVersion !== null || card.anchorRemoved || waiting || card.stoppedMidway) && (
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {card.specChangedVersion !== null && <span className="inline-flex items-center gap-1 rounded-md bg-stuck-soft px-2 py-0.5 text-sm font-medium text-stuck"><RefreshCw className="size-3.5" aria-hidden />{cardMark.specChanged}</span>}
            {/* REQ-105 Q4: the part is gone from the spec — one line here, cut with an ellipsis; the whole sentence is in its title and on the card page */}
            {card.anchorRemoved && <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-stuck-soft px-2 py-0.5 text-sm font-medium text-stuck" title={labelWords.anchorRemoved} data-anchor-removed><CircleAlert className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{labelWords.anchorRemoved}</span></span>}
            {waiting && <span className="inline-flex items-center gap-1 rounded-md bg-now-soft px-2 py-0.5 text-sm font-medium text-now"><CircleHelp className="size-3.5" aria-hidden />{cardMark.waitingAnswer}</span>}
            {/* REQ-111: one line here, cut with an ellipsis when long; the whole sentence is in its title and on the card page */}
            {card.stoppedMidway && <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-stuck-soft px-2 py-0.5 text-sm font-medium text-stuck" title={cardMark.stoppedMidway(card.stoppedMidway.reason)} data-stopped-midway><CircleAlert className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{cardMark.stoppedMidway(card.stoppedMidway.reason)}</span></span>}
          </span>
        )}
      </a>
      {carry && (
        <>
          <Button variant={carry.primary ? "default" : "outline"} className="min-h-11 w-full font-semibold" disabled={carry.pending} onClick={carry.onPress} data-carry-on>{live.carryOn /* D-065 word, D-105 place */}</Button>
          {carry.error && <p className="m-0 rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{carry.error}</p>}
        </>
      )}
    </li>
  );
}

/** One thing that waits on you, in its own sheet: who asks about what, the question, the proposed answer, and the two ways to answer. */
/** `primary`: this sheet's `ตามนั้น` is the board's one filled button (B7) — otherwise it is outline (D-105 P1, TASK-B-119). */
function AskSheet({ meta, text, proposed, face, onAccept, ownHref, cardId, pending, error, primary }: {
  meta: string; text: string; proposed: string; face?: Worker; onAccept: () => void; ownHref: string; cardId?: string; pending: boolean; error: string | null; primary: boolean;
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
        <Button variant={primary ? "default" : "outline"} className="min-h-11 px-5 font-semibold" disabled={pending} onClick={onAccept} data-accept>{acceptAnswer}</Button>
        <Button asChild variant="outline" className="min-h-11"><a href={ownHref} data-answer-own>{answerOwn}</a></Button>
      </span>
      {error && <p className="col-span-full m-0 mt-2 rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{error}</p>}
    </li>
  );
}

/** `chatWaits`: the entry worker, while the newest chat message is theirs and has no questions (crew.ts `entryWaitsInChat`) — else null.
 *  `modeControl`: the project's mode, run state and stop — drawn right above the columns, where the run is watched (TASK-B-099, D-094 H-1).
 *  `proposalWaits`: the entry worker's newest reply carries an open proposal (crew.ts `proposalWaits`) — the notice says it waits for his agreement.
 *  `mode` / `hops`: in แบบสั่งทีละขั้น with nothing running, each workable card gets `ทำต่อ` (TASK-B-121).
 *  `teamDown`: the start command while the team is not running (TASK-B-104) — else null.
 *  `entry`: who takes work first — names the empty board's one button (TASK-B-100, B-2); `tellPrimary`: that button is the screen's primary
 *  unless an earlier first step (the folder) still holds it (B7: one primary per screen). */
export function Board({ projectId, cards, workers, parts, seats = [], chatAsk = null, chatWaits = null, modeControl = null, entry = null, tellPrimary = true, teamDown = null, proposalWaits = false, mode = "dispatcher", hops = [] }: {
  projectId: string; cards: Card[]; workers: Worker[]; parts: Record<string, PartRef>; seats?: SeatView[]; chatAsk?: ChatAsk; chatWaits?: Worker | null; modeControl?: ReactNode;
  entry?: Worker | null; tellPrimary?: boolean; teamDown?: string | null; proposalWaits?: boolean; mode?: Mode; hops?: Hop[];
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
  // D-105 P1: the entry person's questions are answered IN the chat — the post lands him there, on his own message (`/chat#m-{id}`), with Paul answering under it
  const acceptInChat = (key: string, answers: string[]) => start(async () => {
    setErrors((e) => ({ ...e, [key]: null }));
    const r = await postMessageFor(projectId, acceptText(answers));
    if (!r.ok) { setErrors((e) => ({ ...e, [key]: cardRefused[(r as { code: string }).code] ?? cardRefused.other! })); router.refresh(); return; }
    router.push(`/p/${projectId}/chat${r.id ? `#m-${r.id}` : ""}`);
  });
  // one filled button on the board (B7): with 2+ questions from the entry person, `ตามนั้นทุกข้อ` holds it; otherwise the first sheet's `ตามนั้น`
  const askAll = (chatAsk?.questions.length ?? 0) >= 2;
  const anyAsk = questions.length > 0 || !!chatAsk;
  // ทำต่อ (D-105, TASK-B-121): with no question open, the workable card with the lowest number holds the board's one filled button
  const carryIds = new Set(work.filter((c) => canCarryOn(c, mode, hops)).map((c) => c.id));
  const firstCarry = anyAsk ? null : [...work].filter((c) => carryIds.has(c.id)).sort((a, b) => a.number - b.number)[0]?.id ?? null;
  const carry = (c: Card) => !carryIds.has(c.id) ? null : {
    primary: c.id === firstCarry, pending, error: errors[`carry-${c.id}`] ?? null,
    onPress: () => start(async () => {
      setErrors((e) => ({ ...e, [`carry-${c.id}`]: null }));
      const r = await startStep(projectId, c.id, c.assigneeId!);
      // the state moved on (someone started a hop, or the card is no longer workable): the refresh shows it — nothing to say
      if (!r.ok && r.code !== "hop_running" && r.code !== "not_workable") setErrors((e) => ({ ...e, [`carry-${c.id}`]: cardRefused[r.code] ?? cardRefused.other! }));
      router.refresh();
    }),
  };

  return (
    <div className="grid min-w-0 gap-6" data-board>
      {teamDown !== null && <TeamDown startCommand={teamDown} />}
      {chatWaits && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-hair bg-sheet px-6 py-3 max-md:px-4" data-chat-waits>
          <Avatar name={chatWaits.name} avatar={chatWaits.avatar} size="md" />
          {/* D-105 P2 (TASK-B-120): when what waits is his proposal, the line says so — he agrees in the chat */}
          <p className="m-0 min-w-0 flex-1 text-[15px] font-semibold" data-chat-waits-line>{proposalWaits ? agreeStart.waiting(chatWaits.name) : waitsWords.line(chatWaits.name)}</p>
          {/* the board's one primary (B7) unless a card question already holds it */}
          <Button asChild variant={questions.length > 0 || firstCarry ? "outline" : "default"} className="min-h-11 px-5 font-semibold"><a href={`/p/${projectId}/chat`}>{waitsWords.go}</a></Button>
        </div>
      )}
      {seats.length > 0 && <CrewStrip projectId={projectId} seats={seats} chosen={chosen} onToggle={toggle} />}

      {askAll && chatAsk && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-hair bg-sheet px-6 py-3 max-md:px-4" data-ask-all>
          <Avatar name={chatAsk.entry.name} avatar={chatAsk.entry.avatar} size="md" />
          <p className="m-0 min-w-0 flex-1 text-[15px] font-semibold">{oneAnswer.asks(chatAsk.entry.name, chatAsk.questions.length)}</p>
          <Button className="min-h-11 px-5 font-semibold" disabled={pending} onClick={() => acceptInChat("chat-all", chatAsk.questions.map((q) => q.proposedDefault))} data-accept-all>{oneAnswer.acceptAll}</Button>
          {errors["chat-all"] && <p className="m-0 basis-full rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{errors["chat-all"]}</p>}
        </div>
      )}
      {anyAsk && (
        <ul className="m-0 grid list-none gap-3 p-0" aria-label={redesign.seatWaiting} data-asks>
          {questions.map((q, i) => (
            <AskSheet key={q.id} cardId={q.id} meta={parts[q.anchor.key] ? `${partKind[parts[q.anchor.key]!.kind] ?? ""} · ${parts[q.anchor.key]!.title}` : q.title}
              text={q.question?.text ?? q.title} proposed={q.question?.proposedDefault ?? ""} ownHref={`/p/${q.projectId}/c/${q.id}`}
              onAccept={() => answer(q.id, () => answerQuestion(projectId, q.id, q.question?.proposedDefault ?? ""))} pending={pending} error={errors[q.id] ?? null}
              primary={!askAll && i === 0} />
          ))}
          {chatAsk?.questions.map((q, i) => (
            <AskSheet key={`chat-${i}`} face={chatAsk.entry} meta={redesign.asks(chatAsk.entry.name, section.chat)} text={q.text} proposed={q.proposedDefault}
              ownHref={`/p/${projectId}/chat?answer=1`} /* an EMPTY box, focused, under the question — not the question as his draft (D-105) */
              onAccept={() => acceptInChat(`chat-${i}`, [q.proposedDefault])} pending={pending} error={errors[`chat-${i}`] ?? null}
              primary={!askAll && questions.length === 0 && i === 0} />
          ))}
        </ul>
      )}

      {modeControl}
      {/* B-7 / B-2: no cards yet → one sentence and one button in place of five empty columns; while the team waits, the notice above is the way in */}
      {cards.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[10px] border border-hair bg-sheet px-6 py-10 text-center max-md:px-4" data-board-empty>
          <p className="m-0 max-w-[48ch] text-[15px] text-ink2">{redesign.emptyBoard}</p>
          {entry && !chatWaits && <Button asChild variant={tellPrimary && !anyAsk ? "default" : "outline"} className="min-h-11 px-5 font-semibold"><a href={`/p/${projectId}/chat`} data-tell-entry>{distill.tellEntry(entry.name)}</a></Button>}
        </div>
      ) : (
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
                    waiting={c.dependsOn.some((d) => openQuestions.has(d))} carry={carry(c)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}
