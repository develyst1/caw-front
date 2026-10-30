"use client";

// แชต (REQ-011 R7, REQ-013, TASK-B-050 → direction B, TASK-B-087): the thread with the entry worker, oldest first, and the box to write to it.
//  · the head says who you talk to and what happens: `แชตกับ {entry}` / `เล่างาน แล้ว {entry} เสนอการ์ดให้` (D-083 (3), final);
//  · your own message sits in the indigo tint (as messaging apps mark "you"); the worker's reply on white with its face (D-084);
//  · a worker's reply may ask questions — the question, คำตอบที่เสนอ, the cases;
//  · a reply that proposes cards shows each proposal on the operator message it answers, newest first: the estimate, its items numbered (dependencies
//    point at those numbers) with spec part, worker, what each waits for; an open one has สร้างการ์ด, an accepted one says so, a superseded one reads as old;
//  · a reply that sent an amendment to Blueprint says so, with its link;
//  · an operator message the team failed to answer (D-057) says so under it, with ลองอีกครั้ง.
// The แชต tab is its only place (D-093: no panel beside the board). The box stays at the bottom while the thread scrolls;
// the thread keeps room under its last message so the box never covers it (AC-5). Writes are server actions; a refusal shows in words.
import { ArrowUp, CircleHelp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import type { ChatMessage, CodeMap, Mode, Proposal, Worker } from "@/api/caw";
import { acceptProposal, postMessage, retryMessage, type ChatResult } from "@/app/p/[id]/chat/actions";
import { Part } from "@/components/card/Part";
import { Uncovered, type UncoveredItem } from "@/components/Uncovered";
import { Avatar } from "@/components/Person";
import { Button } from "@/components/ui/button";
import { acceptText, answeredWith } from "@/lib/crew";
import { acceptAnswer, agreeStart, answerOwn, chatHead, chat as words, chatRefused, codeMapWords, distill, live, oneAnswer, operatorName, proposedAnswer, section, send, teamDown as downWords } from "@/words";

export type PartRef = { kind: string; title: string };

/** C-2 (TASK-B-100, D-094 — the screen's fix, the runner is untouched): a reply that sent an amendment may open with the same sentence the
 *  amendment box says, plus a Blueprint message id. That first line is dropped — the box below keeps the sentence and its link — so no id is shown. */
export function replyText(m: Pick<ChatMessage, "text" | "amendment">): string {
  if (!m.amendment) return m.text;
  const [first, ...rest] = m.text.split("\n");
  return first!.trimStart().startsWith(words.notInSpec) ? rest.join("\n").trimStart() : m.text;
}

const when = (iso: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));
const refusal = (r: ChatResult) => (r.ok ? null : chatRefused[r.code] ?? chatRefused.other!);
const Refused = ({ text }: { text: string | null }) => (text ? <p className="m-0 rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{text}</p> : null);

/** The proposal is the agreement (D-105 P2, TASK-B-120): `ตกลง เริ่มงาน` accepts it, after one line saying what happens in the project's mode; while the entry
 *  person still has a question open (`waitFor` = their name) it is off, and says why. */
function ProposalCard({ projectId, p, byId, parts, primary, mode, waitFor, uncovered = [] }: {
  projectId: string; p: Proposal; byId: Map<string, Worker>; parts: Record<string, PartRef>; primary: boolean; mode: Mode | null; waitFor: string | null; uncovered?: UncoveredItem[];
}) {
  const reason = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = () => start(async () => { const r = await acceptProposal(projectId, p.id); setError(refusal(r)); router.refresh(); });
  const old = p.status === "superseded";
  return (
    <section className={`grid w-full max-w-[640px] gap-2.5 rounded-md border bg-sheet px-4 py-3.5 ${old ? "border-dashed border-hair2 text-ink2" : "border-hair"}`}
      data-proposal={p.status} aria-label={words.estimate(p.items.length, p.hopsTotal)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums">{words.estimate(p.items.length, p.hopsTotal)}</span>
        {old && <span className="rounded-md border border-hair2 px-2 py-0.5 text-sm text-ink2">{words.superseded}</span>}
        {p.status === "accepted" && <span className="rounded-md bg-now-soft px-2 py-0.5 text-sm font-semibold text-now">{words.accepted}</span>}
      </div>
      {/* REQ-112: the rules this proposal still leaves without a card — advisory, only while it is open, before "ตกลง" */}
      {p.status === "open" && <Uncovered items={uncovered} />}
      <ol className="m-0 grid list-none gap-2.5 p-0">
        {p.items.map((it, i) => {
          const part = parts[it.anchor.key], w = byId.get(it.workerId);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-now-soft text-sm font-semibold tabular-nums text-now" aria-hidden>{i + 1}</span>
              <div className="grid min-w-0 gap-1">
                <span className="font-semibold leading-snug">{it.title}</span>
                <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-ink2">
                  {part ? <Part kind={part.kind} title={part.title} withKind /> : <span>{it.anchor.key}</span>}
                  <span className="inline-flex min-w-0 items-center gap-1.5"><Avatar name={w?.name ?? it.workerId} avatar={w?.avatar ?? null} size="sm" /><span className="name" data-name title={w?.name}>{w?.name ?? it.workerId}</span></span>
                  {it.dependsOn.length > 0 && <span className="font-semibold">{words.waitsFor(it.dependsOn.map((d) => d + 1).join(", "))}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {p.status === "open" && (
        <div className="grid gap-2 border-t border-hair pt-3" data-agree>
          {mode && <p className="m-0 text-sm text-ink2" data-agree-what>{mode === "dispatcher" ? agreeStart.dispatcher(p.items.length) : agreeStart.manual(p.items.length)}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button variant={primary && !waitFor ? "default" : "outline"} className="min-h-11 px-5 font-semibold" onClick={create} disabled={pending || !!waitFor}
              aria-describedby={waitFor ? reason : undefined} data-create>{agreeStart.agree}</Button>
            {waitFor && <span id={reason} className="text-sm font-semibold text-stuck" data-agree-why>{agreeStart.answerFirst(waitFor)}</span>}
            <Refused text={error} />
          </div>
        </div>
      )}
    </section>
  );
}

/** ทีมยังตอบข้อความนี้ไม่ได้ + ลองอีกครั้ง (SPEC-B-002 § A chat step that failed) — a calm note under the message, not an error */
function FailedStep({ projectId, messageId }: { projectId: string; messageId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const retry = () => start(async () => { const r = await retryMessage(projectId, messageId); setError(refusal(r)); router.refresh(); });
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2" data-chat-failed>
      <span className="text-sm font-semibold text-ink2">{words.failed}</span>
      <Button variant="outline" className="min-h-11" onClick={retry} disabled={pending}>{words.retry}</Button>
      <Refused text={error} />
    </div>
  );
}

/** `teamDown`: the team is not running (TASK-B-104) — sending still works, and one line under the box says the message waits.
 *  `answering`: the entry worker has an open chat hop (TASK-B-114, D-103) — one quiet line under the thread says so, live for screen readers.
 *  `codeMap`: the project's code map (TASK-B-106) — while it is not confirmed, the newest worker reply saved at or after it links to it on ทีม. */
/** `openId`: the entry worker's reply whose questions are still open (crew.ts `entryQuestions`) — they carry the same `ตามนั้น` / `ตอบเอง…` pair as the
 *  board (D-105 P1, TASK-B-119); questions on any other reply read `ตอบแล้ว`. `focusBox`: arrived by the board's `ตอบเอง…` — the empty box is focused. */
export function Chat({ projectId, messages, proposals, workers, parts, entry, teamDown = false, codeMap = null, answering = false, openId = null, focusBox = false, mode = null, uncovered = {} }: {
  projectId: string; messages: ChatMessage[]; proposals: Proposal[]; workers: Worker[]; parts: Record<string, PartRef>; entry: Worker | null; teamDown?: boolean;
  codeMap?: CodeMap | null; answering?: boolean; openId?: string | null; focusBox?: boolean; mode?: Mode | null; uncovered?: Record<string, UncoveredItem[]>; /* by open proposal id (REQ-112) */
}) {
  const router = useRouter();
  const byId = new Map(workers.map((w) => [w.id, w]));
  const workerOf = (a: ChatMessage["author"]) => (a === "operator" ? undefined : byId.get(a.slice("worker:".length)));
  // one primary per screen (B7): only the newest open proposal's สร้างการ์ด is primary
  const newestOpen = [...proposals].filter((p) => p.status === "open").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
  // the core sends no "this reply delivered a map" flag: the setup step saves the map, then replies — so the newest worker reply at or after the map's time
  // is the one that delivered it (interpreted in TASK-B-106)
  const newestWorker = messages.findLast((m) => m.author !== "operator");
  const mapReply = codeMap && codeMap.confirmedAt === null && newestWorker && Date.parse(newestWorker.at) >= Date.parse(codeMap.updatedAt) ? newestWorker.id : null;
  const onMessage = (messageId: string) => proposals.filter((p) => p.messageId === messageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sendIt = () => {
    const t = text.trim();
    if (!t || pending) return;
    start(async () => { const r = await postMessage(projectId, t); setError(refusal(r)); if (r.ok) setText(""); router.refresh(); });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendIt(); } };
  const placeholder = entry ? distill.placeholder(entry.name) : words.placeholder; // C-1: names who you write to
  // P3 (D-105, TASK-B-118): the PAGE scrolls (its bar at the window's edge) — it opens at the newest message, and comes back there when one arrives
  // …except on arrival with `#m-{id}` (the board's `ตามนั้น` lands on his own message): that message is brought into view instead, once
  const landed = useRef(false);
  useEffect(() => {
    const target = !landed.current && location.hash.startsWith("#m-") ? document.getElementById(location.hash.slice(1)) : null;
    landed.current = true;
    if (target) target.scrollIntoView({ block: "center" }); else window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [messages.length]);
  // the open questions' own answer: `ตามนั้น` posts `ตามนั้น — {answer}` (the board's text); `ตอบเอง…` focuses the box
  const accept = (answer: string) => start(async () => { const r = await postMessage(projectId, acceptText([answer])); setError(refusal(r)); router.refresh(); });
  useEffect(() => { if (focusBox) box.current?.focus(); }, [focusBox]);
  // the box grows with the text up to about 6 lines (its CSS max-height), then scrolls inside itself — no resize grip
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }, [text]);

  return (
    // P3 (TASK-B-118): one column in the page's own flow, at least a screen tall (so a short thread still has the box at the bottom); the page scrolls,
    // and the box is sticky at the bottom of the window
    <div className="mx-auto grid min-h-[calc(100dvh-74px-var(--caw-sample-bar,0px))] w-full max-w-[880px] grid-rows-[auto_1fr_auto] content-start gap-4 px-6 pt-6 max-md:min-h-[calc(100dvh-110px-var(--caw-sample-bar,0px))] max-md:gap-3 max-md:px-4 max-md:pt-4" data-chat>
      <h2 className="m-0 text-[17px] font-semibold" data-chat-title>{entry ? chatHead.title(entry.name) : section.chat}</h2>
      {messages.length === 0 ? <p className="m-0 rounded-[10px] border border-dashed border-hair2 bg-sheet p-6 text-center text-ink2">{words.empty}</p> : (
        <ol className="m-0 grid list-none content-start gap-5 p-0" data-thread>
          {messages.map((m) => {
            const mine = m.author === "operator", w = workerOf(m.author);
            const failed = mine && m.replyHopId === null && !!m.chatHop?.endedAt && m.retryRequestedAt === null;
            return (
              <li key={m.id} id={`m-${m.id}`} className={`grid gap-2.5 ${mine ? "justify-items-end" : "justify-items-start"}`} data-message={mine ? "operator" : "worker"}>
                <div className={`grid max-w-[min(640px,92%)] gap-1.5 rounded-xl px-4 py-3 ${mine ? "bg-now-soft" : "border border-hair bg-sheet"}`} data-bubble>
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    {w && <Avatar name={w.name} avatar={w.avatar} size="sm" />}
                    <b className="name font-semibold text-ink" data-name title={mine ? operatorName : w?.name}>{mine ? operatorName : w?.name ?? m.author}</b>
                    <time className="shrink-0 tabular-nums text-ink3" dateTime={m.at}>{when(m.at)}</time>
                  </div>
                  <p className="m-0 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">{mine ? m.text : replyText(m)}</p>
                  {m.questions?.map((q, i) => (
                    // C-3: no frame — an indent, with the ? icon hanging in it
                    <div key={i} className="mt-1.5 grid gap-1 pl-6" data-question data-chat-question>
                      <p className="m-0 -ml-6 flex items-start gap-2 font-semibold leading-normal"><CircleHelp className="mt-1 size-4 shrink-0 text-now" aria-hidden />{q.text}</p>
                      {m.id === openId ? (<>
                        <p className="m-0 mt-1 text-sm text-ink2">{proposedAnswer}</p>
                        <p className="m-0 font-semibold">{q.proposedDefault}</p>
                        {q.cases.length > 0 && <ul className="m-0 mt-0.5 grid gap-0.5 pl-5 text-ink2">{q.cases.map((c) => <li key={c}>{c}</li>)}</ul>}
                        {/* the board's pair, here too (D-105 P1): the first open question's ตามนั้น is the screen's one filled button */}
                        <span className="mt-2 flex flex-wrap gap-2" data-chat-answer>
                          <Button variant={i === 0 ? "default" : "outline"} className="min-h-11 px-5 font-semibold" disabled={pending} onClick={() => accept(q.proposedDefault)} data-accept>{acceptAnswer}</Button>
                          <Button variant="outline" className="min-h-11" onClick={() => box.current?.focus()} data-answer-own>{answerOwn}</Button>
                        </span>
                      </>) : (
                        <p className="m-0 text-sm text-ink2" data-answered>{oneAnswer.answered(answeredWith(messages, m, q))}</p>
                      )}
                    </div>
                  ))}
                  {m.amendment && (
                    <p className="m-0 mt-1 rounded-md bg-stuck-soft px-3 py-2 font-semibold text-stuck" data-amendment>{words.notInSpec} <a href={m.amendment.link} className="inline-flex min-h-11 items-center text-inherit">{words.openAmendment}</a></p>
                  )}
                </div>
                {failed && <FailedStep projectId={projectId} messageId={m.id} />}
                {m.id === mapReply && <a href={`/p/${projectId}/team#code-map`} className="inline-flex min-h-11 items-center text-sm font-semibold text-now underline underline-offset-4" data-see-code-map>{codeMapWords.see}</a>}
                {!mine && m.replyTo && onMessage(m.replyTo).map((p) => <ProposalCard key={p.id} projectId={projectId} p={p} byId={byId} parts={parts} primary={p.id === newestOpen && !openId}
                  mode={mode} waitFor={openId ? entry?.name ?? null : null} uncovered={uncovered[p.id]} />)}
              </li>
            );
          })}
        </ol>
      )}
      {/* C-1: no Enter hint (Enter sends, as in any chat). P3: pinned to the bottom of the window, on the page's own colour, with a hairline on top */}
      <form onSubmit={(e) => { e.preventDefault(); sendIt(); }} className="sticky bottom-0 z-10 -mx-6 grid gap-2 border-t border-hair bg-canvas px-6 pb-4 pt-3 max-md:-mx-4 max-md:px-4" data-composer>
        {/* D-103 (TASK-B-114): the entry worker is answering — the region is always there so a screen reader hears it come and go; no animation */}
        <p className="m-0 empty:hidden" aria-live="polite">
          {answering && entry && (
            <span className="flex items-center gap-2 text-sm font-medium text-now" data-answering>
              <Avatar name={entry.name} avatar={entry.avatar} size="sm" state="working" />
              <b className="name font-semibold" data-name title={entry.name}>{entry.name}</b>
              <span className="shrink-0">{live.answeringChat}</span>
            </span>
          )}
        </p>
        {/* one box with send inside it, bottom right (P3): send is quiet, and off until there is text — the page's one filled button is the proposal's */}
        <div className="relative rounded-[14px] border border-hair2 bg-sheet transition-colors focus-within:border-now motion-reduce:transition-none" data-box>
          <textarea ref={box} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label={placeholder}
            className="block max-h-[calc(1.6em*6+28px)] min-h-[52px] w-full resize-none overflow-y-auto rounded-[14px] bg-transparent py-3.5 pl-4 pr-16 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-ink3" />
          <button type="submit" aria-label={send} disabled={pending || !text.trim()} data-send
            className="absolute bottom-1.5 right-1.5 grid size-11 place-items-center rounded-[10px] text-ink3 transition-colors enabled:bg-now-soft enabled:text-now enabled:hover:brightness-110 disabled:cursor-not-allowed motion-reduce:transition-none">
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
        {(teamDown || error) && (
          <div className="flex flex-wrap items-center gap-2">
            {teamDown && <span className="mr-auto text-sm text-ink2" data-team-waits>{downWords.waits}</span>}
            <Refused text={error} />
          </div>
        )}
      </form>
    </div>
  );
}
