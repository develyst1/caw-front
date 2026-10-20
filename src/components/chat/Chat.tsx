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
import { CircleHelp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import type { ChatMessage, Proposal, Worker } from "@/api/caw";
import { acceptProposal, postMessage, retryMessage, type ChatResult } from "@/app/p/[id]/chat/actions";
import { Part } from "@/components/card/Part";
import { Avatar } from "@/components/Person";
import { Button } from "@/components/ui/button";
import { chatHead, chat as words, chatRefused, distill, operatorName, proposedAnswer, section, send } from "@/words";

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

function ProposalCard({ projectId, p, byId, parts, primary }: { projectId: string; p: Proposal; byId: Map<string, Worker>; parts: Record<string, PartRef>; primary: boolean }) {
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={primary ? "default" : "outline"} className="min-h-11 px-5 font-semibold" onClick={create} disabled={pending} data-create>{words.createCards}</Button>
          <Refused text={error} />
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

export function Chat({ projectId, messages, proposals, workers, parts, entry, draft = "" }: {
  projectId: string; messages: ChatMessage[]; proposals: Proposal[]; workers: Worker[]; parts: Record<string, PartRef>; entry: Worker | null; draft?: string;
}) {
  const router = useRouter();
  const byId = new Map(workers.map((w) => [w.id, w]));
  const workerOf = (a: ChatMessage["author"]) => (a === "operator" ? undefined : byId.get(a.slice("worker:".length)));
  // one primary per screen (B7): only the newest open proposal's สร้างการ์ด is primary
  const newestOpen = [...proposals].filter((p) => p.status === "open").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
  const onMessage = (messageId: string) => proposals.filter((p) => p.messageId === messageId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [text, setText] = useState(draft); // `ตอบเอง…` on the board arrives with the question as the draft
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sendIt = () => {
    const t = text.trim();
    if (!t || pending) return;
    start(async () => { const r = await postMessage(projectId, t); setError(refusal(r)); if (r.ok) setText(""); router.refresh(); });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendIt(); } };
  const placeholder = entry ? distill.placeholder(entry.name) : words.placeholder; // C-1: names who you write to
  // the thread scrolls in its own box, the box below it — it opens at the newest message, and comes back there when one arrives
  const thread = useRef<HTMLOListElement>(null);
  useEffect(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length]);

  return (
    // C-4: one column that fills the screen under the header (73 px at ≥ 768, 109 px with the tabs' own row below it); the box pins to the bottom
    <div className="mx-auto grid h-[calc(100dvh-74px-var(--caw-sample-bar,0px))] min-h-[420px] w-full max-w-[880px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 px-6 pt-6 max-md:h-[calc(100dvh-110px-var(--caw-sample-bar,0px))] max-md:gap-3 max-md:px-4 max-md:pt-4" data-chat>
      <h2 className="m-0 text-[17px] font-semibold" data-chat-title>{entry ? chatHead.title(entry.name) : section.chat}</h2>
      {messages.length === 0 ? <p className="m-0 rounded-[10px] border border-dashed border-hair2 bg-sheet p-6 text-center text-ink2">{words.empty}</p> : (
        <ol ref={thread} className="m-0 grid list-none content-start gap-5 overflow-y-auto p-0 pr-1" data-thread>
          {messages.map((m) => {
            const mine = m.author === "operator", w = workerOf(m.author);
            const failed = mine && m.replyHopId === null && !!m.chatHop?.endedAt && m.retryRequestedAt === null;
            return (
              <li key={m.id} className={`grid gap-2.5 ${mine ? "justify-items-end" : "justify-items-start"}`} data-message={mine ? "operator" : "worker"}>
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
                      <p className="m-0 mt-1 text-sm text-ink2">{proposedAnswer}</p>
                      <p className="m-0 font-semibold">{q.proposedDefault}</p>
                      {q.cases.length > 0 && <ul className="m-0 mt-0.5 grid gap-0.5 pl-5 text-ink2">{q.cases.map((c) => <li key={c}>{c}</li>)}</ul>}
                    </div>
                  ))}
                  {m.amendment && (
                    <p className="m-0 mt-1 rounded-md bg-stuck-soft px-3 py-2 font-semibold text-stuck" data-amendment>{words.notInSpec} <a href={m.amendment.link} className="inline-flex min-h-11 items-center text-inherit">{words.openAmendment}</a></p>
                  )}
                </div>
                {failed && <FailedStep projectId={projectId} messageId={m.id} />}
                {!mine && m.replyTo && onMessage(m.replyTo).map((p) => <ProposalCard key={p.id} projectId={projectId} p={p} byId={byId} parts={parts} primary={p.id === newestOpen} />)}
              </li>
            );
          })}
        </ol>
      )}
      {/* C-1: no Enter hint (Enter sends, as in any chat; the button is beside it). C-4: no frame of its own — a top hairline */}
      <form onSubmit={(e) => { e.preventDefault(); sendIt(); }} className="grid gap-2 border-t border-hair py-3" data-composer>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label={placeholder}
          className="min-h-[72px] w-full resize-y rounded-md border border-hair2 bg-sheet px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink3" />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Refused text={error} />
          <Button type="submit" className="min-h-11 px-5" disabled={pending || !text.trim()}>{send}</Button>
        </div>
      </form>
    </div>
  );
}
