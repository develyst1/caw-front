// โปรเจกต์ (REQ-011 R1): every CAW project — name, the Blueprint version it came from, its mode, cards done / all, how many are stuck —
// each a link to its board. Read through `CawApi` on the server; a back end that cannot be reached says so in words, never a blank page.
import { api } from "@/api";
import { CawError, type ProjectSummary } from "@/api/caw";
import s from "@/components/projects.module.css";
import { CawRoot } from "@/theme/CawRoot";
import { mode, projectCard, section, startRefused } from "@/words";

export const dynamic = "force-dynamic"; // always asks the seam; the list changes as the back end does

export default async function Home() {
  let projects: ProjectSummary[] = [];
  let unreachable = false;
  try { projects = await api.projects(); }
  catch (e) { if (e instanceof CawError && (e.code === "unreachable" || e.status >= 500)) unreachable = true; else throw e; }
  return (
    <CawRoot>
      <header className={s.header}>
        <div className={s.headerIn}>
          <span className={s.mark}>CAW</span>
          <h1 className={s.title}>{section.projects}</h1>
        </div>
      </header>
      <main className={s.main}>
        {unreachable ? (
          <div className={`${s.panel} ${s.panelAlert}`} role="alert"><p className={s.panelText}>{startRefused.unreachable}</p></div>
        ) : projects.length === 0 ? (
          <div className={s.panel}><p className={s.panelText}>{projectCard.none}</p></div>
        ) : (
          <ul className={s.grid}>
            {projects.map((p) => (
              <li key={p.id}>
                <a className={s.project} href={`/p/${p.id}`}>
                  <h2 className={s.name}>{p.name}</h2>
                  <div className={s.meta}>
                    <span className={s.chip}>{projectCard.blueprintVersion(p.version)}</span>
                    <span className={p.mode === "dispatcher" ? `${s.chip} ${s.chipAuto}` : s.chip}>{mode[p.mode]}</span>
                    {p.stuckCount > 0 && <span className={`${s.chip} ${s.chipStuck}`}>{projectCard.stuck(p.stuckCount)}</span>}
                  </div>
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
