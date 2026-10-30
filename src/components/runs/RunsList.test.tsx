// The runs screen's markup, rendered to a string: every stop reason's word, a running run, the cost of each, the manual group (REQ-011 AC-7).
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card, ChatMessage, Hop, Run, StopReason, Worker } from "@/api/caw";
import { hopOutcome, runPage, runRunning, runWords, stopReason } from "@/words";
import { RunsList } from "./RunsList";

const worker: Worker = { id: "w1", name: "ปลา", role: "PM", roles: ["PM"], skills: ["role-pm"], model: "opus", effort: "high", combinedFrom: null, avatar: null, deletedAt: null };
const card: Card = {
  id: "c1", projectId: "p", number: 7, kind: "work", title: "ทำหน้าค้นหา", todo: "", status: "todo", assigneeId: "w1", anchor: { key: "SCR-001", version: 3 }, anchorLabel: null, anchorRemoved: false,
  specChangedVersion: null, dependsOn: [], question: null, answer: null, workable: true, stoppedMidway: null, createdAt: "", updatedAt: "",
};
const REASONS: StopReason[] = ["budget_spent", "nothing_workable", "failed_review_twice", "limit_reached", "operator_stopped", "error", "no_progress"];
const run = (id: string, over: Partial<Run> = {}): Run => ({
  id, projectId: "p", mode: "dispatcher", hopBudget: 3, startedAt: "2026-10-13T08:00:00+07:00", endedAt: "2026-10-13T08:06:00+07:00",
  stopReason: "budget_spent", report: null, hopsUsed: 0, ...over,
});
const hop = (id: string, runId: string | null, over: Partial<Hop> = {}): Hop => ({
  id, projectId: "p", runId, claimedBy: null, cardId: "c1", workerId: "w1", startedAt: "2026-10-13T08:00:10+07:00", endedAt: "2026-10-13T08:00:48+07:00",
  lastActivityAt: "2026-10-13T08:00:10+07:00", messageId: null, outcome: "commented", tokensIn: 3100, tokensOut: 1100, note: "", ...over,
});
const render = (runs: Run[], hops: Hop[]) => renderToStaticMarkup(<RunsList projectId="p" runs={runs} hops={hops} workers={[worker]} cards={[card]} />);

describe("RunsList", () => {
  test("every stop reason renders its word, once per run", () => {
    const html = render(REASONS.map((r) => run(`r-${r}`, { stopReason: r })), []);
    for (const r of REASONS) {
      expect(html).toContain(`data-stop="${r}">${stopReason[r]}<`);
    }
    expect(html.match(/data-run=/g)).toHaveLength(REASONS.length);
  });

  test("a run with no end reads กำลังรัน and no stop reason; a finished one does not", () => {
    const open = render([run("r1", { endedAt: null, stopReason: "budget_spent" })], []); // a stop reason on a run that has not ended is not shown
    expect(open).toContain(runRunning);
    expect(open).not.toContain("data-stop");
    expect(render([run("r1")], [])).not.toContain(runRunning);
  });

  test("a run's cost: hops, wall time and tokens from its hops; its report is shown; runs keep the order they were given (newest first)", () => {
    const hops = [
      hop("a", "r1", { startedAt: "2026-10-13T08:00:00+07:00", endedAt: "2026-10-13T08:00:38+07:00", tokensIn: 3100, tokensOut: 1100 }),
      hop("b", "r1", { startedAt: "2026-10-13T08:02:00+07:00", endedAt: "2026-10-13T08:02:52+07:00", tokensIn: 4500, tokensOut: 1600, outcome: "handed_off" }),
    ];
    const html = render([run("r1", { report: "ทำครบสองก้าว" }), run("r0")], hops);
    expect(html).toContain("2 ก้าว");
    expect(html).toContain("1 นาที 30 วินาที");     // 38 s + 52 s
    expect(html).toContain("10,300 โทเค็น");         // 3100 + 1100 + 4500 + 1600
    expect(html).toContain("เข้า 4,500 · ออก 1,600");
    expect(html).toContain("ทำครบสองก้าว");
    expect(html).toContain(hopOutcome.handed_off);
    expect(html.indexOf('data-run="r1"')).toBeLessThan(html.indexOf('data-run="r0"'));
    expect(html).toContain('href="/p/p/c/c1"');       // a hop links to its card
    expect(html).toContain("#7 ทำหน้าค้นหา");
  });

  test("the hops with no run are their own group, headed by the manual mode's word, with their own cost", () => {
    const html = render([run("r1")], [hop("m1", null), hop("m2", null)]);
    expect(html).toContain("data-manual");
    expect(html).toContain("<h3");
    expect(html).toContain("แบบสั่งทีละขั้น");
    const manual = html.slice(html.indexOf("data-manual"));
    expect(manual).toContain("2 ก้าว");
    expect(manual.match(/data-hop/g)).toHaveLength(2);
    expect(render([run("r1")], [hop("h", "r1")])).not.toContain("data-manual");
  });

  test("a hop still running has no outcome word, only กำลังรัน; with nothing at all there is one sentence", () => {
    expect(render([run("r1", { endedAt: null, stopReason: null })], [hop("h", "r1", { endedAt: null, outcome: null, tokensIn: null, tokensOut: null })])).toContain(`${runRunning}</span>`);
    expect(render([], [])).toContain("ยังไม่มีการรัน");
  });

  // TASK-B-088 § 2.5
  test("while a hop runs, the run's time reads กำลังรัน — not 0 วินาที — and the hop has no empty cost pill", () => {
    const html = render([run("r1", { endedAt: null, stopReason: null })], [hop("h", "r1", { endedAt: null, outcome: null, tokensIn: null, tokensOut: null })]);
    expect(html).toContain("data-cost-running");
    expect(html).not.toContain(runWords.duration(0));
    expect(html).not.toMatch(/class="[^"]*cost[^"]*"><\/span>/);
  });
  test("a chat step reads ตอบแชต: {the message's first words}, linking to the chat", () => {
    const m = { id: "m1", text: "อยากให้ห้องประชุมใหญ่ต้องอนุมัติ" } as ChatMessage;
    const html = renderToStaticMarkup(<RunsList projectId="p" runs={[]} hops={[hop("h", null, { cardId: null, messageId: "m1" })]} workers={[worker]} cards={[card]} chat={[m]} />);
    expect(html).toContain(runPage.chatStep("อยากให้ห้องประชุมใหญ่ต้องอนุมัติ"));
    expect(html).toContain('href="/p/p/chat"');
  });
  // R-2 (TASK-B-100, D-094): an outcome the screen has no word for (the core's chat reply) draws no chip, never an empty pill
  test("an outcome with no word shows no chip; a known one and a running hop still do", () => {
    const html = render([], [hop("h1", null, { outcome: "replied" as Hop["outcome"] })]);
    expect(html).not.toContain("data-outcome");
    expect(render([], [hop("h2", null)])).toContain(hopOutcome.commented);
    expect(render([], [hop("h3", null, { endedAt: null, outcome: null })])).toContain(runRunning);
  });
});
