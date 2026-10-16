"use client";

// The crew strip (REQ-014 R4, TASK-B-064; comps B-066/B-068 3): one seat per team member, entry worker first — their face, name, roles and
// what they are doing right now, from Bob's `crewState` (lib/crew.ts). `working` = the one running hop (green ring, breathing); `stuck` amber;
// `waitingOnYou` / `idleWithWork` / `free` plain. A running hop quiet for ≥ STALE_MINUTES reads `เงียบไป {n} นาที` (D-064) — counted here, on the
// browser's clock, so it moves without a server round trip (`quietMinutes` from `Hop.lastActivityAt`).
import { useEffect, useRef, useState } from "react";
import type { Avatar as Face, Hop } from "@/api/caw";
import { STALE_MINUTES, quietMinutes, type SeatState } from "@/lib/crew";
import { live, redesign, section } from "@/words";
import { Avatar } from "./Person";
import s from "./CrewStrip.module.css";

export interface SeatView { id: string; name: string; avatar: Face | null; roles: string[]; state: SeatState; card: string | null; n?: number; hop?: Hop }

function now(): number { return Date.now(); }

/** `onToggle` (C6, TASK-B-074): the seats are the board's filter — press = only that person's cards, press again = everyone (`aria-pressed`). */
export function CrewStrip({ seats, chosen, onToggle }: { seats: SeatView[]; chosen?: ReadonlySet<string>; onToggle?: (id: string) => void }) {
  const [t, setT] = useState<number | null>(null); // null on the server and the first paint: no "quiet" line until the browser's clock is read
  useEffect(() => { setT(now()); const id = setInterval(() => setT(now()), 30_000); return () => clearInterval(id); }, []);
  // DEF-1 (TASK-B-077): when the row is wider than the strip, a fade on each edge that has more seats says it scrolls
  const ref = useRef<HTMLElement>(null);
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
  return (
    <div className={s.wrap}>
    {more.start && <span className={`${s.fade} ${s.fadeStart}`} aria-hidden data-crew-fade="start" />}
    {more.end && <span className={`${s.fade} ${s.fadeEnd}`} aria-hidden data-crew-fade="end" />}
    <section ref={ref} className={s.crew} aria-label={section.team} data-crew>
      {seats.map((seat) => {
        const busy = seat.state === "working" || seat.state === "answeringChat";
        const quiet = busy && seat.hop && t !== null ? quietMinutes(seat.hop, new Date(t)) : null;
        const line = seat.state === "working" ? redesign.seatWorking(seat.card ?? "")
          : seat.state === "answeringChat" ? live.answeringChat
          : seat.state === "stuck" ? redesign.seatStuck(seat.card ?? "")
          : seat.state === "waitingOnYou" ? redesign.seatWaiting
          : seat.state === "idleWithWork" ? live.freeWithCards(seat.n ?? 1)
          : redesign.seatFree;
        const cls = busy ? s.working : seat.state === "stuck" ? s.stuck : "";
        return (
          <button key={seat.id} type="button" className={`${s.seat} ${cls} ${chosen?.has(seat.id) ? s.on : ""}`} data-seat={seat.name} data-state={seat.state}
            aria-pressed={chosen?.has(seat.id) ?? false} disabled={!onToggle} onClick={() => onToggle?.(seat.id)}>
            <Avatar name={seat.name} avatar={seat.avatar} size="md" state={busy ? "working" : seat.state === "stuck" ? "stuck" : null} />
            <div className={s.body}>
              <span className={s.name}>{seat.name}{seat.roles.map((r) => <span key={r} className={s.role}>{r}</span>)}</span>
              <span className={s.now} title={line}>{line}</span>
              {quiet !== null && quiet >= STALE_MINUTES && <span className={s.quiet}>{live.quiet(quiet)}</span>}
            </div>
          </button>
        );
      })}
    </section>
    </div>
  );
}
