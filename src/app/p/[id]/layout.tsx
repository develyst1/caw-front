// A CAW project: the header every project screen shares (REQ-011 R5) — the way back to the projects, the project's name, and the
// one mode control with its budget — inside CAW's root (font, tokens, Ant theme).
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { api } from "@/api";
import { ModeControl } from "@/components/ModeControl";
import { ProjectNav } from "@/components/runs/ProjectNav";
import w from "@/components/workspace/workspace.module.css";
import { WorkspaceEditor } from "@/components/workspace/WorkspaceEditor";
import s from "@/components/board.module.css";
import { CawRoot } from "@/theme/CawRoot";
import { section, workspace } from "@/words";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, [latest]] = await Promise.all([api.project(id), api.runs(id, 1)]);
  if (!p) notFound();
  // the newest run decides the header's run state: open, or stopped with its reason (TASK-B-047)
  const lastRun = latest ? { open: latest.endedAt === null, stopReason: latest.stopReason } : null;
  return (
    <CawRoot>
      <header className={s.header}>
        <div className={s.headerIn}>
          <a className={s.back} href="/">{section.projects}</a>
          <h1 className={s.name}>{p.name}</h1>
          <ModeControl projectId={p.id} mode={p.mode} hopBudget={p.hopBudget} hopsUsed={p.hopsUsed} lastRun={lastRun} />
          <WorkspaceEditor projectId={p.id} roots={p.workspace.roots} />
        </div>
        <ProjectNav projectId={p.id} />
        {p.workspace.roots.length === 0 && <p className={w.warn} role="status"><span className={w.warnIn}>{workspace.none}</span></p>}
      </header>
      {children}
    </CawRoot>
  );
}
