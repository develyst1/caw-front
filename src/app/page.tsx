// โปรเจกต์ (REQ-011 R1): every CAW project — name, the Blueprint version it came from, its mode, cards done / all, how many are stuck —
// each a link to its board. Read through `CawApi` on the server; a back end that cannot be reached says so in words, never a blank page.
// REQ-014 (TASK-B-064, comp B-068 1): each row also says who is working now, how many are stuck and wait on you (Bob's `homeSummaries`), and shows
// the team's faces; a project with no team says so. The header has the light / dark toggle; the empty state has one button to Blueprint.
import { api } from "@/api";
import { CawError, type Chain, type ProjectSummary } from "@/api/caw";
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
  } catch (e) { if (e instanceof CawError && (e.code === "unreachable" || e.status >= 500)) unreachable = true; else throw e; }
  return (
    <CawRoot>
      {/* the home follows every project without a reload (C4): the idle poll, 30 s */}
      {projects.map((p) => <LiveRefresh key={p.id} projectId={p.id} after={seqs[p.id] ?? 0} busy={false} />)}
      <header className={s.header}>
        <div className={s.headerIn}>
          <span className={s.mark}>CAW</span>
          <h1 className={s.title}>{section.projects}</h1>
          <span className={s.spacer} />
          <ThemeToggle />
        </div>
      </header>
      <main className={s.main}>
        {unreachable ? (
          <div className={`${s.panel} ${s.panelAlert}`} role="alert"><p className={s.panelText}>{startRefused.unreachable}</p></div>
        ) : projects.length === 0 ? (
          <div className={`${s.panel} ${s.empty}`}><p className={s.panelText}>{projectCard.none}</p><a className={s.cta} href={blueprintHome}>{redesign.openBlueprint}</a></div>
        ) : (
          <ul className={s.grid}>
            {projects.map((p) => (
              <li key={p.id}>
                <a className={s.project} href={`/p/${p.id}`} data-project>
                  <h2 className={s.name}>{p.name}</h2>
                  <div className={s.meta}>
                    <span className={s.chip}>{projectCard.blueprintVersion(p.version)}</span>
                    <span className={p.mode === "dispatcher" ? `${s.chip} ${s.chipAuto}` : s.chip}>{mode[p.mode]}</span>
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
                    <div className={s.bar} role="progressbar" aria-label={projectCard.done(p.cardsDone, p.cardsTotal)} aria-valuemin={0} aria-valuemax={p.cardsTotal} aria-valuenow={p.cardsDone}>
                      <span className={s.barFill} style={{ width: `${p.cardsTotal ? (100 * p.cardsDone) / p.cardsTotal : 0}%` }} />
                    </div>
                    <span className={s.progressText}>{projectCard.done(p.cardsDone, p.cardsTotal)}</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </CawRoot>
  );
}
