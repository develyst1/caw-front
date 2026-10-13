// A CAW project: the header every project screen shares (REQ-011 R5) — the way back to the projects, the project's name, and the
// one mode control with its budget — inside CAW's root (font, tokens, Ant theme).
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { api } from "@/api";
import { ModeControl } from "@/components/ModeControl";
import s from "@/components/board.module.css";
import { CawRoot } from "@/theme/CawRoot";
import { section } from "@/words";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await api.project(id);
  if (!p) notFound();
  return (
    <CawRoot>
      <header className={s.header}>
        <div className={s.headerIn}>
          <a className={s.back} href="/">{section.projects}</a>
          <h1 className={s.name}>{p.name}</h1>
          <ModeControl projectId={p.id} mode={p.mode} hopBudget={p.hopBudget} hopsUsed={p.hopsUsed} />
        </div>
      </header>
      {children}
    </CawRoot>
  );
}
