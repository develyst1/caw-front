// แชต (REQ-011 R7, REQ-013, TASK-B-050): the thread with the entry worker, each reply's questions and card proposal, read through
// `CawApi` on the server; drawn by the client Chat. Its own page under the project's header (beside บอร์ด · ทีม · การรัน), not a panel
// in the layout: the thread needs the height, and the board stays uncluttered (written in the TASK's notes).
import { notFound } from "next/navigation";
import { api } from "@/api";
import { Chat, type PartRef } from "@/components/chat/Chat";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, messages, proposals, workers] = await Promise.all([api.project(id), api.chat(id, { limit: 200 }), api.proposals(id), api.workers()]);
  if (!project) notFound();
  // a proposed item's spec part, by key — one read per distinct (key, version) the items anchor on (v1.7), so a part no card holds yet has
  // its name too; a part that cannot be read stays out and the item shows its key
  const anchors = new Map(proposals.flatMap((p) => p.items.map((i) => [`${i.anchor.key}@${i.anchor.version}`, i.anchor] as const)));
  const parts: Record<string, PartRef> = {};
  const read = await Promise.all([...anchors.values()].map(async (a) => [a.key, await api.part(id, a.key, a.version)] as const));
  for (const [key, ctx] of read) if (ctx) parts[key] = { kind: ctx.part.kind, title: ctx.part.title };
  return (
    <main>
      <Chat projectId={id} messages={messages} proposals={proposals} workers={workers} parts={parts} />
    </main>
  );
}
