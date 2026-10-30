// REQ-117 (SPEC-114 D3): which review holds work up. Pure: the board hands it the cards it already has (`Card.status`, `Card.dependsOn`).
import type { Card } from "@/api/caw";

/** For each work card in `review`: *waiting* = the work cards not `done` that depend on it, directly or through other cards that are themselves not done (`dependsOn` walked backwards, each
 *  card counted once, a cycle cannot loop). Only a review card with waiting ≥ 1 is returned (one that holds nothing up is not), by card number.
 *  The back end's report uses the same rule (SPEC-114 D3). */
export function reviewHolds(cards: Card[]): { card: Card; waiting: number }[] {
  const dependants = new Map<string, Card[]>(); // id → the cards that list it in `dependsOn`
  for (const c of cards) for (const d of c.dependsOn) dependants.set(d, [...(dependants.get(d) ?? []), c]);
  const holds: { card: Card; waiting: number }[] = [];
  for (const card of cards) {
    if (card.kind !== "work" || card.status !== "review") continue;
    const seen = new Set<string>([card.id]); // the card itself is never counted, which also ends a cycle that comes back to it
    const todo = [card.id];
    let waiting = 0;
    while (todo.length > 0) {
      for (const x of dependants.get(todo.pop()!) ?? []) {
        if (seen.has(x.id)) continue;
        seen.add(x.id);
        if (x.status === "done") continue; // a done card ends the walk: whatever depends on it only on that path is workable, it does not wait on the review (SPEC-114 D3)
        todo.push(x.id);
        if (x.kind === "work") waiting++;
      }
    }
    if (waiting >= 1) holds.push({ card, waiting });
  }
  return holds.sort((a, b) => a.card.number - b.card.number);
}
