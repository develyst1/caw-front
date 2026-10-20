// โปรเจกต์ (REQ-011 R1): every CAW project — name, the Blueprint version it came from, its mode, cards done / all, how many are stuck —
// each a link to its board. Read through `CawApi` on the server; a back end that cannot be reached says so in words, never a blank page.
// REQ-014 (TASK-B-064, comp B-068 1): each row also says who is working now, how many are stuck and wait on you (Bob's `homeSummaries`), and shows
// the team's faces; a project with no team says so. The header has the light / dark toggle; the empty state has one button to Blueprint.
// TASK-B-100 (D-094 § 7): the "projects come from Blueprint" line only in the empty state — with projects, a quiet เปิด Blueprint in the header (P-1);
// no bar while a project has no cards (P-2); the mode chip only while อัตโนมัติ is running (P-3); one header shell with /start (P-4, S-1).
import { api } from "@/api";
import { isCawError, type Chain, type ProjectSummary } from "@/api/caw";
import { blueprintPartHref } from "@/blueprint";
import { Avatar } from "@/components/Person";
import { LiveRefresh } from "@/components/LiveRefresh";
import { homeSummaries, type CrewSummary } from "@/lib/crew";
import { lastSeq } from "@/lib/eventSeq";
import { ThemeToggle } from "@/theme/ThemeToggle";
import s from "@/components/projects.module.css";
import { CawRoot } from "@/theme/CawRoot";
import { live, mode, projectCard, redesign, section, startRefused } from "@/words";

// Blueprint's own address, from the one place CAW builds Blueprint links (blueprint.ts) — no second copy of the URL
const blueprintHome = new URL(blueprintPartHref("x", "x")).origin;

export const dynamic = "force-dynamic"; // always asks the seam; the list changes as the back end does

export default async function Home() {
  let projects: ProjectSummary[] = [];
  let unreachable = false;
  let live_: Record<string, CrewSummary> = {};
  let chains: Record<string, Chain | null> = {};
  let seqs: Record<string, number> = {};
  try {
    projects = await api.projects();
    [live_, chains, seqs] = await Promise.all([homeSummaries(api, projects), Promise.all(projects.map(async (p) => [p.id, await api.chain(p.id)] as const)).then(Object.fromEntries),
      Promise.all(projects.map(async (p) => [p.id, await lastSeq(api, p.id)] as const)).then(Object.fromEntries)]);
  } catch (e) { if (isCawError(e) && (e.code === "unreachable" || e.status >= 500)) unreachable = true; else throw e; }
  // TASK-B-088 § 2.5: what waits on you first, then what is stuck; otherwise the back end's order stays
  const order = (id: string) => [-(live_[id]?.waitingOnYou ?? 0), -(live_[id]?.stuck ?? 0)] as const;
  projects = [...projects].sort((a, b) => { const x = order(a.id), y = order(b.id); return x[0] - y[0] || x[1] - y[1]; });
  return (
    <CawRoot>
      {/* the home follows every project without a reload (C4): one 3 s poll per project (D-088, TASK-B-092) */}
      {projects.map((p) => <LiveRefresh key={p.id} projectId={p.id} after={seqs[p.id] ?? 0} />)}
      <header className={s.header}>
        <div className={s.headerIn}>
          <h1 className={s.title}>{section.projects}</h1>
          <span className={s.spacer} />
          {projects.length > 0 && <a className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-now no-underline hover:underline" href={blueprintHome} data-open-blueprint>{redesign.openBlueprint}</a>}
          <ThemeToggle />
        </div>
      </header>
      <main className={s.main}>
        {unreachable ? (
          <div className={`${s.panel} ${s.panelAlert}`} role="alert"><p className={s.panelText}>{startRefused.unreachable}</p></div>
        ) : projects.length === 0 ? (
          <div className={`${s.panel} ${s.empty}`}><p className={s.panelText}>{projectCard.none}</p><a className={s.cta} href={blueprintHome}>{redesign.openBlueprint}</a></div>
        ) : (
          <>
          <ul className={s.grid}>
            {projects.map((p) => (
              <li key={p.id}>
                <a className={s.project} href={`/p/${p.id}`} data-project>
                  <h2 className={s.name}>{p.name}</h2>
                  <div className={s.meta}>
                    <span className={s.chip}>{projectCard.blueprintVersion(p.version)}</span>
                    {/* P-3: the mode is news only while อัตโนมัติ is running (someone is working); the board says it otherwise */}
                    {p.mode === "dispatcher" && live_[p.id]?.working && <span className={`${s.chip} ${s.chipAuto}`} data-mode-chip>{mode.dispatcher}</span>}
                    {/* C2 (TASK-B-074): stuck = the board's stuck column (homeSummaries), the same number the board shows */}
                    {(live_[p.id]?.stuck ?? 0) > 0 && <span className={`${s.chip} ${s.chipStuck}`}>{projectCard.stuck(live_[p.id]!.stuck)}</span>}
                    {(live_[p.id]?.waitingOnYou ?? 0) > 0 && <span className={`${s.chip} ${s.chipAsk}`}>{live.waitingOnYou(live_[p.id]!.waitingOnYou)}</span>}
                  </div>
                  {(chains[p.id]?.members.length ?? 0) === 0 ? <span className={s.noTeam}>{redesign.noTeam}</span> : (
                    <div className={s.live}>
                      <span className={s.faces} aria-hidden>{chains[p.id]!.members.map((m) => <Avatar key={m.id} name={m.name} avatar={m.avatar} size="sm" state={live_[p.id]?.working === m.name ? "working" : null} />)}</span>
                      {live_[p.id]?.working && <span className={s.working}>{live_[p.id]!.working} {redesign.workingNow}</span>}
                    </div>
                  )}
                  <div className={s.progress}>
                    {p.cardsTotal > 0 && <div className={s.bar} role="progressbar" aria-label={projectCard.done(p.cardsDone, p.cardsTotal)} aria-valuemin={0} aria-valuemax={p.cardsTotal} aria-valuenow={p.cardsDone}>
                      <span className={s.barFill} style={{ width: `${p.cardsTotal ? (100 * p.cardsDone) / p.cardsTotal : 0}%` }} />
                    </div>}
                    <span className={s.progressText}>{projectCard.done(p.cardsDone, p.cardsTotal)}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          </>
        )}
      </main>
    </CawRoot>
  );
}
