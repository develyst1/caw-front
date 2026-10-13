// บอร์ด (REQ-011 R2): every card of the project, the workers for the filter, and each card's spec part (name + kind) from its
// context — read through `CawApi` on the server, drawn by the client Board.
import { api } from "@/api";
import { Board, type PartRef } from "@/components/Board";
import s from "@/components/board.module.css";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cards, workers] = await Promise.all([api.cards(id), api.workers()]);
  const contexts = await Promise.all(cards.map((c) => api.cardContext(c.id)));
  const parts: Record<string, PartRef> = {};
  for (const ctx of contexts) if (ctx) parts[ctx.spec.part.key] = { kind: ctx.spec.part.kind, title: ctx.spec.part.title };
  return (
    <main className={s.main}>
      <Board cards={cards} workers={workers} parts={parts} />
    </main>
  );
}
