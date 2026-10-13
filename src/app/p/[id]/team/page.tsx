// ทีม · สายงาน (REQ-011 R4, TASK-B-042): every worker (global), this project's chain, and how many open cards each member holds
// (removing a member with open cards asks who takes them).
import { notFound } from "next/navigation";
import { api } from "@/api";
import { Team } from "@/components/team/Team";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, workers, chain, cards] = await Promise.all([api.project(id), api.workers(), api.chain(id), api.cards(id)]);
  if (!project || !chain) notFound();
  const openCards: Record<string, number> = {};
  for (const c of cards) if (c.assigneeId && c.status !== "done") openCards[c.assigneeId] = (openCards[c.assigneeId] ?? 0) + 1;
  return (
    <main>
      <Team projectId={id} workers={workers} chain={chain} openCards={openCards} />
    </main>
  );
}
