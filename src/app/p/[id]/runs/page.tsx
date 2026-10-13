// การรัน (REQ-011 R6, AC-7): what ran and what it cost — read through `CawApi` on the server, drawn by the plain RunsList.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { RunsList } from "@/components/runs/RunsList";
import s from "@/components/runs/runs.module.css";
import { section } from "@/words";

export const dynamic = "force-dynamic";

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await api.project(id))) notFound();
  const [runs, hops, workers, cards] = await Promise.all([api.runs(id, 100), api.hops(id, { limit: 200 }), api.workers(), api.cards(id)]);
  return (
    <main className={s.main}>
      <h2 className={s.title}>{section.runs}</h2>
      <RunsList projectId={id} runs={runs} hops={hops} workers={workers} cards={cards} />
    </main>
  );
}
