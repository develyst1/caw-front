// One person on the team, drawn the same everywhere (REQ-014 direction § 1 — the crew strip, cards, chat, team, runs, timeline):
// their face (R7, D-068: `faceFor` — the stored face, or one derived from the name; Bob's src/lib/faces.ts), the name, and a tag per role.
// `state` rings the round frame around the face — green = working on something right now (with a slowly breathing dot, still under
// reduced motion), amber = stuck. The face colour is identity, never state. Colour is never alone: the place that shows a state also
// says it in words. The face is decoration (`aria-hidden`); the name is the text.
import type { Avatar as Face_ } from "@/api/caw";
import { Face } from "@/components/faces/Face";
import { faceFor } from "@/lib/faces";
import s from "./person.module.css";

export type PersonState = "working" | "stuck" | null;
const PX = { sm: 28, md: 36, lg: 52 } as const;

export function Avatar({ name, avatar = null, size = "md", state = null }: {
  name: string; avatar?: Face_ | null; size?: "sm" | "md" | "lg"; state?: PersonState;
}) {
  const cls = [s.frame, s[size], state === "working" ? s.working : state === "stuck" ? s.stuck : ""].join(" ");
  return (
    <span className={cls} aria-hidden data-person-state={state ?? undefined}>
      <Face face={faceFor({ name, avatar })} size={PX[size]} />
    </span>
  );
}

export function Person({ name, avatar = null, roles = [], size = "md", state = null, showRoles = true }: {
  name: string; avatar?: Face_ | null; roles?: string[]; size?: "sm" | "md" | "lg"; state?: PersonState; showRoles?: boolean;
}) {
  return (
    <span className={`${s.person} ${s[`p-${size}`]}`} data-person>
      <Avatar name={name} avatar={avatar} size={size} state={state} />
      <span className={s.name}>{name}</span>
      {showRoles && roles.map((r) => <span key={r} className={s.role}>{r}</span>)}
    </span>
  );
}
