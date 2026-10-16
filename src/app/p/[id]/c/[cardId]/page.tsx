// การ์ด (REQ-011 R3, TASK-B-041): the card with its context, read through `CawApi` on the server and drawn by CardView.
import { notFound } from "next/navigation";
import { api } from "@/api";
import { blueprintPartHref } from "@/blueprint";
import { CardView } from "@/components/card/CardView";
import { LiveRefresh } from "@/components/LiveRefresh";
import { lastSeq } from "@/lib/eventSeq";
import ProjectNotFound from "../../not-found";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ id: string; cardId: string }> }) {
  const { id, cardId } = await params;
  const [project, ctx, workers, cards, chain, hops, seq] = await Promise.all([api.project(id), api.cardContext(cardId), api.workers(), api.cards(id), api.chain(id), api.hops(id, { limit: 20 }), lastSeq(api, id)]);
  if (!project) notFound();
  // an unknown card is drawn here, under the project's header, rather than thrown to the not-found boundary: Next sends a thrown not-found in an error
  // shell whose head script never runs before paint, so a stored dark pick would start light (B-084 `card-unknown · cold-theme`; TASK-B-088 Q1)
  if (!ctx || ctx.card.projectId !== id) return <ProjectNotFound />;
  const deps = ctx.card.dependsOn.flatMap((d) => cards.filter((c) => c.id === d));
  const openQuestions = cards.filter((c) => c.kind === "question" && c.answer === null).map((c) => c.id);
  // who runs a hop on this card right now (a project has one running hop at a time) — the card shows the same "now" mark as the board
  const hop = hops.find((h) => h.cardId === cardId && h.endedAt === null);
  const running = hop ? workers.find((w) => w.id === hop.workerId) ?? null : null;
  // under the project header's h1 (the project name): this page's heading is the card title, an h2
  return (
    <main>
      <LiveRefresh projectId={id} after={seq} /> {/* the card's status, timeline and "now" follow within 3 s (D-088) */}
      {/* re-assign offers the chain's members only: the operator ignores the chain's edges, not its members (SPEC-A-008) */}
      <CardView projectId={id} ctx={ctx} workers={workers} members={chain?.members ?? []} deps={deps} openQuestions={openQuestions}
        blueprintHref={blueprintPartHref(project.blueprintProjectId, ctx.spec.part.key)} running={running} />
    </main>
  );
}
