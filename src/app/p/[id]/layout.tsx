// A CAW project: the header every project screen shares (REQ-011 R5, polish-plan § 2.3, TASK-B-085) — one row: the way back to the projects,
// the project's name and its places (แชต carries what waits on you); on the right the mode and the folders, compact. Below 768 px the places
// take their own row and stay with the header as it sticks. Inside CAW's root (Ant's theme, still used by the screens not yet rebuilt).
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { api } from "@/api";
import { ModeControl } from "@/components/ModeControl";
import { ProjectNav } from "@/components/runs/ProjectNav";
import w from "@/components/workspace/workspace.module.css";
import { WorkspaceEditor } from "@/components/workspace/WorkspaceEditor";
import { homeSummaries } from "@/lib/crew";
import { CawRoot } from "@/theme/CawRoot";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { section, workspace } from "@/words";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, [latest], summary, jar] = await Promise.all([api.project(id), api.runs(id, 1), homeSummaries(api, [{ id }]), cookies()]);
  if (!p) notFound();
  // the newest run decides the header's run state: open, or stopped with its reason (TASK-B-047)
  const lastRun = latest ? { open: latest.endedAt === null, stopReason: latest.stopReason, hopBudget: latest.hopBudget, hopsUsed: latest.hopsUsed, mode: latest.mode } : null;
  return (
    <CawRoot initialDark={jar.get("caw-theme")?.value === "dark" /* CawRoot's THEME_KEY — a server file cannot read a client module's value */}>
      <header className="sticky top-[var(--caw-sample-bar,0px)] z-20 border-b border-hair bg-sheet">
        <div className="mx-auto flex min-h-[72px] max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 max-md:gap-x-3 max-md:px-4 max-md:pb-0">
          <a className="inline-flex min-h-11 items-center text-sm text-ink3 no-underline hover:text-ink" href="/">{section.projects}</a>
          <h1 className="name m-0 max-w-[36ch] text-[26px] font-semibold leading-tight tracking-[-0.01em] max-md:max-w-none max-md:flex-1 max-md:text-[22px]" title={p.name}>{p.name}</h1>
          <div className="max-md:order-last max-md:-mx-1 max-md:w-full">
            <ProjectNav projectId={p.id} waiting={summary[p.id]?.waitingOnYou ?? 0} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3 max-md:ml-0 max-md:w-full">
            {/* the mode's one-line explanation (D-063) wraps under the toggle instead of widening the row, so the header stays one row at 1280 */}
            <div className="max-w-[300px] text-sm max-md:max-w-none">
              <ModeControl projectId={p.id} mode={p.mode} hopBudget={p.hopBudget} hopsUsed={p.hopsUsed} lastRun={lastRun} />
            </div>
            <WorkspaceEditor projectId={p.id} roots={p.workspace.roots} />
            <ThemeToggle />
          </div>
        </div>
        {p.workspace.roots.length === 0 && <p className={w.warn} role="status" data-folder-warn><span className={w.warnIn}>{workspace.none}</span></p>}
      </header>
      {children}
    </CawRoot>
  );
}
