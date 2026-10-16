// CAW's one look: direction B "Graphite Desk" in palette P1 Indigo (D-083/D-084/D-085). The colours themselves live ONCE, as the `--gd-*` tokens in
// app/globals.css (light + dark on `data-theme`). This file only (1) names the older `--caw-*` variables the screens' CSS modules still read as ALIASES of
// those tokens — never a second copy of a value (rule §9), (2) holds what globals.css does not: the spec-part kind colours and the faces' body colours
// (light / dark pairs), and the radius / type scales. TASK-B-088: Ant's theme is gone with Ant.

/** The older names → the direction's tokens. A board column is the sheet (no grey tubs, D-084); "working now" is the indigo accent. */
const alias: Record<string, string> = {
  canvas: "--gd-canvas", paper: "--gd-sheet", sunk: "--gd-accent-soft", ink: "--gd-ink", ink2: "--gd-ink2",
  line: "--gd-hair", lineStrong: "--gd-hair2",
  blue: "--gd-accent", blueHover: "--gd-accent", blueActive: "--gd-accent", blueSoft: "--gd-accent-soft", onBlue: "--gd-on-accent",
  stuck: "--gd-stuck", stuckSoft: "--gd-stuck-soft", stuckLine: "--gd-stuck",
  work: "--gd-accent", workSoft: "--gd-accent-soft", workLine: "--gd-accent",
  column: "--gd-sheet", you: "--gd-ink", youInk: "--gd-sheet",
};

/** Blueprint's spec-part groups — only ever inside a spec-part chip. Light / dark pairs; screens read `group` (CSS variables). */
const groupLight = {
  journey: { fg: "#1A5FD6", bg: "#E8F1FE" },
  interaction: { fg: "#00897B", bg: "#E3F6F3" },
  participant: { fg: "#8E44C9", bg: "#F3EAFB" },
  knowledge: { fg: "#5E8F00", bg: "#EEF6E0" },
  question: { fg: "#C2185B", bg: "#FCE8F0" },
} as const;
const groupDark: Record<keyof typeof groupLight, { fg: string; bg: string }> = {
  journey: { fg: "#86AEFF", bg: "#1A2B47" },
  interaction: { fg: "#5FD3C4", bg: "#12302D" },
  participant: { fg: "#D2A6F5", bg: "#2E2140" },
  knowledge: { fg: "#B5DB6E", bg: "#233016" },
  question: { fg: "#F38BB8", bg: "#3A1828" },
};
export const group = Object.fromEntries(
  Object.keys(groupLight).map((k) => [k, { fg: `var(--caw-k-${k})`, bg: `var(--caw-k-${k}-bg)` }]),
) as Record<keyof typeof groupLight, { fg: string; bg: string }>;

export const kindGroup: Record<string, keyof typeof groupLight> = {
  work: "journey", step: "journey", interaction: "interaction",
  role: "participant", screen: "participant", api: "participant", system: "participant",
  data: "knowledge", decision: "knowledge", question: "question",
};

/** The worker faces' body colours (REQ-014 R7, D-068, TASK-B-070 contrast table): identity only, never state; ids = src/lib/faces.ts COLORS. */
export const face = {
  violet: ["#7348D1", "#9A7BF0"], plum: ["#94399A", "#C06BC6"], magenta: ["#C02C79", "#E15C9E"], rose: ["#C9314F", "#EC6178"],
  olive: ["#6E7718", "#86902D"], teal: ["#0B7D86", "#1E959E"], slate: ["#596579", "#8592A6"], ink: ["#2C333F", "#76819A"],
} as const;

export const radius = { tag: 6, card: 6, column: 10, seat: 10, panel: 10 } as const;
/** The type scale: 14 is the floor (direction B: 26 title · 17–22 headings · 15 body · 14 meta). */
export const type = { meta: 14, card: 15, body: 15, panel: 17, section: 19, title: 22, page: 26, pageNarrow: 22 } as const;

const decl = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(";");
const schemeVars = (dark: boolean) => decl({
  ...Object.fromEntries(Object.entries(dark ? groupDark : groupLight).flatMap(([k, v]) => [[`--caw-k-${k}`, v.fg], [`--caw-k-${k}-bg`, v.bg]])),
  ...Object.fromEntries(Object.entries(face).map(([k, v]) => [`--face-${k}`, v[dark ? 1 : 0]])),
});
const fixedVars = decl({
  ...Object.fromEntries(Object.entries(alias).map(([k, v]) => [`--caw-${k}`, `var(${v})`])),
  "--caw-faceEye": "#FFFFFF", // the faces' eyes: white in both schemes (≥ 3:1 on every body colour, TASK-B-070)
  "--caw-shadow-rest": "none", "--caw-shadow-lifted": "0 8px 24px rgb(13 16 23 / 0.12)", // direction B: hairlines, not shadows; only what floats lifts
  "--caw-r-tag": `${radius.tag}px`, "--caw-r-card": `${radius.card}px`, "--caw-r-column": `${radius.column}px`, "--caw-r-panel": `${radius.panel}px`, "--caw-r-seat": `${radius.seat}px`,
  ...Object.fromEntries(Object.entries(type).map(([k, v]) => [`--caw-t-${k}`, `${v}px`])),
});

/** The aliases, the kind and face colours for both schemes, as CSS (never a second copy in a .css file). */
export function themeCss(): string {
  return `:root{${fixedVars};${schemeVars(false)}}`
    + `:root[data-theme="dark"]{${schemeVars(true)}}`
    + `@media (max-width:760px){:root{--caw-t-page:${type.pageNarrow}px}}`;
}
