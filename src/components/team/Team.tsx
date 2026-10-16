"use client";

// ทีม · สายงาน (REQ-011 R4 → REQ-014 comp 4, TASK-B-065; comps B-068 4a / 4b). The main column: the chain as the editor (ChainPicture) and the
// people as cards — face, roles (`FE +BE`), duty lines, `รายละเอียด` folding model / effort / skills / what a combined one came from. The side
// column: `ความพร้อม` (Bob's `readiness()`, each fix naming people), the selected person's roles + face (saved as you pick), and the add form
// (roles first, skills pre-filled from `skillsFor`). Cutting a line or removing a person with no cards acts at once and offers `เลิกทำ` (A-P6);
// a person with open cards first asks who takes them (A7: no undo then). No `รวมสองคน` (D-060). A refusal shows in words by its control.
import { Button, Input, Select } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Avatar as FaceIds, Chain, Project, Worker, WorkerRole } from "@/api/caw";
import { addEdge, addMember, createWorker, removeEdge, removeMember, setEntry, updateWorker, type TeamResult } from "@/app/p/[id]/team/actions";
import { Face } from "@/components/faces/Face";
import { Avatar } from "@/components/Person";
import { BODIES, COLORS, EYES, faceFor } from "@/lib/faces";
import { readiness, type ReadinessItem } from "@/lib/readiness";
import { skillsFor } from "@/lib/roles";
import {
  faces, live, missing, readiness as rw, redesign, rolePicker, section, team as words, teamRefused, undo,
} from "@/words";
import { ChainPicture, type NodeState } from "./ChainPicture";
import s from "./team.module.css";

const ROLES: WorkerRole[] = ["PM", "BA", "SA", "FE", "BE", "QA"];
const roleWord = (r: WorkerRole) => (r === "other" ? words.roleOther : r);
const refusal = (r: TeamResult) => (r.ok ? null : teamRefused[r.code] ?? teamRefused.other!);

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const go = (fn: () => Promise<TeamResult>, onOk?: () => void, onRefused?: (r: Extract<TeamResult, { ok: false }>) => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (r.ok) onOk?.(); else if (onRefused) onRefused(r); else setError(r.code === "link_failed" ? (r.details as string[]).join(" · ") : refusal(r));
    router.refresh();
  });
  return { pending, error, setError, go };
}
function Refused({ text }: { text: string | null }) { return text ? <p className={s.refused} role="alert">{text}</p> : null; }

/** `เลิกทำ` for 5 s after an act; it sits in the main column, never over the checklist or a request box */
function useUndo() {
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const show = (text: string, fn: () => void) => { if (timer.current) clearTimeout(timer.current); setToast({ text, undo: fn }); timer.current = setTimeout(() => setToast(null), 5000); };
  const node = toast && (
    <div className={s.toast} role="status">
      <span>{toast.text}</span>
      <button type="button" className={s.toastBtn} onClick={() => { toast.undo(); setToast(null); }}>{undo.button}</button>
    </div>
  );
  return { show, node };
}

function RolePicks({ value, onToggle, disabledLast, held }: { value: WorkerRole[]; onToggle: (r: WorkerRole) => void; disabledLast: boolean; held: boolean }) {
  const list: WorkerRole[] = held ? [...ROLES, "other"] : ROLES; // `อื่นๆ` only when someone holds it (A5)
  return (
    <div className={s.picker} role="group">
      {list.map((r) => {
        const on = value.includes(r), lock = disabledLast && on && value.length === 1;
        return (
          <button key={r} type="button" role="checkbox" aria-checked={on} disabled={lock} className={`${s.pick} ${on ? s.pickOn : ""}`} onClick={() => onToggle(r)}>
            <span className={s.box} aria-hidden>{on ? "✓" : ""}</span>
            <b>{roleWord(r)}</b>
            <small>{rolePicker.duty[r]}</small>
          </button>
        );
      })}
    </div>
  );
}

function FacePicker({ name, face, onPick }: { name: string; face: FaceIds; onPick: (f: FaceIds) => void }) {
  const row = (key: "body" | "color" | "eyes", ids: readonly string[]) => (
    <div className={s.faceRow}>
      <b id={`fr-${key}`}>{faces.rows[key]}</b>
      <div className={s.opts} role="radiogroup" aria-labelledby={`fr-${key}`}>
        {ids.map((id) => {
          const next = { ...face, [key]: id } as FaceIds, on = face[key] === id;
          const label = key === "eyes" ? `ตา${faces.eyes[id]}` : faces[key][id]!;
          return (
            <button key={id} type="button" role="radio" aria-checked={on} aria-label={label} title={label}
              className={`${s.opt} ${key === "color" ? s.swatch : ""} ${on ? s.optOn : ""}`} onClick={() => onPick(next)}>
              {key === "color" ? <i style={{ background: `var(--face-${id})` }} /> : <Face face={next} size={34} />}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <section className={s.faces} aria-label={faces.heading(name)}>
      <div className={s.preview}><Face face={face} size={64} /><b>{faces.heading(name)}</b></div>
      {row("body", BODIES)}{row("color", COLORS)}{row("eyes", EYES)}
    </section>
  );
}

export function Team({ projectId, project, workers, chain, openCards, states }: {
  projectId: string; project: Project; workers: Worker[]; chain: Chain; openCards: Record<string, number>; states: Record<string, NodeState>;
}) {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const memberIds = new Set(chain.members.map((m) => m.id));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const edgeAct = useAction(), memberAct = useAction(), workerAct = useAction(), editAct = useAction();
  const toast = useUndo();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? byId.get(selected) : undefined;

  // the chain
  const link = (from: string, to: string) => edgeAct.go(() => addEdge(projectId, from, to));
  const cut = (from: string, to: string) => edgeAct.go(() => removeEdge(projectId, from, to),
    () => toast.show(undo.cut(nameOf(from), nameOf(to)), () => edgeAct.go(() => addEdge(projectId, from, to))));

  // removing a member: with open cards, ask who takes them (no undo); with none, remove now and offer เลิกทำ (re-adds the member and its lines)
  const [removing, setRemoving] = useState<{ id: string; count: number } | null>(null);
  const [takeOver, setTakeOver] = useState<string>();
  const tryRemove = (id: string) => {
    const lines = chain.edges.filter((e) => e.from === id || e.to === id), wasEntry = chain.entryWorkerId === id;
    memberAct.go(() => removeMember(projectId, id),
      () => toast.show(undo.removed(nameOf(id)), () => memberAct.go(async () => {
        const r = await addMember(projectId, id);
        if (!r.ok) return r;
        // A7 (TASK-B-074): every line is checked; one that did not come back is said by name, and the person stays selected to fix it
        const failed: string[] = [];
        for (const e of lines) { const x = await addEdge(projectId, e.from, e.to); if (!x.ok && x.code !== "edge_exists") failed.push(undo.linkFailed(nameOf(e.from), nameOf(e.to))); }
        const entry = wasEntry ? await setEntry(projectId, id) : r;
        if (failed.length > 0) { setSelected(id); return { ok: false, code: "link_failed", details: failed }; }
        return entry;
      })),
      (r) => {
        if (r.code === "has_open_cards") { setRemoving({ id, count: (r.details as { count?: number } | undefined)?.count ?? openCards[id] ?? 0 }); setTakeOver(undefined); }
        else memberAct.setError(refusal(r));
      });
  };

  // editing the selected person: each pick saves at once (roles 1+; the face as all three parts)
  const toggleRole = (w: Worker, r: WorkerRole) => {
    const next = w.roles.includes(r) ? w.roles.filter((x) => x !== r) : [...w.roles, r];
    if (next.length === 0) return;
    editAct.go(() => updateWorker(projectId, w.id, { roles: next, skills: [...new Set([...w.skills, ...skillsFor(next)])] }));
  };

  // the add form: roles first, skills pre-filled from them (the user may add more)
  const [name, setName] = useState(""), [roles, setRoles] = useState<WorkerRole[]>([]), [skills, setSkills] = useState("");
  const toggleNew = (r: WorkerRole) => setRoles((cur) => {
    const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
    const typed = skills.split(",").map((x) => x.trim()).filter(Boolean).filter((k) => !skillsFor(cur).includes(k));
    setSkills([...new Set([...skillsFor(next), ...typed])].join(", "));
    return next;
  });

  // readiness: codes from Bob's pure function, words + fixes that name people here
  const qa = chain.members.find((m) => byId.get(m.id)?.roles.includes("QA"));
  // each fix is a control that takes you to the fix (D-063: "links to the fix"): it moves the focus there and scrolls it into view
  const focus = (selector: string) => { const el = document.querySelector<HTMLElement>(selector); el?.scrollIntoView({ block: "center" }); el?.focus(); };
  const toPerson = (id: string) => () => focus(`[data-worker="${id}"] [data-select]`);
  type Fix = { text?: string; label: string; go: () => void }[];
  const check = (i: ReadinessItem): { line: string; fix: Fix | null } => {
    const who = i.who ?? [], first = who[0];
    if (i.state === "ok") return { line: { entry: rw.entry.ok, reachable: rw.reachable.ok, handoff: rw.handOff.ok, qaNotBuilder: rw.qaNotBuilder.ok, folder: rw.folder.ok }[i.rule], fix: null };
    switch (i.rule) {
      case "entry": return { line: rw.entry.ok, fix: [{ text: `${missing.entry.text} — `, label: missing.entry.fix, go: () => focus("[data-set-entry]") }] };
      case "folder": return { line: rw.folder.ok, fix: [{ text: `${missing.folder.text} — `, label: missing.folder.fix, go: () => focus("[data-folders]") }] };
      case "reachable": return { line: rw.reachable.ok, fix: first ? [{ label: rw.reachable.fix(who.map(nameOf).join(", ")), go: toPerson(first) }] : null };
      case "handoff": return { line: rw.handOff.ok, fix: first ? [{ label: rw.handOff.fix(who.map(nameOf).join(", "), qa ? nameOf(qa.id) : "QA"), go: () => focus(`[data-node="${first}"] [data-out]`) }] : null };
      case "qaNotBuilder": return { line: rw.qaNotBuilder.ok, fix: who.map((id) => ({ label: rw.qaNotBuilder.fix(byId.get(id)?.roles.filter((r) => r === "FE" || r === "BE").join(", ") ?? "", nameOf(id)), go: toPerson(id) })) };
    }
  };
  const memberOptions = chain.members.map((m) => ({ value: m.id, label: m.name }));
  const working = (id: string) => states[id] === "working";

  return (
    <div className={s.page}>
      <div className={s.mainCol}>
        <section className={s.panel} aria-labelledby="chain-h">
          <div className={s.panelHead}><h2 id="chain-h" className={s.h2}>{section.chain}</h2><p className={`${s.hint} ${s.desk}`}>{live.linkHint}</p></div>
          <ChainPicture members={chain.members.map((m) => byId.get(m.id) ?? m)} edges={chain.edges} entryId={chain.entryWorkerId} states={states} onLink={link} onCut={cut} />
          <Refused text={edgeAct.error} />
          {toast.node}
        </section>

        <section className={s.panel} aria-labelledby="team-h">
          <h2 id="team-h" className={s.h2}>{section.team}</h2>
          <ul className={s.people}>
            {workers.map((w) => {
              const member = memberIds.has(w.id), isEntry = w.id === chain.entryWorkerId;
              return (
                <li key={w.id} className={`${s.person} ${selected === w.id ? s.personOn : ""} ${isEntry ? s.personEntry : ""}`} data-worker={w.id}>
                  <div className={s.personHead}>
                    <Avatar name={w.name} avatar={w.avatar} size="lg" state={states[w.id] ?? null} />
                    <div className={s.personName}>
                      <b>{w.name}</b>
                      <span className={s.roles}>{w.roles.map((r, k) => <span key={r} className={s.role} data-role>{k ? `+${roleWord(r)}` : roleWord(r)}</span>)}
                        {isEntry && <span className={s.entryTag} data-entry-tag>{words.entry}</span>}
                        {working(w.id) && <span className={s.nowTag}>{redesign.workingNow}</span>}</span>
                    </div>
                  </div>
                  <p className={s.duty}>{w.roles.map((r) => rolePicker.duty[r]).filter(Boolean).join(" · ")}</p>
                  <details className={s.details}>
                    <summary>{rolePicker.details}</summary>
                    <dl className={s.facts}>
                      <div><dt>{words.model}</dt><dd data-model>{w.model}</dd></div>
                      <div><dt>{words.effort}</dt><dd>{words.effortLevel[w.effort] ?? w.effort}</dd></div>
                      <div><dt>{words.skills}</dt><dd data-skills>{w.skills.join(", ")}</dd></div>
                    </dl>
                    {w.combinedFrom && <p className={s.hint}>{words.combinedFrom(nameOf(w.combinedFrom[0]!), nameOf(w.combinedFrom[1]!))}</p>}
                  </details>
                  <div className={s.actions}>
                    <Button size="large" data-select onClick={() => setSelected(selected === w.id ? null : w.id)} aria-pressed={selected === w.id}>{rolePicker.heading(w.name)}</Button>
                    {member && !isEntry && <Button size="large" data-set-entry onClick={() => memberAct.go(() => setEntry(projectId, w.id))}>{words.setEntry}</Button>}
                    {member
                      ? <Button size="large" type="text" onClick={() => tryRemove(w.id)} aria-label={`${words.remove} ${w.name}`}>{words.remove}</Button>
                      : <Button size="large" onClick={() => memberAct.go(() => addMember(projectId, w.id))}>{words.addToChain}</Button>}
                  </div>
                  {removing?.id === w.id && (
                    <div className={s.reassign} role="group" aria-labelledby={`re-${w.id}`}>
                      <p id={`re-${w.id}`} className={s.reassignAsk}>{words.reassign(w.name, removing.count)}</p>
                      <Select size="large" className={s.select} aria-labelledby={`re-${w.id}`} value={takeOver} onChange={setTakeOver} options={memberOptions.filter((o) => o.value !== w.id)} />
                      <Button size="large" type="primary" disabled={!takeOver || memberAct.pending}
                        onClick={() => memberAct.go(() => removeMember(projectId, w.id, takeOver), () => setRemoving(null))}>{words.remove}</Button>
                      <Button size="large" type="text" onClick={() => setRemoving(null)}>{words.cancel}</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Refused text={memberAct.error} />
        </section>
      </div>

      <aside className={s.sideCol}>
        <section className={s.panel} aria-labelledby="ready-h">
          <h2 id="ready-h" className={s.h2}>{rw.heading}</h2>
          <ul className={s.checks}>
            {readiness(project, chain, workers).map((i) => {
              const c = check(i);
              return (
                <li key={i.rule} className={s[i.state]} data-check={i.rule} data-state={i.state}>
                  <i aria-hidden>{i.state === "ok" ? "✓" : i.state === "bad" ? "!" : "·"}</i>
                  <span>{c.line}</span>
                  {c.fix && <span className={s.fix}>{c.fix.map((f, k) => <span key={k}>{f.text}<button type="button" className={s.fixLink} onClick={f.go} data-fix>{f.label}</button></span>)}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {sel && (
          <section className={s.panel} aria-labelledby="sel-h" data-side-panel>
            <h2 id="sel-h" className={s.h2}>{rolePicker.heading(sel.name)}</h2>
            <p className={s.hint}>{rolePicker.hint}</p>
            <RolePicks value={sel.roles} onToggle={(r) => toggleRole(sel, r)} disabledLast held={sel.roles.includes("other")} />
            {working(sel.id) && <p className={s.hint}>{live.rolesNextJob}</p>}
            <FacePicker name={sel.name} face={faceFor(sel)} onPick={(f) => editAct.go(() => updateWorker(projectId, sel.id, { avatar: f }))} />
            <Refused text={editAct.error} />
          </section>
        )}

        <form className={s.panel} data-add-worker onSubmit={(e) => { e.preventDefault(); const sk = skills.split(",").map((x) => x.trim()).filter(Boolean);
          workerAct.go(() => createWorker(projectId, { name: name.trim(), roles, skills: sk }), () => { setName(""); setRoles([]); setSkills(""); }); }}>
          <h2 className={s.h2}>{words.addWorker}</h2>
          <label className={s.field}><span className={s.label}>{words.name}</span><Input size="large" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className={s.field}><span className={s.label}>{words.role}</span><RolePicks value={roles} onToggle={toggleNew} disabledLast={false} held={false} /></div>
          <label className={s.field}><span className={s.label}>{words.skills}</span>
            <Input size="large" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={words.skillsHint} /></label>
          <Button size="large" type="primary" htmlType="submit" disabled={!name.trim() || roles.length === 0 || !skills.trim() || workerAct.pending}>{words.addWorker}</Button>
          <Refused text={workerAct.error} />
        </form>
      </aside>
    </div>
  );
}
