"use client";

// ทีม · สายงาน (REQ-011 R4, TASK-B-042). Two sections:
//  · สายงาน — the chain as a picture (ChainPicture) with, beside it, its hand-offs (each removable), an add-edge form (the keyboard
//    and screen-reader path besides the picture), and the members: set the entry worker, remove one — a member still holding open
//    cards asks who takes them first (the back end's `has_open_cards`).
//  · ทีม — every worker (global): name, role, model, effort, skills, what a combined one was made from; add one to the chain;
//    add a new worker (model and effort default by role on the back end); combine two.
// Every write is a server action; a refusal shows in words (`teamRefused`) in a role="alert" line by its control.
import { Button, Input, Select, Tag } from "antd";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { Chain, Worker, WorkerRole } from "@/api/caw";
import { addEdge, addMember, combineWorkers, createWorker, removeEdge, removeMember, setEntry, type TeamResult } from "@/app/p/[id]/team/actions";
import { handoffLine, section, team as words, teamRefused } from "@/words";
import { ChainPicture } from "./ChainPicture";
import s from "./team.module.css";

const ROLES: WorkerRole[] = ["PM", "SA", "FE", "BE", "QA", "other"];
const roleWord = (w: { role: WorkerRole }) => (w.role === "other" ? words.roleOther : w.role);
const refusal = (r: TeamResult) => (r.ok ? null : teamRefused[r.code] ?? teamRefused.other!);

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // onOk after a success; a refusal shows in words — unless onRefused takes it (removing a member with open cards)
  const go = (fn: () => Promise<TeamResult>, onOk?: () => void, onRefused?: (r: Extract<TeamResult, { ok: false }>) => void) => start(async () => {
    setError(null);
    const r = await fn();
    if (r.ok) onOk?.();
    else if (onRefused) onRefused(r);
    else setError(refusal(r));
    router.refresh();
  });
  return { pending, error, setError, go };
}
function Refused({ text }: { text: string | null }) { return text ? <p className={s.refused} role="alert">{text}</p> : null; }

export function Team({ projectId, workers, chain, openCards }: { projectId: string; workers: Worker[]; chain: Chain; openCards: Record<string, number> }) {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const memberIds = new Set(chain.members.map((m) => m.id));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const [picked, setPicked] = useState<string | null>(null);
  const edgeAct = useAction(), memberAct = useAction(), workerAct = useAction(), combineAct = useAction();
  const ids = { from: useId(), to: useId(), name: useId(), role: useId(), skills: useId(), a: useId(), b: useId(), cname: useId() };

  // the picture: first press chooses the sender, the second the receiver (the same one again lets go)
  const pick = (id: string) => {
    if (!picked) return setPicked(id);
    if (picked === id) return setPicked(null);
    const from = picked;
    setPicked(null);
    edgeAct.go(() => addEdge(projectId, from, id));
  };
  const [edgeFrom, setEdgeFrom] = useState<string>();
  const [edgeTo, setEdgeTo] = useState<string>();

  // removing a member: a member with open cards first asks who takes them
  const [removing, setRemoving] = useState<{ id: string; count: number } | null>(null);
  const [takeOver, setTakeOver] = useState<string>();
  const tryRemove = (id: string) => memberAct.go(() => removeMember(projectId, id), undefined, (r) => {
    if (r.code === "has_open_cards") {
      setRemoving({ id, count: (r.details as { count?: number } | undefined)?.count ?? openCards[id] ?? 0 });
      setTakeOver(undefined);
    } else memberAct.setError(refusal(r));
  });

  const [name, setName] = useState(""), [role, setRole] = useState<WorkerRole>("FE"), [skills, setSkills] = useState("");
  const [ca, setCa] = useState<string>(), [cb, setCb] = useState<string>(), [cname, setCname] = useState("");
  const memberOptions = chain.members.map((m) => ({ value: m.id, label: m.name }));
  const workerOptions = workers.map((w) => ({ value: w.id, label: w.name }));

  return (
    <div className={s.page}>
      <section className={s.panel} aria-labelledby="chain-h">
        <h2 id="chain-h" className={s.h2}>{section.chain}</h2>
        <p className={s.hint} id="pick-hint">{words.pickHint}</p>
        <div className={s.chainGrid}>
          <div className={s.pictureBox}>
            <ChainPicture members={chain.members} edges={chain.edges} entryId={chain.entryWorkerId} picked={picked} onPick={pick} roleWord={roleWord} />
            <Refused text={edgeAct.error} />
          </div>
          <div className={s.side}>
            <ul className={s.edges} data-edges>
              {chain.edges.map((e) => (
                <li key={`${e.from}>${e.to}`} className={s.edgeRow}>
                  <span>{handoffLine(nameOf(e.from), nameOf(e.to))}</span>
                  <Button size="large" type="text" onClick={() => edgeAct.go(() => removeEdge(projectId, e.from, e.to))}
                    aria-label={`${words.removeEdge} ${handoffLine(nameOf(e.from), nameOf(e.to))}`}>{words.removeEdge}</Button>
                </li>
              ))}
            </ul>
            <form className={s.edgeForm} onSubmit={(ev) => { ev.preventDefault(); if (edgeFrom && edgeTo) edgeAct.go(() => addEdge(projectId, edgeFrom, edgeTo), () => { setEdgeFrom(undefined); setEdgeTo(undefined); }); }}>
              <label className={s.field}><span className={s.label} id={ids.from}>{words.from}</span>
                <Select size="large" aria-labelledby={ids.from} value={edgeFrom} onChange={setEdgeFrom} options={memberOptions} /></label>
              <label className={s.field}><span className={s.label} id={ids.to}>{words.to}</span>
                <Select size="large" aria-labelledby={ids.to} value={edgeTo} onChange={setEdgeTo} options={memberOptions.filter((o) => o.value !== edgeFrom)} /></label>
              <Button size="large" htmlType="submit" disabled={!edgeFrom || !edgeTo || edgeAct.pending}>{words.addEdge}</Button>
            </form>
          </div>
        </div>

        <ul className={s.members}>
          {chain.members.map((m) => (
            <li key={m.id} className={s.member} data-member={m.id}>
              <span className={s.memberName}><span className={s.avatar} aria-hidden>{[...m.name][0]}</span>{m.name}</span>
              <span className={s.muted}>{roleWord(m)}</span>
              {m.id === chain.entryWorkerId
                ? <Tag className={s.entryTag}>{words.entry}</Tag>
                : <Button size="large" onClick={() => memberAct.go(() => setEntry(projectId, m.id))}>{words.setEntry}</Button>}
              <Button size="large" type="text" onClick={() => tryRemove(m.id)} aria-label={`${words.remove} ${m.name}`}>{words.remove}</Button>
              {removing?.id === m.id && (
                <div className={s.reassign} role="group" aria-labelledby={`re-${m.id}`}>
                  <p id={`re-${m.id}`} className={s.reassignAsk}>{words.reassign(m.name, removing.count)}</p>
                  <Select size="large" className={s.select} aria-labelledby={`re-${m.id}`} value={takeOver} onChange={setTakeOver}
                    options={memberOptions.filter((o) => o.value !== m.id)} />
                  <Button size="large" type="primary" disabled={!takeOver || memberAct.pending}
                    onClick={() => memberAct.go(() => removeMember(projectId, m.id, takeOver), () => setRemoving(null))}>{words.remove}</Button>
                  <Button size="large" type="text" onClick={() => setRemoving(null)}>{words.cancel}</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <Refused text={memberAct.error} />
      </section>

      <section className={s.panel} aria-labelledby="team-h">
        <h2 id="team-h" className={s.h2}>{section.team}</h2>
        <ul className={s.workers}>
          {workers.map((w) => (
            <li key={w.id} className={s.worker} data-worker={w.id}>
              <div className={s.workerHead}>
                <span className={s.memberName}><span className={s.avatar} aria-hidden>{[...w.name][0]}</span>{w.name}</span>
                {!memberIds.has(w.id) && <Button size="large" onClick={() => memberAct.go(() => addMember(projectId, w.id))}>{words.addToChain}</Button>}
              </div>
              <dl className={s.facts}>
                <div><dt>{words.role}</dt><dd>{roleWord(w)}</dd></div>
                <div><dt>{words.model}</dt><dd data-model>{w.model}</dd></div>
                <div><dt>{words.effort}</dt><dd>{words.effortLevel[w.effort] ?? w.effort}</dd></div>
              </dl>
              <div className={s.skills} data-skills>{w.skills.map((k) => <Tag key={k} className={s.skill}>{k}</Tag>)}</div>
              {w.combinedFrom && <p className={s.muted}>{words.combinedFrom(nameOf(w.combinedFrom[0]!), nameOf(w.combinedFrom[1]!))}</p>}
            </li>
          ))}
        </ul>

        <div className={s.forms}>
          <form className={s.form} onSubmit={(e) => { e.preventDefault(); const sk = skills.split(",").map((x) => x.trim()).filter(Boolean);
            workerAct.go(() => createWorker(projectId, { name: name.trim(), role, skills: sk }), () => { setName(""); setSkills(""); }); }}>
            <h3 className={s.h3}>{words.addWorker}</h3>
            <label className={s.field}><span className={s.label}>{words.name}</span><Input size="large" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className={s.field}><span className={s.label} id={ids.role}>{words.role}</span>
              <Select size="large" aria-labelledby={ids.role} value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: r === "other" ? words.roleOther : r }))} /></label>
            <label className={s.field}><span className={s.label}>{words.skills}</span>
              <Input size="large" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={words.skillsHint} /></label>
            <Button size="large" type="primary" htmlType="submit" disabled={!name.trim() || !skills.trim() || workerAct.pending}>{words.addWorker}</Button>
            <Refused text={workerAct.error} />
          </form>

          <form className={s.form} onSubmit={(e) => { e.preventDefault(); if (ca && cb && cname.trim()) combineAct.go(() => combineWorkers(projectId, cname.trim(), [ca, cb]), () => { setCa(undefined); setCb(undefined); setCname(""); }); }}>
            <h3 className={s.h3}>{words.combine}</h3>
            <label className={s.field}><span className={s.label} id={ids.a}>{words.name} 1</span>
              <Select size="large" aria-labelledby={ids.a} value={ca} onChange={setCa} options={workerOptions.filter((o) => o.value !== cb)} /></label>
            <label className={s.field}><span className={s.label} id={ids.b}>{words.name} 2</span>
              <Select size="large" aria-labelledby={ids.b} value={cb} onChange={setCb} options={workerOptions.filter((o) => o.value !== ca)} /></label>
            <label className={s.field}><span className={s.label}>{words.combinedName}</span><Input size="large" value={cname} onChange={(e) => setCname(e.target.value)} /></label>
            <Button size="large" type="primary" htmlType="submit" disabled={!ca || !cb || !cname.trim() || combineAct.pending}>{words.combine}</Button>
            <Refused text={combineAct.error} />
          </form>
        </div>
      </section>
    </div>
  );
}
