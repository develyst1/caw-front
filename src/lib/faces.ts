// The one list of faces (REQ-014 R7, D-068): the ids of the set drawn in TASK-B-070 and approved by the operator 2026-10-14. A face is body · colour · eyes.
// The core keeps no list (SPEC-A-008 § v1.12 — it checks only that an id is 1–24 of a–z 0–9 `-`), so this file is the only one and it may grow: a stored id
// that is not in it any more is drawn as the face derived from the worker's name, never as a broken one. A derived face is computed on every read and
// never stored (rule §9). Fanta's drawing imports the ids from here.
import type { Avatar } from "@/api/caw";

export const BODIES = ["pebble", "dome", "egg", "gem", "cape", "hex"] as const;
export const COLORS = ["violet", "plum", "magenta", "rose", "olive", "teal", "slate", "ink"] as const;
export const EYES = ["dots", "beans", "smile", "sleepy", "one"] as const;

const has = (list: readonly string[], id: unknown) => typeof id === "string" && list.includes(id);

/** All three ids are in the list. */
export const isKnownFace = (a: Avatar | null | undefined): a is Avatar => !!a && has(BODIES, a.body) && has(COLORS, a.color) && has(EYES, a.eyes);

/** FNV-1a over the UTF-16 units, then murmur3's finaliser so that near-equal names do not land on near-equal numbers. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
};

/** A face from the name alone: one stable number per part (so the parts do not move together), the name normalised so that "é" typed two ways is one name. */
export function deriveFace(name: string): Avatar {
  const n = name.normalize("NFC");
  return {
    body: BODIES[hash(`body:${n}`) % BODIES.length]!,
    color: COLORS[hash(`color:${n}`) % COLORS.length]!,
    eyes: EYES[hash(`eyes:${n}`) % EYES.length]!,
  };
}

/** The face to draw for a worker: the stored one when all three ids are known, else the one derived from the name. */
export const faceFor = (w: { name: string; avatar: Avatar | null }): Avatar => (isKnownFace(w.avatar) ? { ...w.avatar } : deriveFace(w.name));

/** The starting team's five faces (SPEC-B-003 Decision 6): chosen, all different — five different bodies, too. */
export const STARTING_FACES: Record<string, Avatar> = {
  ปลา: { body: "pebble", color: "violet", eyes: "dots" },
  ใบเตย: { body: "dome", color: "teal", eyes: "beans" },
  ฝน: { body: "egg", color: "magenta", eyes: "smile" },
  แบงค์: { body: "hex", color: "olive", eyes: "sleepy" },
  มิ้นท์: { body: "cape", color: "plum", eyes: "one" },
};
