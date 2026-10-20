// A CAW project: the header every project screen shares (REQ-011 R5, polish-plan § 2.3, TASK-B-085 → TASK-B-099, D-094 § 1) — one job: say which
// project you are in and get you between its places. One row: the way back to the projects, the project's name, its places (แชต carries what
// waits on you), a small `กำลังรัน` while a run is open (H-1: the mode itself lives on the board), and the theme. Below 768 px the places take
// their own row and stay with the header as it sticks; no menu (H-4). Folders live on ทีม (H-3); no warning bar here (H-5).
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { api } from "@/api";
import { ProjectNav } from "@/components/runs/ProjectNav";
import { homeSummaries } from "@/lib/crew";
import { CawRoot } from "@/theme/CawRoot";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { runRunning, section } from "@/words";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, [latest], summary, jar] = await Promise.all([api.project(id), api.runs(id, 1), homeSummaries(api, [{ id }]), cookies()]);
  if (!p) notFound();
  const running = !!latest && latest.endedAt === null; // the newest run is the open one, if any (TASK-B-047)
  return (
    <CawRoot initialDark={jar.get("caw-theme")?.value === "dark" /* CawRoot's THEME_KEY — a server file cannot read a client module's value */}>
      <header className="sticky top-[var(--caw-sample-bar,0px)] z-20 border-b border-hair bg-sheet">
        <div className="mx-auto flex min-h-[72px] max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 max-md:gap-x-3 max-md:px-4 max-md:pb-0">
          <a className="inline-flex min-h-11 items-center text-sm text-ink3 no-underline hover:text-ink" href="/">{section.projects}</a>
          <h1 className="name m-0 max-w-[36ch] text-[26px] font-semibold leading-tight tracking-[-0.01em] max-md:max-w-none max-md:flex-1 max-md:text-[22px]" title={p.name}>{p.name}</h1>
          <div className="max-md:order-last max-md:-mx-1 max-md:w-full">
            <ProjectNav projectId={p.id} waiting={summary[p.id]?.waitingOnYou ?? 0} />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {running && <span className="inline-flex min-h-[26px] items-center rounded-md bg-now-soft px-2 text-sm font-semibold text-now" data-run-mark>{runRunning}</span>}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </CawRoot>
  );
}
