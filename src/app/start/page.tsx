// เริ่มโปรเจกต์ (REQ-011 R1): the page Blueprint's "ส่งไปสร้างที่ CAW" opens with `?project=<Blueprint project id>&version=<n>`. It asks the
// back end to make the project and goes to its board; if one already exists for that version (409 already_exists) it goes to that one.
// Anything else is said in words with the way back. The POST is idempotent, so a reload or a prefetch does no harm.
import { redirect } from "next/navigation";
import { api, onSampleData } from "@/api";
import { isCawError } from "@/api/caw";
import s from "@/components/projects.module.css";
import st from "./start.module.css";
import { CawRoot } from "@/theme/CawRoot";
import { ThemeToggle } from "@/theme/ThemeToggle";
import { sampleData, section, startRefused } from "@/words";

export const dynamic = "force-dynamic";

type Refusal = keyof typeof startRefused;
const refusalOf = (e: unknown): Refusal => {
  if (!isCawError(e)) throw e; // a bug, not a refusal: let Next show it
  if (e.code === "unreachable" || e.status >= 500) return "unreachable";
  return e.code === "blueprint_project_not_found" || e.code === "version_not_confirmed" ? e.code : "other";
};

export default async function Start({ searchParams }: { searchParams: Promise<{ project?: string; version?: string }> }) {
  const { project, version } = await searchParams;
  const n = Number(version);
  let target: string | null = null;
  let refused: Refusal | null = null;
  if (!project || !Number.isInteger(n) || n < 1) refused = "incomplete";
  else {
    try { target = (await api.createProject({ blueprintProjectId: project, version: n })).id; }
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
          <span className={s.mark}>CAW</span>
          <h1 className={s.title}>{section.projects}</h1>
          <span className={st.spacer} />
          <ThemeToggle />
        </div>
      </header>
      <main className={s.main}>
        <div className={st.panel} role="alert">
          {/* on sample data the mock cannot know real Blueprint projects — "not found" would be the wrong sentence (D-058) */}
          <p className={st.text}>{refused === "blueprint_project_not_found" && onSampleData() ? sampleData : startRefused[refused ?? "other"]}</p>
          <a className={st.back} href="/">{section.projects}</a>
        </div>
      </main>
    </CawRoot>
  );
}
