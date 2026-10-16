"use client";

// The chain as the editor (REQ-014 comp 4, SPEC-B-003 STUDY-002 merge C-P1 / B2 / B3; comps B-068 4a / 4b): on a quiet dot-grid canvas, `คุณ` inverted
// on top, then the people in rows by hand-off distance from the entry worker (derived on every render, never stored), directed arrows. Link: tap a
// person's out-dot, then `ต่อที่นี่` on the receiver (keyboard: Tab to the dot, Enter, Tab to a target, Enter; Escape lets go). Cut: tap a line's
// handle (or Tab to it, Enter). Live state rings the people (green working, amber stuck). Below 768 px the picture gives way to a read-only tree.
import { useState, type KeyboardEvent } from "react";
import type { Worker } from "@/api/caw";
import { Face } from "@/components/faces/Face";
import { faceFor } from "@/lib/faces";
import { handoffLine, live, operatorName, team as words } from "@/words";
import s from "./team.module.css";

export type NodeState = "working" | "stuck" | null;
const W = 200, H = 68, GX = 28, GY = 76, PAD = 28, YOU = "you";

/** rows by hand-off distance from the entry worker (BFS along the edges); people no edge reaches go on a last row */
export function layoutRows(members: Worker[], edges: { from: string; to: string }[], entryId: string | null): Worker[][] {
  const dist = new Map<string, number>();
  if (entryId && members.some((m) => m.id === entryId)) {
    dist.set(entryId, 0);
    const q = [entryId];
    while (q.length) { const at = q.shift()!; for (const e of edges) if (e.from === at && !dist.has(e.to)) { dist.set(e.to, dist.get(at)! + 1); q.push(e.to); } }
  }
  const rows: Worker[][] = [];
  const tray: Worker[] = [];
  for (const m of members) { const d = dist.get(m.id); if (d === undefined) tray.push(m); else (rows[d] ??= []).push(m); }
  return [...rows.filter(Boolean), ...(tray.length ? [tray] : [])];
}

export function ChainPicture({ members, edges, entryId, states, onLink, onCut }: {
  members: Worker[]; edges: { from: string; to: string }[]; entryId: string | null; states: Record<string, NodeState>;
  onLink: (from: string, to: string) => void; onCut: (from: string, to: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const rows = layoutRows(members, edges, entryId);
  const width = Math.max(W + 2 * PAD, ...rows.map((r) => r.length * W + (r.length - 1) * GX + 2 * PAD));
  const pos = new Map<string, { x: number; y: number }>();
  pos.set(YOU, { x: (width - W) / 2, y: PAD });
  rows.forEach((row, i) => {
    const total = row.length * W + (row.length - 1) * GX, x0 = (width - total) / 2;
    row.forEach((m, k) => pos.set(m.id, { x: x0 + k * (W + GX), y: PAD + (i + 1) * (H + GY) }));
  });
  const height = PAD * 2 + (rows.length + 1) * H + rows.length * GY;
  const byId = new Map(members.map((m) => [m.id, m]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  // a line from the sender's out-dot (bottom middle) to the receiver's top middle; a line back up or across arcs round the left side
  const path = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (to.y > from.y) {
      const a = { x: from.x + W / 2, y: from.y + H }, b = { x: to.x + W / 2, y: to.y - 6 }, my = (a.y + b.y) / 2;
      return { d: `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`, mid: { x: (a.x + b.x) / 2, y: my } };
    }
    if (to.y === from.y) { // same row: straight across, side to side
      const right = to.x > from.x, a = { x: right ? from.x + W : from.x, y: from.y + H / 2 }, b = { x: right ? to.x - 6 : to.x + W + 6, y: to.y + H / 2 };
      return { d: `M${a.x} ${a.y} L${b.x} ${b.y}`, mid: { x: (a.x + b.x) / 2, y: a.y - 16 } };
    }
    const a = { x: from.x, y: from.y + H / 2 }, b = { x: to.x - 6, y: to.y + H / 2 }, cx = Math.min(a.x, b.x) - 70;
    return { d: `M${a.x} ${a.y} C${cx} ${a.y} ${cx} ${b.y} ${b.x} ${b.y}`, mid: { x: cx + 18, y: (a.y + b.y) / 2 } };
  };
  const press = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  const linked = (from: string, to: string) => edges.some((e) => e.from === from && e.to === to);
  const link = (to: string) => { if (picked) { onLink(picked, to); setPicked(null); } };
  const entry = entryId ? pos.get(entryId) : undefined;

  return (
    <>
      <div className={s.canvas}>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={s.picture} role="group" aria-label={live.linkHint}
          onKeyDown={(e) => { if (e.key === "Escape" && picked) { e.preventDefault(); setPicked(null); } }}>
          <defs>
            <marker id="caw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" className={s.arrowHead} /></marker>
          </defs>
          {entry && <path d={path(pos.get(YOU)!, entry).d} className={`${s.edge} ${s.edgeYou}`} markerEnd="url(#caw-arrow)" />}
          {edges.map((e) => {
            const a = pos.get(e.from), b = pos.get(e.to);
            if (!a || !b) return null;
            const p = path(a, b), label = `${words.removeEdge} ${handoffLine(nameOf(e.from), nameOf(e.to))}`;
            return (
              <g key={`${e.from}>${e.to}`}>
                <path d={p.d} className={s.edge} markerEnd="url(#caw-arrow)" />
                <circle cx={p.mid.x} cy={p.mid.y} r={5} className={s.cutDot} aria-hidden />
                <circle cx={p.mid.x} cy={p.mid.y} r={22} className={s.cutHit} role="button" tabIndex={0} aria-label={label} data-edge={`${e.from}>${e.to}`}
                  onClick={() => onCut(e.from, e.to)} onKeyDown={press(() => onCut(e.from, e.to))}><title>{label}</title></circle>
              </g>
            );
          })}
          <g className={`${s.node} ${s.nodeYou}`} transform={`translate(${pos.get(YOU)!.x} ${pos.get(YOU)!.y})`}>
            <rect width={W} height={H} rx={14} />
            <text x={18} y={30} className={s.nodeName}>{operatorName}</text>
            <text x={18} y={52} className={s.nodeSub}>{live.youLine}</text>
          </g>
          {members.map((m) => {
            const p = pos.get(m.id)!, st = states[m.id] ?? null, isEntry = m.id === entryId;
            const sub = [m.roles.join(" +"), isEntry ? words.entry : null].filter(Boolean).join(" · ");
            const target = picked !== null && picked !== m.id && !linked(picked, m.id);
            return (
              <g key={m.id} className={`${s.node} ${isEntry ? s.nodeEntry : ""} ${st === "working" ? s.nodeWorking : st === "stuck" ? s.nodeStuck : ""}`}
                transform={`translate(${p.x} ${p.y})`} data-node={m.id}>
                <rect width={W} height={H} rx={14} />
                <g transform="translate(12 12)"><Face face={faceFor(m)} size={44} /></g>
                <text x={66} y={30} className={s.nodeName}>{m.name}</text>
                <text x={66} y={52} className={s.nodeSub}>{sub}</text>
                <circle cx={W / 2} cy={H} r={10} className={`${s.outDot} ${picked === m.id ? s.outDotOn : ""}`} aria-hidden />
                <circle cx={W / 2} cy={H} r={22} className={s.outHit} role="button" tabIndex={0}
                  aria-pressed={picked === m.id} aria-label={`${words.from} ${m.name}`} data-out
                  onClick={() => setPicked(picked === m.id ? null : m.id)} onKeyDown={press(() => setPicked(picked === m.id ? null : m.id))} />
                {target && (
                  <g className={s.target} transform={`translate(${W - 100} -26)`} role="button" tabIndex={0} aria-label={`${live.linkHere} ${m.name}`} data-target
                    onClick={() => link(m.id)} onKeyDown={press(() => link(m.id))}>
                    <rect width={96} height={44} rx={22} />
                    <text x={48} y={28} textAnchor="middle">{live.linkHere}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <ol className={s.tree} data-chain-tree aria-label={live.linkHint}>
        <li style={{ ["--d" as string]: 0 }}><span className={s.youMark} aria-hidden>{[...operatorName][0]}</span><b>{operatorName}</b></li>
        {rows.flatMap((row, i) => row.map((m) => (
          <li key={m.id} style={{ ["--d" as string]: i + 1 }}>
            <span className={`${s.treeFace} ${states[m.id] === "working" ? s.ringWork : states[m.id] === "stuck" ? s.ringStuck : ""}`}><Face face={faceFor(m)} size={28} /></span>
            <b>{m.name}</b>{m.roles.map((r, k) => <span key={r} className={s.role}>{k ? `+${r}` : r}</span>)}
            {m.id === entryId && <span className={s.entryTag}>{words.entry}</span>}
          </li>
        )))}
      </ol>
    </>
  );
}
