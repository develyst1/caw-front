// REQ-117 / SPEC-114 D3 (TASK-144): which review holds work up — the rule the board and the back end's report share.
import { describe, expect, test } from "bun:test";
import type { Card, CardStatus } from "@/api/caw";
import { reviewHolds } from "./reviewHold";

const card = (n: number, status: CardStatus, dependsOn: number[] = [], over: Partial<Card> = {}): Card => ({
  id: `c${n}`, projectId: "p", number: n, kind: "work", title: `งาน ${n}`, todo: "", status, assigneeId: null, anchor: { key: "SCR-001", version: 1 }, anchorLabel: null, anchorRemoved: false,
  specChangedVersion: null, dependsOn: dependsOn.map((d) => `c${d}`), question: null, answer: null, workable: false, stoppedMidway: null, createdAt: "", updatedAt: "", ...over,
});
const holds = (cards: Card[]) => reviewHolds(cards).map((h) => [h.card.number, h.waiting]);

describe("reviewHolds", () => {
  test("AC-2's case: #1 in review, #2 and #3 waiting on it → one hold, waiting 2", () => {
    expect(holds([card(1, "review"), card(2, "todo", [1]), card(3, "todo", [1])])).toEqual([[1, 2]]);
  });
  test("a chain #3 → #2 → #1 counts both, directly and through another card", () => {
    expect(holds([card(1, "review"), card(2, "todo", [1]), card(3, "todo", [2])])).toEqual([[1, 2]]);
  });
  test("a card that two paths reach is counted once", () => {
    expect(holds([card(1, "review"), card(2, "todo", [1]), card(3, "todo", [1]), card(4, "todo", [2, 3])])).toEqual([[1, 3]]);
  });
  test("a done dependant is not counted and ends the walk: a not-done card behind it is workable, so it is not waiting on the review", () => {
    expect(holds([card(1, "review"), card(2, "done", [1]), card(3, "todo", [2])])).toEqual([]);
    expect(holds([card(1, "review"), card(2, "done", [1]), card(3, "todo", [2]), card(4, "todo", [1])])).toEqual([[1, 1]]); // only #4 waits
    expect(holds([card(1, "review"), card(2, "done", [1])])).toEqual([]);
  });
  test("a review card nothing depends on holds nothing up → none", () => {
    expect(holds([card(1, "review"), card(2, "todo")])).toEqual([]);
  });
  test("only a work card in review counts: not a todo card with dependants, not a question card", () => {
    expect(holds([card(1, "todo"), card(2, "todo", [1])])).toEqual([]);
    expect(holds([card(1, "review", [], { kind: "question" }), card(2, "todo", [1])])).toEqual([]);
    expect(holds([card(1, "review"), card(2, "todo", [1], { kind: "question" })])).toEqual([]); // a question card is not work
  });
  test("a cycle ends, and the card itself is not counted", () => {
    expect(holds([card(1, "review", [2]), card(2, "todo", [1])])).toEqual([[1, 1]]);
  });
  test("several holds come by card number", () => {
    expect(holds([card(7, "review"), card(3, "review"), card(8, "todo", [7]), card(9, "todo", [3]), card(10, "todo", [3])])).toEqual([[3, 2], [7, 1]]);
  });
});
