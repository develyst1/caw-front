"use client";

// First steps (REQ-014 R1, SPEC-B-003 Decision 4 + STUDY-002 merge, comps B-066/B-068 2): one panel, three ordered steps — the team, the folders,
// the first request — each done ✓ with its fact, the current one with its one action, and none locked (step 3 is open at once: the chat runs
// without folders, SPEC A2). The head counts `พร้อมเริ่ม {done}/3`; at 3/3 the panel folds to that one line. The screen shows it until cards exist.
import { Button, Input } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useStartingTeam } from "@/app/p/[id]/actions";
import { saveRoots } from "@/components/workspace/actions";
import { canAdd } from "@/components/workspace/roots";
import { cardRefused, live, redesign, workspace } from "@/words";
import s from "./FirstSteps.module.css";

export function FirstSteps({ projectId, teamSize, roots, hasChat }: { projectId: string; teamSize: number; roots: string[]; hasChat: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const done = { team: teamSize > 0, folder: roots.length > 0, chat: hasChat };
  const count = Object.values(done).filter(Boolean).length;
  const current = !done.team ? "team" : !done.folder ? "folder" : !done.chat ? "chat" : null;

  const team = () => start(async () => {
    const r = await useStartingTeam(projectId);
    setRefused(r.ok ? null : cardRefused[r.code] ?? cardRefused.other!);
    router.refresh();
  });
  const add = () => {
    const path = draft.trim();
    if (!canAdd(roots, path)) { setRefused(workspace.hint); return; }
    start(async () => {
      const r = await saveRoots(projectId, [...roots, path]);
      setRefused(r.ok ? null : workspace.hint);
      if (r.ok) { setDraft(""); router.refresh(); }
    });
  };

  if (count === 3) return <p className={s.folded} data-first-steps data-folded>{live.readyCount(3)}</p>;

  const step = (key: keyof typeof done, n: number, title: string, body: React.ReactNode) => (
    <li className={`${s.step} ${done[key] ? s.done : current === key ? s.current : s.open}`} data-step={key} data-done={done[key]} aria-current={current === key ? "step" : undefined}>
      <span className={s.no} aria-hidden>{done[key] ? "✓" : n}</span>
      <div className={s.body}>
        <div className={s.title}><h3>{title}</h3>
          {key === "team" && done.team && <span className={s.fact}>{live.teamFact(teamSize)}</span>}
          {key === "folder" && done.folder && <span className={s.fact}>{live.folderFact(roots.length)}</span>}
        </div>
        {!done[key] && body}
      </div>
    </li>
  );

  return (
    <section className={s.panel} aria-labelledby="fs-h" data-first-steps>
      <div className={s.head}>
        <h2 id="fs-h">{redesign.stepsHeading}</h2>
        <span className={s.ready}>{live.readyCount(count)}<i aria-hidden><b style={{ width: `${(count / 3) * 100}%` }} /></i></span>
        <p className={s.line}>{redesign.stepsLine}</p>
      </div>
      <ol className={s.steps}>
        {step("team", 1, redesign.setUpTeam, <>
          <p>{redesign.stepTeamText}</p>
          <p className={s.chain}>{redesign.startingChain}</p>
          <div className={s.row}>
            <Button size="large" type={current === "team" ? "primary" : "default"} loading={pending} onClick={team}>{redesign.useStartingTeam}</Button>
            <a className={s.quiet} href={`/p/${projectId}/team`}>{redesign.ownTeam}</a>
          </div>
        </>)}
        {step("folder", 2, workspace.heading, <>
          <p>{workspace.hint}</p>
          <form className={s.row} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Input size="large" value={draft} placeholder={workspace.hint} aria-label={workspace.heading} onChange={(e) => { setDraft(e.target.value); setRefused(null); }} />
            <Button size="large" htmlType="submit" type={current === "folder" ? "primary" : "default"} loading={pending}>{workspace.add}</Button>
          </form>
        </>)}
        {step("chat", 3, redesign.stepChatTitle, <p>{redesign.stepChatText}</p>)}
      </ol>
      {refused && <p className={s.refused} role="alert">{refused}</p>}
    </section>
  );
}
