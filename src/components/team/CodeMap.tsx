"use client";

// The code map on ทีม (REQ-015 R2, SPEC-A-009 § 2c, TASK-B-106): what the team learned about the code — the folders (named as D-098 names them, with their kind
// and note), the stack, the run and test commands, the rules (`ไม่มี` when none), the open questions with their proposed answers, and notes. One look, one
// primary: `ยืนยัน` confirms it as it stands; corrections go through the chat (`แก้ผ่านแชต`). Direction B: one hairline section, sections by spacing, no
// box inside a box. A new or changed map arrives through the page's LiveRefresh (`project.code_map_saved`).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CodeMap as Map_ } from "@/api/caw";
import { confirmCodeMap } from "@/app/p/[id]/team/actions";
import { Button } from "@/components/ui/button";
import { folderName } from "@/components/workspace/roots";
import { codeMapWords as w, proposedAnswer, teamRefused } from "@/words";

const day = (iso: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <h3 className="m-0 text-sm font-semibold text-ink2">{title}</h3>
      {children}
    </div>
  );
}

export function CodeMap({ projectId, map }: { projectId: string; map: Map_ }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const names = map.folders.map((f) => f.name);
  const confirm = () => start(async () => {
    const r = await confirmCodeMap(projectId);
    setError(r.ok ? null : teamRefused[r.code] ?? teamRefused.other ?? r.code);
    router.refresh();
  });
  const code = "rounded-md bg-now-soft px-2 py-0.5 font-mono text-sm text-ink [overflow-wrap:anywhere]";
  return (
    <section id="code-map" className="scroll-mt-28 rounded-[10px] border border-hair bg-sheet" aria-labelledby="code-map-h" data-code-map data-confirmed={map.confirmedAt !== null}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-6 py-4 max-md:px-4">
        <h2 id="code-map-h" className="m-0 text-[19px] font-semibold">{w.heading}</h2>
        {map.confirmedAt !== null
          ? <span className="text-sm font-semibold text-now" data-code-map-confirmed>{w.confirmed(day(map.confirmedAt))}</span>
          : <div className="flex flex-wrap items-center gap-3">
              <a href={`/p/${projectId}/chat`} className="inline-flex min-h-11 items-center text-sm text-ink2 underline underline-offset-4 hover:text-ink" data-code-map-fix>{w.fixInChat}</a>
              <Button className="min-h-11 px-5 font-semibold" disabled={pending} onClick={confirm} data-code-map-confirm>{w.confirm}</Button>
            </div>}
      </div>
      <div className="grid gap-5 px-6 py-5 text-[15px] max-md:px-4">
        <Block title={w.folders}>
          <ul className="m-0 grid list-none gap-1 p-0">
            {map.folders.map((f) => (
              <li key={f.name} className="flex flex-wrap items-baseline gap-x-3" data-code-map-folder>
                <b className="font-semibold" title={f.name}>{folderName(f.name, names)}</b>
                <span className="text-sm font-semibold text-ink3" data-kind={f.kind}>{w.kind[f.kind]}</span>
                {f.note && <span className="text-ink2">{f.note}</span>}
              </li>
            ))}
          </ul>
        </Block>
        <Block title={w.stack}><p className="m-0" data-code-map-stack>{map.stack.join(" · ")}</p></Block>
        <div className="grid gap-5 md:grid-cols-2">
          {(["run", "test"] as const).map((k) => (
            <Block key={k} title={w[k]}>
              {map.commands[k].length === 0 ? <p className="m-0 text-ink3">{w.none}</p>
                : <ul className="m-0 grid list-none gap-1.5 p-0">{map.commands[k].map((c) => <li key={c}><code className={code} data-code-map-command={k}>{c}</code></li>)}</ul>}
            </Block>
          ))}
        </div>
        <Block title={w.rules}>
          {map.rules.length === 0 ? <p className="m-0 text-ink3" data-code-map-rules="none">{w.none}</p>
            : <ul className="m-0 grid gap-1 pl-5" data-code-map-rules>{map.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
        </Block>
        {map.questions.length > 0 && (
          <Block title={w.questions}>
            <ul className="m-0 grid list-none gap-2 p-0">
              {map.questions.map((q) => (
                <li key={q.text} data-code-map-question>
                  <p className="m-0 font-semibold">{q.text}</p>
                  <p className="m-0 text-sm text-ink2">{proposedAnswer} <b className="font-semibold text-ink">{q.proposedDefault}</b></p>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {map.notes && <Block title={w.notes}><p className="m-0 whitespace-pre-wrap text-ink2" data-code-map-notes>{map.notes}</p></Block>}
        {error && <p className="m-0 rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{error}</p>}
      </div>
    </section>
  );
}
