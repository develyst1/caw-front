// การรัน (REQ-011 R6, AC-7): what ran and what it cost — read through `CawApi` on the server, drawn by the plain RunsList. Under the title, the
// project's mode and run state, read-only (TASK-B-099, D-094 H-1: the switch itself is on the board).
import { notFound } from "next/navigation";
import { api } from "@/api";
import { LiveRefresh } from "@/components/LiveRefresh";
import { RunsList } from "@/components/runs/RunsList";
import { lastSeq } from "@/lib/eventSeq";
import s from "@/components/runs/runs.module.css";
import { mode, runRunning, runStopped, section, stopReason } from "@/words";

export const dynamic = "force-dynamic";

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await api.project(id);
  if (!project) notFound();
  const [runs, hops, workers, cards, chat, seq] = await Promise.all([api.runs(id, 100), api.hops(id, { limit: 200 }), api.workers(), api.cards(id), api.chat(id, { limit: 200 }), lastSeq(api, id)]);
  return (
    <main className={s.main}>
      <LiveRefresh projectId={id} after={seq} /> {/* a running hop's state follows within 3 s (D-088) */}
      <h2 className="sr-only">{section.runs}</h2> {/* R-1: the current tab already says การรัน; kept for screen readers */}
      {/* the newest run is the open one, if any; อัตโนมัติ whose run has stopped says why (D-052) */}
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink2" data-run-mode>
        <span className="font-semibold text-ink">{mode[project.mode]}</span>
        {runs[0] && runs[0].endedAt === null ? <span className="font-semibold text-now">{runRunning}</span>
          : project.mode === "dispatcher" && runs[0]?.stopReason ? <span>{runStopped(stopReason[runs[0].stopReason])}</span> : null}
      </p>
      <RunsList projectId={id} runs={runs} hops={hops} workers={workers} cards={cards} chat={chat} />
    </main>
  );
}
