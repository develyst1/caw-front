// The project screen (REQ-011 R2, REQ-014 R1–R4; direction B, TASK-B-087): the first steps while the project has no cards yet, the roster, what waits on
// you, the mode (TASK-B-099), the five columns — one column at every width. The chat is the แชต tab with its count (D-093); while the team
// waits on you there without a structured question, the board says so in one line (TASK-B-098, D-094 § 0). Read through `CawApi` on the server; `LiveRefresh` keeps it current.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { Board, type PartRef } from "@/components/Board";
import type { SeatView } from "@/components/CrewStrip";
import { FirstSteps } from "@/components/FirstSteps";
import { ModeControl } from "@/components/ModeControl";
import { LiveRefresh } from "@/components/LiveRefresh";
import { crewState, entryQuestions, entryWaitsInChat, proposalWaits } from "@/lib/crew";
import { lastSeq } from "@/lib/eventSeq";
import { blueprintPartHref } from "@/blueprint";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, cards, workers, chain, hops, messages, [latest], seq, team_, proposals] = await Promise.all([
    api.project(id), api.cards(id), api.workers(), api.chain(id), api.hops(id, { limit: 20 }), api.chat(id, { limit: 200 }), api.runs(id, 1), lastSeq(api, id), api.teamStatus(), api.proposals(id),
  ]);
  if (!project) notFound();
  const contexts = await Promise.all(cards.map((c) => api.cardContext(c.id)));
  // REQ-112 (SPEC-109 D4): advisory — a read that fails draws nothing here
  const uncovered = (await api.coverage(id).catch(() => null))?.uncovered.map((u) => ({ key: u.key, title: u.title, href: blueprintPartHref(project.blueprintProjectId, u.key) })) ?? [];
  const parts: Record<string, PartRef> = {};
  for (const ctx of contexts) if (ctx) parts[ctx.spec.part.key] = { kind: ctx.spec.part.kind, title: ctx.spec.part.title };

  const team = chain ?? { members: [], edges: [], entryWorkerId: null };
  const seats: SeatView[] = crewState(team, cards, hops, messages).map((st) => ({
    id: st.worker.id, name: st.worker.name, avatar: st.worker.avatar, roles: st.worker.roles, state: st.state, card: st.card?.title ?? null, n: st.n,
    hop: st.state === "working" || st.state === "answeringChat" ? hops.find((h) => h.workerId === st.worker.id && h.endedAt === null) : undefined,
  }));
  const entry = team.entryWorkerId ? workers.find((w) => w.id === team.entryWorkerId) ?? null : null;
  const asked = entryQuestions(team, messages);
  // the newest run decides the run state: open, or stopped with its reason (TASK-B-047; on the board since TASK-B-099)
  const lastRun = latest ? { open: latest.endedAt === null, stopReason: latest.stopReason, hopBudget: latest.hopBudget, hopsUsed: latest.hopsUsed, mode: latest.mode } : null;

  return (
    <main className="mx-auto grid max-w-[1600px] gap-6 px-6 pb-12 pt-6 max-md:px-4 max-md:pt-4">
      <LiveRefresh projectId={id} after={seq} />
      {cards.length === 0 && <FirstSteps projectId={id} teamSize={team.members.length} roots={project.workspace.roots} hasChat={messages.length > 0} />}
      <Board projectId={id} cards={cards} workers={workers} parts={parts} seats={seats} chatAsk={entry && asked ? { entry, questions: asked.questions } : null}
        chatWaits={entry && entryWaitsInChat(team, messages) ? entry : null} entry={entry} tellPrimary={project.workspace.roots.length > 0}
        teamDown={team_.running ? null : team_.startCommand} /* REQ-015 R1 (TASK-B-104) */
        proposalWaits={proposalWaits(team, messages, proposals)} /* D-105 P2 (TASK-B-120) */
        mode={project.mode} hops={hops} uncovered={uncovered} /* ทำต่อ on the workable cards in แบบสั่งทีละขั้น (TASK-B-121) */
        // a server-built element handed to the client Board needs a key, or React's dev build warns about a list (DEF-6, TASK-B-102)
        modeControl={<ModeControl key="mode" projectId={id} mode={project.mode} hopBudget={project.hopBudget} hopsUsed={project.hopsUsed} lastRun={lastRun} />} />
    </main>
  );
}
