// A worker's face (REQ-014 R7, D-068): body · colour · eyes, drawn from TASK-B-070's set (specs/SPEC-B-003-findings/faces/, operator
// "ผ่าน" 2026-10-14). The ids come from src/lib/faces.ts (Bob, B-071) — never a second list; the shapes live only here. Each body is one
// path on a 100 × 100 viewBox, the eyes are white and sit on that body's own eye line. The colour is a `--face-*` variable (light + dark
// in tokens.ts) — identity only, never state.
import type { Avatar } from "@/api/caw";
import type { BODIES, EYES } from "@/lib/faces";

const BODY: Record<(typeof BODIES)[number], { d: string; eyeY: number }> = {
  pebble: { eyeY: 46, d: "M50 8C79 8 92 21 92 50C92 79 79 92 50 92C21 92 8 79 8 50C8 21 21 8 50 8Z" },
  dome: { eyeY: 52, d: "M10 80V56C10 31 28 12 50 12C72 12 90 31 90 56V80Q90 90 80 90H20Q10 90 10 80Z" },
  egg: { eyeY: 57, d: "M50 5C73 5 88 38 88 60C88 81 72 95 50 95C28 95 12 81 12 60C12 38 27 5 50 5Z" },
  gem: { eyeY: 49, d: "M50 5Q56 5 60 10L90 44Q95 50 90 56L60 90Q56 95 50 95Q44 95 40 90L10 56Q5 50 10 44L40 10Q44 5 50 5Z" },
  cape: { eyeY: 45, d: "M13 50C13 26 30 9 50 9C70 9 87 26 87 50V85Q79 95 70 86Q62 78 54 86Q50 90 46 86Q38 78 30 86Q21 95 13 85Z" },
  hex: { eyeY: 48, d: "M31 9H69Q76 9 79 15L95 44Q98 50 95 56L79 85Q76 91 69 91H31Q24 91 21 85L5 56Q2 50 5 44L21 15Q24 9 31 9Z" },
};

const EYE: Record<(typeof EYES)[number], (y: number) => React.ReactNode> = {
  dots: (y) => <><circle cx="37" cy={y} r="7" /><circle cx="63" cy={y} r="7" /></>,
  beans: (y) => <><ellipse cx="38" cy={y} rx="5.5" ry="10" /><ellipse cx="62" cy={y} rx="5.5" ry="10" /></>,
  smile: (y) => <path d={`M29 ${y + 4}Q37 ${y - 7} 45 ${y + 4}M55 ${y + 4}Q63 ${y - 7} 71 ${y + 4}`} fill="none" stroke="var(--caw-faceEye)" strokeWidth="6.5" strokeLinecap="round" />,
  sleepy: (y) => <><rect x="28" y={y - 3} width="18" height="6.5" rx="3.25" /><rect x="54" y={y - 3} width="18" height="6.5" rx="3.25" /></>,
  one: (y) => <circle cx="50" cy={y} r="11" />,
};

/** The face itself, decorative (the name next to it is the text). `face` must be a known face — callers pass `faceFor(worker)`. */
export function Face({ face, size }: { face: Avatar; size: number }) {
  const body = BODY[face.body as keyof typeof BODY];
  const eyes = EYE[face.eyes as keyof typeof EYE];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false" data-face={`${face.body}-${face.color}-${face.eyes}`}>
      <path d={body.d} fill={`var(--face-${face.color})`} />
      <g fill="var(--caw-faceEye)">{eyes(body.eyeY)}</g>
    </svg>
  );
}
