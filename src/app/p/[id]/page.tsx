// The project screen (REQ-011 R2, REQ-014 R1–R4, TASK-B-064; comps B-066/B-068 2–3): the crew strip, the first steps while the project has no
// cards yet, the board, and the chat beside it (the front door). Read through `CawApi` on the server; `LiveRefresh` keeps it current.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { Board, type PartRef } from "@/components/Board";
import s from "@/components/board.module.css";
import { Chat } from "@/components/chat/Chat";
import type { SeatView } from "@/components/CrewStrip";
import { FirstSteps } from "@/components/FirstSteps";
import { LiveRefresh } from "@/components/LiveRefresh";
import { crewState } from "@/lib/crew";
import { lastSeq } from "@/lib/eventSeq";
import { readiness } from "@/lib/readiness";
import { missing } from "@/words";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, cards, workers, chain, hops, messages, proposals, [latestRun], seq] = await Promise.all([
    api.project(id), api.cards(id), api.workers(), api.chain(id), api.hops(id, { limit: 20 }), api.chat(id, { limit: 200 }), api.proposals(id), api.runs(id, 1), lastSeq(api, id),
  ]);
  if (!project) notFound();
  const contexts = await Promise.all(cards.map((c) => api.cardContext(c.id)));
  const parts: Record<string, PartRef> = {};
  for (const ctx of contexts) if (ctx) parts[ctx.spec.part.key] = { kind: ctx.spec.part.kind, title: ctx.spec.part.title };

  // a proposal item's spec part, as the แชต page reads it (B-050 item detail kept beside the board — B-061 review note 2)
  const anchors = new Map(proposals.flatMap((p) => p.items.map((i) => [`${i.anchor.key}@${i.anchor.version}`, i.anchor] as const)));
  const proposalParts: Record<string, PartRef> = {};
  for (const [key, ctx] of await Promise.all([...anchors.values()].map(async (a) => [a.key, await api.part(id, a.key, a.version)] as const))) {
    if (ctx) proposalParts[key] = { kind: ctx.part.kind, title: ctx.part.title };
  }
  const team = chain ?? { members: [], edges: [], entryWorkerId: null };
  const seats: SeatView[] = crewState(team, cards, hops, messages).map((st) => ({
    id: st.worker.id, name: st.worker.name, avatar: st.worker.avatar, roles: st.worker.roles, state: st.state, card: st.card?.title ?? null, n: st.n,
    hop: st.state === "working" || st.state === "answeringChat" ? hops.find((h) => h.workerId === st.worker.id && h.endedAt === null) : undefined,
  }));
  // the chat head: the first thing missing, as D-063's sentence and its fix (no team → team; else readiness' first todo with a sentence)
  const todo = readiness(project, team, workers).find((i) => i.state === "todo" && (i.rule === "entry" || i.rule === "folder"));
  const gap = team.members.length === 0 ? { ...missing.team, href: `/p/${id}/team` }
    : todo?.rule === "entry" ? { ...missing.entry, href: `/p/${id}/team` }
    : todo?.rule === "folder" ? { ...missing.folder, href: cards.length === 0 ? "#fs-h" : `/p/${id}` }
    : null;
  const busy = (latestRun?.endedAt === null) || hops.some((h) => h.endedAt === null);

  return (
    <main className={s.main}>
      <LiveRefresh projectId={id} after={seq} busy={busy} />
      <div className={s.work}>
        <div className={s.left}>
          {cards.length === 0 && <FirstSteps projectId={id} teamSize={team.members.length} roots={project.workspace.roots} hasChat={messages.length > 0} />}
          <Board cards={cards} workers={workers} parts={parts} seats={seats} />
        </div>
        <Chat projectId={id} messages={messages} proposals={proposals} workers={workers} parts={proposalParts} variant="panel" missing={cards.length === 0 ? null : gap} pinned={cards.length > 0} />
      </div>
    </main>
  );
}
