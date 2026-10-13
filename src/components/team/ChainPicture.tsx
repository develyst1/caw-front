"use client";

// The chain as a picture (REQ-011 R4): the members on a ring, each hand-off edge an arrow from sender to receiver, the entry
// worker filled blue with its mark. Adding an edge from the picture: choose the sender, then the receiver — by mouse, or by Tab +
// Enter / Space (Escape lets go of the sender). Removing an edge is in the list beside the picture (Team).
import { useEffect, useState, type KeyboardEvent } from "react";
import type { Worker } from "@/api/caw";
import { team as words } from "@/words";
import s from "./team.module.css";

// a landscape ring on a desktop; on a phone (≤ 640 px) a portrait one about as wide as the screen, so the picture is drawn near 1:1
// (names stay 16 px, nodes 64 px) instead of being shrunk to half (TASK-B-042 walk: 7–9 px text, 30 px nodes at 390)
const WIDE = { w: 680, h: 400 }, TALL = { w: 360, h: 540 }, NODE_W = 156, NODE_H = 64, RX = 10;
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(max-width: 640px)");
    const on = () => setNarrow(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function ChainPicture({ members, edges, entryId, picked, onPick, roleWord }: {
  members: Worker[]; edges: { from: string; to: string }[]; entryId: string | null; picked: string | null;
  onPick: (id: string) => void; roleWord: (w: Worker) => string;
}) {
  const { w: W, h: H } = useNarrow() ? TALL : WIDE;
  // members on an ellipse, the first at the top
  const at = new Map(members.map((m, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(members.length, 1);
    const x = members.length === 1 ? W / 2 : W / 2 + (W / 2 - NODE_W / 2 - 16) * Math.cos(a);
    const y = members.length === 1 ? H / 2 : H / 2 + (H / 2 - NODE_H / 2 - 12) * Math.sin(a);
    return [m.id, { x, y }];
  }));
  // an arrow from the edge of one box to the edge of the other, bent a little so A→B and B→A never overlap
  const arrow = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const cut = (ux: number, uy: number) => Math.min((NODE_W / 2 + 6) / Math.abs(ux || 1e-9), (NODE_H / 2 + 6) / Math.abs(uy || 1e-9));
    const ux = dx / len, uy = dy / len, k1 = cut(ux, uy), k2 = cut(-ux, -uy);
    const a = { x: from.x + ux * k1, y: from.y + uy * k1 }, b = { x: to.x - ux * k2, y: to.y - uy * k2 };
    const bend = 22, cx = (a.x + b.x) / 2 - uy * bend, cy = (a.y + b.y) / 2 + ux * bend;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(id); } };

  return (
    <svg className={s.picture} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={words.pickHint}
      onKeyDown={(e) => { if (e.key === "Escape" && picked) { e.preventDefault(); onPick(picked); } }}>
      <defs>
        <marker id="caw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" className={s.arrowHead} />
        </marker>
      </defs>
      {edges.map((e) => {
        const a = at.get(e.from), b = at.get(e.to);
        return a && b ? <path key={`${e.from}>${e.to}`} d={arrow(a, b)} className={s.edge} markerEnd="url(#caw-arrow)" data-edge={`${e.from}>${e.to}`} /> : null;
      })}
      {members.map((m) => {
        const p = at.get(m.id)!;
        const entry = m.id === entryId, chosen = m.id === picked;
        return (
          <g key={m.id} className={`${s.node} ${entry ? s.nodeEntry : ""} ${chosen ? s.nodePicked : ""}`} role="button" tabIndex={0}
            aria-pressed={chosen} aria-label={`${m.name} · ${roleWord(m)}${entry ? ` · ${words.entry}` : ""}`} data-node={m.id}
            onClick={() => onPick(m.id)} onKeyDown={key(m.id)}>
            <rect x={p.x - NODE_W / 2} y={p.y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={RX} />
            <text x={p.x} y={p.y - 4} textAnchor="middle" className={s.nodeName}>{m.name}</text>
            <text x={p.x} y={p.y + 18} textAnchor="middle" className={s.nodeRole}>{entry ? words.entry : roleWord(m)}</text>
          </g>
        );
      })}
    </svg>
  );
}
