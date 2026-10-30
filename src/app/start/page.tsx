// เริ่มโปรเจกต์ (REQ-011 R1): the page Blueprint's "ส่งไปสร้างที่ CAW" opens with `?project=<Blueprint project id>` (REQ-105: `&version=<n>` may come too and is
// passed on, but the project alone is enough — CAW follows the latest spec). It asks the back end to make the project and goes to its board; if one already
// exists (409 already_exists) it goes to that one.
// Anything else is said in words with the way back. The POST is idempotent, so a reload or a prefetch does no harm. The header is the home's shell
// (S-1, P-4, TASK-B-100): no CAW mark, and no heading of its own — this page is not the projects list; the button says where it goes.
import { redirect } from "next/navigation";
import { api, onSampleData } from "@/api";
import { isCawError } from "@/api/caw";
import s from "@/components/projects.module.css";
import st from "./start.module.css";
import { CawRoot } from "@/theme/CawRoot";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { distill, sampleData, section, startRefused } from "@/words";

export const dynamic = "force-dynamic";

type Refusal = keyof typeof startRefused;
const refusalOf = (e: unknown): Refusal => {
  if (!isCawError(e)) throw e; // a bug, not a refusal: let Next show it
  if (e.code === "unreachable" || e.status >= 500) return "unreachable";
  return e.code === "blueprint_project_not_found" ? e.code : "other";
};

export default async function Start({ searchParams }: { searchParams: Promise<{ project?: string; version?: string }> }) {
  const { project, version } = await searchParams;
  const n = Number(version);
  const label = Number.isInteger(n) && n >= 1 ? n : undefined; // only a whole label number is passed on; anything else is left out (the back end ignores it either way)
  let target: string | null = null;
  let refused: Refusal | null = null;
  if (!project) refused = "incomplete";
  else {
    try { target = (await api.createProject(label === undefined ? { blueprintProjectId: project } : { blueprintProjectId: project, version: label })).id; }
    catch (e) {
      if (isCawError(e) && e.code === "already_exists" && typeof (e.details as { id?: unknown } | undefined)?.id === "string") target = (e.details as { id: string }).id;
      else refused = refusalOf(e);
    }
  }
  if (target) redirect(`/p/${target}`); // outside the try: redirect() works by throwing
  return (
    <CawRoot>
      <header className={s.header}>
        <div className={s.headerIn}>
          <span className={s.title}>{section.projects}</span>
          <span className={st.spacer} />
          <ThemeToggle />
        </div>
      </header>
      <main className={s.main}>
        <div className={st.panel} role="alert">
          {/* on sample data the mock cannot know real Blueprint projects — "not found" would be the wrong sentence (D-058) */}
          <p className={st.text}>{refused === "blueprint_project_not_found" && onSampleData() ? sampleData : startRefused[refused ?? "other"]}</p>
          <a className={st.back} href="/">{distill.backToProjects}</a>
        </div>
      </main>
    </CawRoot>
  );
}
