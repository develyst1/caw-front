// การ์ด (REQ-011 R3, TASK-B-041): the card with its context, read through `CawApi` on the server and drawn by CardView.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { blueprintPartHref } from "@/blueprint";
import { CardView } from "@/components/card/CardView";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const [project, ctx, workers, cards, chain] = await Promise.all([api.project(id), api.cardContext(cardId), api.workers(), api.cards(id), api.chain(id)]);
  if (!project || !ctx || ctx.card.projectId !== id) notFound();
  const deps = ctx.card.dependsOn.flatMap((d) => cards.filter((c) => c.id === d));
  const openQuestions = cards.filter((c) => c.kind === "question" && c.answer === null).map((c) => c.id);
  // under the project header's h1 (the project name): this page's heading is the card title, an h2
  return (
    <main>
      {/* re-assign offers the chain's members only: the operator ignores the chain's edges, not its members (SPEC-A-008) */}
      <CardView projectId={id} ctx={ctx} workers={workers} members={chain?.members ?? []} deps={deps} openQuestions={openQuestions}
        blueprintHref={blueprintPartHref(project.blueprintProjectId, ctx.spec.part.key)} />
    </main>
  );
}
