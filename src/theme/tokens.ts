// CAW's one look (TASK-B-039 direction, specs/SPEC-B-002-findings/TASK-B-039-direction-and-comp.md § 1; REQ-014 direction,
// specs/SPEC-B-003-findings/TASK-B-061-direction-and-comps.md § 1): Blueprint clean-blue's family — the same canvas, ink, one blue,
// amber for stuck, and its spec-part kind colours. One source: every colour, radius and shadow a screen uses is named here.
// Two sets with the same names (STUDY-002 B1, TASK-B-063): light and dark. `themeCss()` writes both as CSS variables — the computer's
// setting (prefers-color-scheme) unless the header toggle put `data-theme` on <html> — so the CSS modules name no colour at all.
import { theme as antd, type ThemeConfig } from "antd";

export const color = {
  canvas: "#F2F5FA",
  paper: "#FFFFFF",
  sunk: "#FAFBFD", // a recessed area inside a surface (the chat thread)
  ink: "#18212F",
  ink2: "#4A5568", // 7.4:1 on paper
  line: "#DCE3EE",
  lineStrong: "#B8C3D3",
  blue: "#1A5FD6", // only "this needs you / this is where you are"
  blueHover: "#154FB4",
  blueActive: "#11439A",
  blueSoft: "#E8F1FE",
  onBlue: "#FFFFFF", // text on a blue fill
  stuck: "#A44F08", // only stuck
  stuckSoft: "#FFF4E5",
  stuckLine: "#E8C3A5", // a stuck card's border
  // REQ-014 direction: one new meaning — someone is working on it right now
  work: "#15733F", // 5.2:1 on workSoft, 5.9:1 on paper — only "working now"
  workSoft: "#E5F5EC",
  workLine: "#A9D9BE",
  column: "#E9EEF5", // a board column: a step darker than the canvas
  you: "#18212F", // the operator's own node (inverted)
  youInk: "#FFFFFF",
  faceEye: "#FFFFFF", // the faces' eyes: white in both schemes (≥ 3:1 on every body colour, TASK-B-070)
} as const;

/** The dark set — same names, values derived from Blueprint's family (B-066 comps, AA computed there: lowest text pair 6.43:1). */
export const colorDark: Record<keyof typeof color, string> = {
  canvas: "#0F141C",
  paper: "#171E29",
  sunk: "#131923",
  ink: "#E6EBF2",
  ink2: "#A9B4C4",
  line: "#2A3443",
  lineStrong: "#3C4859",
  blue: "#86AEFF",
  blueHover: "#A3C2FF",
  blueActive: "#B8D0FF",
  blueSoft: "#1A2B47",
  onBlue: "#0F141C",
  stuck: "#F2A766",
  stuckSoft: "#36240F",
  stuckLine: "#6A4624",
  work: "#62D39B",
  workSoft: "#12301F",
  workLine: "#2D6B4A",
  column: "#131923",
  you: "#E6EBF2",
  youInk: "#0F141C",
  faceEye: "#FFFFFF",
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

export const radius = { tag: 6, card: 10, column: 12, seat: 14, panel: 16 } as const;
/** The spacing scale (direction § 1) — every gap and padding is one of these. */
export const space = [4, 8, 12, 16, 20, 24, 32] as const;
/** The type scale: 14 is the floor; one dominant title per page — 36/800 at 1440, 30 under 760 (STUDY-002 B5). */
export const type = { meta: 14, card: 15, body: 16, panel: 18, section: 22, title: 26, page: 36, pageNarrow: 30 } as const; // title: a page's subject under the project h1 (the card)
export const shadow = { rest: "0 1px 2px rgba(24,33,47,.06)", lifted: "0 4px 12px rgba(24,33,47,.10)" } as const;
const shadowDark = { rest: "0 1px 2px rgba(0,0,0,.4)", lifted: "0 6px 18px rgba(0,0,0,.45)" } as const;

const decl = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(";");
const schemeVars = (dark: boolean) => decl({
  ...Object.fromEntries(Object.entries(dark ? colorDark : color).map(([k, v]) => [`--caw-${k}`, v])),
  ...Object.fromEntries(Object.entries(dark ? groupDark : groupLight).flatMap(([k, v]) => [[`--caw-k-${k}`, v.fg], [`--caw-k-${k}-bg`, v.bg]])),
  ...Object.fromEntries(Object.entries(face).map(([k, v]) => [`--face-${k}`, v[dark ? 1 : 0]])),
  "--caw-shadow-rest": (dark ? shadowDark : shadow).rest, "--caw-shadow-lifted": (dark ? shadowDark : shadow).lifted,
  "color-scheme": dark ? "dark" : "light",
});
const fixedVars = decl({
  "--caw-r-tag": `${radius.tag}px`, "--caw-r-card": `${radius.card}px`, "--caw-r-column": `${radius.column}px`, "--caw-r-panel": `${radius.panel}px`, "--caw-r-seat": `${radius.seat}px`,
  ...Object.fromEntries(Object.entries(type).map(([k, v]) => [`--caw-t-${k}`, `${v}px`])),
});

/** Both sets as CSS, from the values above (never a second copy in a .css file). */
export function themeCss(): string {
  return `:root{${fixedVars};${schemeVars(false)}}`
    + `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${schemeVars(true)}}}`
    + `:root[data-theme="dark"]{${schemeVars(true)}}`
    + `@media (max-width:760px){:root{--caw-t-page:${type.pageNarrow}px}}`;
}

export function antTheme(fontFamily: string, dark = false): ThemeConfig {
  const c = dark ? colorDark : color;
  return {
    algorithm: dark ? antd.darkAlgorithm : antd.defaultAlgorithm,
    token: {
      fontFamily,
      fontSize: 15,
      colorPrimary: c.blue,
      colorInfo: c.blue,
      colorError: c.stuck,
      colorWarning: c.stuck,
      colorText: c.ink,
      colorTextSecondary: c.ink2,
      colorTextTertiary: c.ink2,
      colorTextDescription: c.ink2,
      colorTextPlaceholder: c.ink2,
      colorTextLightSolid: c.onBlue,
      colorBorder: c.line,
      colorBorderSecondary: c.line,
      colorBgLayout: c.canvas,
      colorBgContainer: c.paper,
      colorBgElevated: c.paper,
      borderRadius: radius.card,
      borderRadiusSM: radius.tag,
      controlHeightLG: 44,
      controlOutline: dark ? "rgba(134,174,255,0.4)" : "rgba(26,95,214,0.35)",
      controlOutlineWidth: 3,
      motionDurationMid: "0.15s",
    },
    components: {
      // the track's 2 px padding on each side: 48 makes each option 44 px tall (the target floor)
      Segmented: { itemSelectedBg: c.blue, itemSelectedColor: c.onBlue, trackBg: c.canvas, controlHeightLG: 48 },
      Tag: { defaultBg: c.paper, defaultColor: c.ink2 },
    },
  };
}
