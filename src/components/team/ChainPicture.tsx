"use client";

// The chain IS the team (TASK-B-086, polish-plan § 2.1/§ 6, comps studies/REQ-014-direction-B/team.html): `คุณ` on top, then each person ONCE, in rows by
// hand-off distance from the entry person (derived on every render, never stored). A node is a button — face, name (2 lines, then …; the full name in
// `title` and in the drawer), role marks, the live ring — that opens the person's drawer. Lines are thin arrows; a line that goes back up, sideways or skips a
// row runs in its own lane in the left gutter and crosses the gaps between rows only, never a node (B2 / OD-1). No dots: linking is done from the drawer's
// list (OD-4). Below 768 px the picture is a list, and each return line is said in words under the person who sends it.
import type { Worker } from "@/api/caw";
import { NameParts } from "@/components/NameParts";
import { Avatar } from "@/components/Person";
import { live, operatorName, redesign, section, team as words, teamPage } from "@/words";

export type NodeState = "working" | "stuck" | null;
const W = 236, H = 76, GX = 24, GY = 64, PAD = 24, LANE = 18, YOU_W = 200, YOU_H = 60;

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

const roleMarks = (m: Worker) => m.roles.map((r) => (r === "other" ? words.roleOther : r)).join(" · ");

function NodeBody({ m, entry, state, compact = false }: { m: Worker; entry: boolean; state: NodeState; compact?: boolean }) {
  return (
    <>
      <Avatar name={m.name} avatar={m.avatar} size={compact ? "sm" : "md"} state={state} />
      <span className="grid min-w-0 gap-0.5 text-left">
        {compact
          ? <span className="name text-[15px] font-semibold" data-name title={m.name}>{m.name}</span>
          : <span className="clamp-2 text-[15px] font-semibold leading-snug [word-break:normal]" data-name title={m.name}><NameParts name={m.name} /></span>}
        {/* one text run, so the ellipsis clips text, never a child box (AC-5 outside-clip); "now" colours the whole line while working */}
        <span className={`name text-sm ${state === "working" ? "text-now" : "text-ink3"}`}>
          {[roleMarks(m), entry ? words.entry : null, state === "working" ? redesign.workingNow : null].filter(Boolean).join(" · ")}
        </span>
      </span>
    </>
  );
}

export function ChainPicture({ members, edges, entryId, states, selected, onOpen }: {
  members: Worker[]; edges: { from: string; to: string }[]; entryId: string | null; states: Record<string, NodeState>;
  selected: string | null; onOpen: (id: string) => void;
}) {
  const rows = layoutRows(members, edges, entryId);
  const rowOf = new Map<string, number>();
  rows.forEach((row, i) => row.forEach((m) => rowOf.set(m.id, i)));
  // a line is "lane-routed" when it does not go exactly one row down; each gets its own lane in the left gutter
  const laned = edges.filter((e) => rowOf.has(e.from) && rowOf.has(e.to) && rowOf.get(e.to)! !== rowOf.get(e.from)! + 1);
  const gutter = laned.length ? PAD + laned.length * LANE : 0;
  const inner = Math.max(YOU_W, ...rows.map((r) => r.length * W + (r.length - 1) * GX));
  const width = gutter + inner + 2 * PAD;
  const top = PAD + YOU_H + GY;
  // a lane line leaves its sender through the gap below its row — the bottom row's lines need that gap too, inside the drawing (AC-5 svg-stroke)
  const height = top + rows.length * H + Math.max(0, rows.length - 1) * GY + (laned.length ? GY / 2 + PAD : PAD);
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((row, i) => {
    const total = row.length * W + (row.length - 1) * GX, x0 = gutter + PAD + (inner - total) / 2;
    row.forEach((m, k) => pos.set(m.id, { x: x0 + k * (W + GX), y: top + i * (H + GY) }));
  });
  const you = { x: gutter + PAD + (inner - YOU_W) / 2, y: PAD };
  const entry = entryId ? pos.get(entryId) : undefined;
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  const down = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const p = { x: a.x + W / 2, y: a.y + H }, q = { x: b.x + W / 2, y: b.y - 4 }, my = (p.y + q.y) / 2;
    return `M${p.x} ${p.y} C${p.x} ${my} ${q.x} ${my} ${q.x} ${q.y}`;
  };
  // out of the sender's bottom-left, along the gap below its row to the lane, up/down the lane, along the gap above the receiver's row, into its top-left
  const lane = (a: { x: number; y: number }, b: { x: number; y: number }, k: number) => {
    const x = PAD + k * LANE, s = a.x + 28 + k * 6, t = b.x + 28 + k * 6;
    const yo = a.y + H + GY / 2 - k * 4, yi = b.y - GY / 2 + k * 4;
    return `M${s} ${a.y + H} V${yo} H${x} V${yi} H${t} V${b.y - 4}`;
  };

  return (
    <>
      <div className="overflow-x-auto max-md:hidden">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width, display: "block", margin: "0 auto" }} role="group" aria-label={section.chain} data-chain-picture>
          <defs>
            <marker id="gd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0L10 5L0 10z" fill="var(--gd-hair2)" />
            </marker>
          </defs>
          <g fill="none" stroke="var(--gd-hair2)" strokeWidth={1.5} strokeLinejoin="round">
            {entry && <path d={`M${you.x + YOU_W / 2} ${you.y + YOU_H} V${entry.y - 4}`} strokeDasharray="4 5" markerEnd="url(#gd-arrow)" />}
            {edges.map((e) => {
              const a = pos.get(e.from), b = pos.get(e.to);
              if (!a || !b) return null;
              const k = laned.indexOf(e);
              return <path key={`${e.from}>${e.to}`} d={k < 0 ? down(a, b) : lane(a, b, k)} strokeDasharray={k < 0 ? undefined : "4 5"} markerEnd="url(#gd-arrow)" data-edge={`${e.from}>${e.to}`} />;
            })}
          </g>
          <foreignObject x={you.x} y={you.y} width={YOU_W} height={YOU_H}>
            <div className="flex h-full flex-col justify-center rounded-lg bg-ink px-4 text-sheet">
              <b className="text-[15px] font-semibold">{operatorName}</b><span className="text-sm opacity-80">{live.youLine}</span>
            </div>
          </foreignObject>
          {members.map((m) => {
            const p = pos.get(m.id);
            if (!p) return null;
            const isEntry = m.id === entryId, on = selected === m.id;
            return (
              <foreignObject key={m.id} x={p.x} y={p.y} width={W} height={H}>
                <button type="button" onClick={() => onOpen(m.id)} aria-pressed={on} data-node={m.id}
                  className={`flex h-full w-full items-center gap-3 rounded-lg border bg-sheet px-3 transition-colors hover:border-ink3 ${on ? "border-ink ring-1 ring-ink" : isEntry ? "border-now" : "border-hair2"}`}>
                  <NodeBody m={m} entry={isEntry} state={states[m.id] ?? null} />
                </button>
              </foreignObject>
            );
          })}
        </svg>
      </div>
      {/* 390: the same chain as a list, indented by distance; a return line is said in words under its sender */}
      <ol className="m-0 grid list-none gap-0 p-0 md:hidden" data-chain-tree aria-label={section.chain}>
        {rows.flatMap((row, i) => row.map((m) => {
          // a return line goes back UP the chain (to an earlier row); the unreached tray's sideways lines are not "returns"
          const back = edges.filter((e) => e.from === m.id && rowOf.has(e.to) && rowOf.get(e.to)! < i);
          return (
            <li key={m.id} className="border-t border-hair first:border-t-0" style={{ paddingLeft: Math.min(i, 4) * 16 }}>
              <button type="button" onClick={() => onOpen(m.id)} data-node={m.id} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                <NodeBody m={m} entry={m.id === entryId} state={states[m.id] ?? null} compact />
              </button>
              {back.map((e) => <p key={e.to} className="m-0 pb-2 pl-11 text-sm text-ink2" data-return-line>{teamPage.returnLine(nameOf.get(e.from) ?? "", nameOf.get(e.to) ?? "")}</p>)}
            </li>
          );
        }))}
      </ol>
    </>
  );
}
