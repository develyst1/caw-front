// แชต (REQ-011 R7, REQ-013, TASK-B-050): the thread with the entry worker, each reply's questions and card proposal, read through
// `CawApi` on the server; drawn by the client Chat. Its own page under the project's header (beside บอร์ด · ทีม · การรัน), not a panel
// in the layout: the thread needs the height, and the board stays uncluttered (written in the TASK's notes). It follows the project without a
// reload, as the board does (D-095, TASK-B-102): a reply shows within one 3 s poll; the box's draft is client state, so a refresh keeps it.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { Chat, type PartRef } from "@/components/chat/Chat";
import { LiveRefresh } from "@/components/LiveRefresh";
import { lastSeq } from "@/lib/eventSeq";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ draft?: string }> }) {
  const { id } = await params;
  const { draft } = await searchParams; // `ตอบเอง…` on the board's "waits on you" sheet arrives with the question as the box's draft (TASK-B-087)
  const [project, messages, proposals, workers, chain, seq] = await Promise.all([api.project(id), api.chat(id, { limit: 200 }), api.proposals(id), api.workers(), api.chain(id), lastSeq(api, id)]);
  if (!project) notFound();
  // a proposed item's spec part, by key — one read per distinct (key, version) the items anchor on (v1.7), so a part no card holds yet has
  // its name too; a part that cannot be read stays out and the item shows its key
  const anchors = new Map(proposals.flatMap((p) => p.items.map((i) => [`${i.anchor.key}@${i.anchor.version}`, i.anchor] as const)));
  const parts: Record<string, PartRef> = {};
  const read = await Promise.all([...anchors.values()].map(async (a) => [a.key, await api.part(id, a.key, a.version)] as const));
  for (const [key, ctx] of read) if (ctx) parts[key] = { kind: ctx.part.kind, title: ctx.part.title };
  return (
    <main>
      <LiveRefresh projectId={id} after={seq} />
      <Chat projectId={id} messages={messages} proposals={proposals} workers={workers} parts={parts} draft={draft ?? ""}
        entry={chain?.entryWorkerId ? workers.find((w) => w.id === chain.entryWorkerId) ?? null : null} />
    </main>
  );
}
