"use client";

// The roster (REQ-014 R4; direction B, TASK-B-087 § 1; comps studies/REQ-014-direction-B/board.html): every team member once — face, name on one line kept
// whole (… + `title`), role marks, and what they are doing now in at most two lines (… + `title`) from Bob's `crewState` (lib/crew.ts). Three to a row at
// ≥ 768 px, as many rows as people — a seat never shrinks below a readable name. Below 768 the row scrolls sideways with a snap per seat and a fade on the
// edge that has more (DEF-1, D-075). "Now" is the indigo accent (ring + line); stuck is amber. A running hop quiet for ≥ STALE_MINUTES reads
// `เงียบไป {n} นาที` (D-064), counted on the browser's clock. The seats are the board's filter (C6): press = only that person's cards (`aria-pressed`).
import { useEffect, useRef, useState } from "react";
import type { Avatar as Face, Hop } from "@/api/caw";
import { STALE_MINUTES, quietMinutes, type SeatState } from "@/lib/crew";
import { live, redesign, section } from "@/words";
import { Avatar } from "./Person";

export interface SeatView { id: string; name: string; avatar: Face | null; roles: string[]; state: SeatState; card: string | null; n?: number; hop?: Hop }

function now(): number { return Date.now(); }

export function CrewStrip({ seats, chosen, onToggle }: { seats: SeatView[]; chosen?: ReadonlySet<string>; onToggle?: (id: string) => void }) {
  const [t, setT] = useState<number | null>(null); // null on the server and the first paint: no "quiet" line until the browser's clock is read
  useEffect(() => { setT(now()); const id = setInterval(() => setT(now()), 30_000); return () => clearInterval(id); }, []);
  // below 768 the row scrolls: a fade on each edge that has more seats says so
  const ref = useRef<HTMLUListElement>(null);
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setMore({ start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
    read();
    el.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", read); ro.disconnect(); };
  }, [seats.length]);
  const fade = "pointer-events-none absolute inset-y-0 z-[1] w-10 from-sheet to-transparent";
  return (
    <section className="relative min-w-0 overflow-hidden rounded-[10px] border border-hair bg-sheet" aria-label={section.team} data-crew-wrap>
      {more.start && <span className={`${fade} left-0 bg-linear-to-r`} aria-hidden data-crew-fade="start" />}
      {more.end && <span className={`${fade} right-0 bg-linear-to-l`} aria-hidden data-crew-fade="end" />}
      <ul ref={ref} className="m-0 grid list-none grid-cols-3 p-0 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:[scrollbar-width:none]" data-crew>
        {seats.map((seat, i) => {
          const busy = seat.state === "working" || seat.state === "answeringChat";
          const quiet = busy && seat.hop && t !== null ? quietMinutes(seat.hop, new Date(t)) : null;
          const line = seat.state === "working" ? redesign.seatWorking(seat.card ?? "")
            : seat.state === "answeringChat" ? live.answeringChat
            : seat.state === "stuck" ? redesign.seatStuck(seat.card ?? "")
            : seat.state === "waitingOnYou" ? redesign.seatWaiting
            : seat.state === "idleWithWork" ? live.freeWithCards(seat.n ?? 1)
            : redesign.seatFree;
          const tone = busy ? "text-now font-medium" : seat.state === "stuck" ? "text-stuck font-medium" : seat.state === "waitingOnYou" ? "text-ink font-medium" : "text-ink2";
          const on = chosen?.has(seat.id) ?? false;
          return (
            <li key={seat.id} className={`min-w-0 border-hair max-md:w-[280px] max-md:flex-none max-md:snap-start max-md:border-l max-md:first:border-l-0 md:border-l md:border-t md:[&:nth-child(3n+1)]:border-l-0 ${i < 3 ? "md:border-t-0" : ""}`}>
              <button type="button" data-seat={seat.name} data-state={seat.state} aria-pressed={on} disabled={!onToggle} onClick={() => onToggle?.(seat.id)}
                className={`grid h-full min-h-[76px] w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-5 py-3.5 text-left transition-colors hover:bg-now-soft disabled:cursor-default disabled:hover:bg-transparent ${on ? "bg-now-soft shadow-[inset_0_0_0_2px_var(--gd-accent)]" : ""}`}>
                <Avatar name={seat.name} avatar={seat.avatar} size="md" state={busy ? "working" : seat.state === "stuck" ? "stuck" : null} />
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <b className="name text-[15px] font-semibold" data-name title={seat.name}>{seat.name}</b>
                    <span className="shrink-0 text-sm tracking-wide text-ink3">{seat.roles.join(" · ")}</span>
                  </span>
                  <span className={`clamp-2 text-sm ${tone}`} title={line} data-seat-line>{line}</span>
                  {quiet !== null && quiet >= STALE_MINUTES && <span className="text-sm font-semibold text-stuck">{live.quiet(quiet)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
