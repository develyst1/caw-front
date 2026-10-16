// ทีม · สายงาน (REQ-011 R4 → REQ-014 comp 4, TASK-B-065): every worker (global), this project's chain, how many open cards each member holds (removing
// one with open cards asks who takes them), and each member's live state (Bob's `crewState`: green working / amber stuck on the picture).
import { notFound } from "next/navigation";
import { api } from "@/api";
import type { NodeState } from "@/components/team/ChainPicture";
import { Team } from "@/components/team/Team";
import { LiveRefresh } from "@/components/LiveRefresh";
import { crewState } from "@/lib/crew";
import { lastSeq } from "@/lib/eventSeq";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, workers, chain, cards, hops, seq, chat, projects] = await Promise.all([api.project(id), api.workers(), api.chain(id), api.cards(id), api.hops(id, { limit: 20 }), lastSeq(api, id), api.chat(id, { limit: 200 }), api.projects()]);
  if (!project || !chain) notFound();
  const openCards: Record<string, number> = {};
  for (const c of cards) if (c.assigneeId && c.status !== "done") openCards[c.assigneeId] = (openCards[c.assigneeId] ?? 0) + 1;
  const states: Record<string, NodeState> = {};
  for (const seat of crewState(chain, cards, hops, chat)) states[seat.worker.id] = seat.state === "working" || seat.state === "answeringChat" ? "working" : seat.state === "stuck" ? "stuck" : null;
  return (
    <main>
      {/* the page follows the project without a reload (C4, D-088): every 3 s */}
      <LiveRefresh projectId={id} after={seq} />
      {/* projectNames: a person who cannot be deleted is still in these projects, said by name (D-081 item 2) */}
      <Team projectId={id} project={project} workers={workers} chain={chain} openCards={openCards} states={states} projectNames={Object.fromEntries(projects.map((x) => [x.id, x.name]))} />
    </main>
  );
}
