// One person on the team, drawn the same everywhere (REQ-014 direction § 1 — the crew strip, cards, chat, team, runs, timeline):
// a round avatar with the name's first letter, the name, and a tag per role. `state` rings the avatar: green = working on something
// right now (with a slowly breathing dot, still under reduced motion), amber = stuck. Colour is never alone — the place that shows
// a state also says it in words. The avatar is decoration (`aria-hidden`); the name is the text.
import s from "./person.module.css";

export type PersonState = "working" | "stuck" | null;

export function Avatar({ name, size = "md", state = null }: { name: string; size?: "sm" | "md" | "lg"; state?: PersonState }) {
  const cls = [s.avatar, s[size], state === "working" ? s.working : state === "stuck" ? s.stuck : ""].join(" ");
  return <span className={cls} aria-hidden data-person-state={state ?? undefined}>{[...name][0] ?? "?"}</span>;
}

export function Person({ name, roles = [], size = "md", state = null, showRoles = true }: {
  name: string; roles?: string[]; size?: "sm" | "md" | "lg"; state?: PersonState; showRoles?: boolean;
}) {
  return (
    <span className={`${s.person} ${s[`p-${size}`]}`} data-person>
      <Avatar name={name} size={size} state={state} />
      <span className={s.name}>{name}</span>
      {showRoles && roles.map((r) => <span key={r} className={s.role}>{r}</span>)}
    </span>
  );
}
