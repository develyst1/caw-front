// แชต (REQ-011 R7, REQ-013, TASK-B-050): the thread with the entry worker, each reply's questions and card proposal, read through
// `CawApi` on the server; drawn by the client Chat. Its own page under the project's header (beside บอร์ด · ทีม · การรัน), not a panel
// in the layout: the thread needs the height, and the board stays uncluttered (written in the TASK's notes). It follows the project without a
// reload, as the board does (D-095, TASK-B-102): a reply shows within one 3 s poll; the box's draft is client state, so a refresh keeps it.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { blueprintPartHref } from "@/blueprint";
import { TeamDown } from "@/components/Board";
import { Chat, type PartRef } from "@/components/chat/Chat";
import { LiveRefresh } from "@/components/LiveRefresh";
import { entryAnswering, entryQuestions } from "@/lib/crew";
import { lastSeq } from "@/lib/eventSeq";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ answer?: string }> }) {
  const { id } = await params;
  const { answer } = await searchParams; // `ตอบเอง…` on the board arrives with `?answer=1`: the empty box is focused (D-105 P1, TASK-B-119 — no longer the question as a draft)
  const [project, messages, proposals, workers, chain, seq, team, hops] = await Promise.all([api.project(id), api.chat(id, { limit: 200 }), api.proposals(id), api.workers(), api.chain(id), lastSeq(api, id), api.teamStatus(), api.hops(id, { limit: 20 })]);
  if (!project) notFound();
  // a proposed item's spec part, by key — one read per distinct key the items anchor on (v1.7; REQ-105: always the latest spec), so a part no card
  // holds yet has its name too; a part that cannot be read stays out and the item shows its key
  const keys = new Set(proposals.flatMap((p) => p.items.map((i) => i.anchor.key)));
  const parts: Record<string, PartRef> = {};
  const read = await Promise.all([...keys].map(async (key) => [key, await api.part(id, key)] as const));
  for (const [key, ctx] of read) if (ctx) parts[key] = { kind: ctx.part.kind, title: ctx.part.title };
  // REQ-112 (SPEC-109 D3/D4): per OPEN proposal, the rules it leaves without a card; a read that fails draws nothing for that proposal
  const uncovered: Record<string, { key: string; title: string; href: string }[]> = {};
  await Promise.all(proposals.filter((p) => p.status === "open").map(async (p) => {
    const c = await api.coverage(id, p.id).catch(() => null);
    if (c) uncovered[p.id] = c.uncovered.map((u) => ({ key: u.key, title: u.title, href: blueprintPartHref(project.blueprintProjectId, u.key) }));
  }));
  return (
    <main>
      <LiveRefresh projectId={id} after={seq} />
      {/* REQ-015 R1 (TASK-B-104): the team is not running — the line, and the box says a message waits */}
      {!team.running && <div className="mx-auto max-w-[880px] px-6 pt-6 max-md:px-4 max-md:pt-4"><TeamDown startCommand={team.startCommand} /></div>}
      <Chat teamDown={!team.running} answering={chain ? entryAnswering(chain, hops) : false} /* D-103 (TASK-B-114): the entry worker is answering */ codeMap={project.codeMap} projectId={id} messages={messages} proposals={proposals} workers={workers} parts={parts} focusBox={answer === "1"} uncovered={uncovered} mode={project.mode} /* the agreement line says what happens in this mode (TASK-B-120) */
        openId={chain ? entryQuestions(chain, messages)?.message.id ?? null : null} /* the reply whose questions are still open: they carry the pair */
        entry={chain?.entryWorkerId ? workers.find((w) => w.id === chain.entryWorkerId) ?? null : null} />
    </main>
  );
}
