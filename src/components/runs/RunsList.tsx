// The runs screen's content (REQ-011 R6, AC-7): runs newest first, each opening to its hops; the manual hops (no run) as their own
// group; the cost of each — hops, wall time, tokens — from the hops. Plain markup with no state: a server component renders it, a
// test renders it to a string.
import type { Card, Hop, Run, Worker } from "@/api/caw";
import { budget, hopOutcome, mode, runRunning, runWords, stopReason } from "@/words";
import { Person } from "@/components/Person";
import s from "./runs.module.css";
import { clockOf, groupHops, hopWallMs, totalsOf, whenOf, type Totals } from "./totals";

interface Props { projectId: string; runs: Run[]; hops: Hop[]; workers: Worker[]; cards: Card[] }

function Cost({ t }: { t: Totals }) {
  return (
    <ul className={s.totals}>
      <li>{runWords.hops(t.hops)}</li>
      <li>{runWords.duration(t.wallMs)}</li>
      <li>{runWords.tokens(t.tokensIn + t.tokensOut)}</li>
    </ul>
  );
}

function HopRows({ projectId, hops, workers, cards }: { projectId: string; hops: Hop[]; workers: Worker[]; cards: Card[] }) {
  return (
    <ol className={s.hops}>
      {hops.map((h) => {
        const w = workers.find((x) => x.id === h.workerId), c = cards.find((x) => x.id === h.cardId);
        return (
          <li key={h.id} className={s.hop} data-hop>
            <span className={s.time}>{clockOf(h.startedAt)}</span>
            <span className={s.who}><Person name={w?.name ?? h.workerId} avatar={w?.avatar ?? null} roles={w?.roles ?? []} size="sm" state={h.endedAt ? null : "working"} /></span>
            {c ? <a className={s.cardLink} href={`/p/${projectId}/c/${c.id}`}>{`#${c.number} ${c.title}`}</a> : <span>{h.cardId}</span>}
            <span className={`${s.chip} ${s.outcome}`}>{h.outcome ? hopOutcome[h.outcome] : runRunning}</span>
            <span className={s.cost}>
              {h.endedAt ? `${runWords.duration(hopWallMs(h))} · ` : ""}{h.tokensIn !== null && h.tokensOut !== null ? runWords.tokensInOut(h.tokensIn, h.tokensOut) : ""}
            </span>
            {h.note && <p className={s.note}>{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function RunsList({ projectId, runs, hops, workers, cards }: Props) {
  const { byRun, manual } = groupHops(runs, hops);
  if (runs.length === 0 && manual.length === 0) return <p className={s.none}>{runWords.none}</p>;
  return (
    <>
      <ol className={s.runs}>
        {runs.map((r, i) => {
          const mine = byRun.get(r.id) ?? [];
          return (
            <li key={r.id}>
              <details className={s.run} open={i === 0} data-run={r.id}>
                <summary className={s.summary}>
                  <span className={s.when}>{whenOf(r.startedAt)}{r.endedAt ? ` – ${clockOf(r.endedAt)}` : ""}</span>
                  <span className={r.endedAt ? s.chip : `${s.chip} ${s.chipRunning}`}>{r.endedAt ? mode[r.mode] : `${mode[r.mode]} · ${runRunning}`}</span>
                  {r.endedAt && r.stopReason && <span className={`${s.chip} ${s.chipStop}`} data-stop={r.stopReason}>{stopReason[r.stopReason]}</span>}
                  <span className={s.budget}>{budget(r.hopBudget, r.hopsUsed)}</span>
                </summary>
                <div className={s.body}>
                  {r.report && <p className={s.report}>{r.report}</p>}
                  <Cost t={totalsOf(mine)} />
                  <HopRows projectId={projectId} hops={mine} workers={workers} cards={cards} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      {manual.length > 0 && (
        <section className={s.manual} data-manual>
          <h3 className={s.manualTitle}>{mode.manual}</h3>
          <Cost t={totalsOf(manual)} />
          <HopRows projectId={projectId} hops={manual} workers={workers} cards={cards} />
        </section>
      )}
    </>
  );
}
