// CAW's one look (TASK-B-039 direction, specs/SPEC-B-002-findings/TASK-B-039-direction-and-comp.md § 1): Blueprint clean-blue's
// family — the same canvas, ink, one blue, amber for stuck, and its spec-part kind colours — on CAW's own dense grid.
// One source: every colour, radius and shadow a screen uses is named here (Ant tokens + the CSS variables on the root).
import type { ThemeConfig } from "antd";

export const color = {
  canvas: "#F2F5FA",
  paper: "#FFFFFF",
  ink: "#18212F",
  ink2: "#4A5568", // 7.4:1 on paper
  line: "#DCE3EE",
  lineStrong: "#B8C3D3",
  blue: "#1A5FD6", // only "this needs you / this is where you are"
  blueSoft: "#E8F1FE",
  stuck: "#A44F08", // only stuck
  stuckSoft: "#FFF4E5",
  stuckLine: "#E8C3A5", // a stuck card's border
  // REQ-014 direction (specs/SPEC-B-003-findings/TASK-B-061-direction-and-comps.md § 1): one new meaning — someone is working on it right now
  work: "#15733F", // 5.2:1 on workSoft, 5.9:1 on paper — only "working now"
  workSoft: "#E5F5EC",
  workLine: "#A9D9BE",
  column: "#E9EEF5", // a board column: a step darker than the canvas
} as const;

/** Blueprint's spec-part groups (clean-blue tokens) — only ever inside a spec-part chip. */
export const group = {
  journey: { fg: "#1A5FD6", bg: "#E8F1FE" },
  interaction: { fg: "#00897B", bg: "#E3F6F3" },
  participant: { fg: "#8E44C9", bg: "#F3EAFB" },
  knowledge: { fg: "#5E8F00", bg: "#EEF6E0" },
  question: { fg: "#C2185B", bg: "#FCE8F0" },
} as const;

export const kindGroup: Record<string, keyof typeof group> = {
  work: "journey", step: "journey", interaction: "interaction",
  role: "participant", screen: "participant", api: "participant", system: "participant",
  data: "knowledge", decision: "knowledge", question: "question",
};

export const radius = { tag: 6, card: 10, column: 12, seat: 14, panel: 16 } as const;
/** The spacing scale (direction § 1) — every gap and padding is one of these. */
export const space = [4, 8, 12, 16, 20, 24, 32] as const;
/** The type scale (direction § 1): 14 is the floor; one dominant title per page. */
export const type = { meta: 14, card: 15, body: 16, panel: 18, section: 22, page: 26 } as const;
export const shadow = { rest: "0 1px 2px rgba(24,33,47,.06)", lifted: "0 4px 12px rgba(24,33,47,.10)" } as const;

/** The variables the CSS modules read — set on the CAW root only. */
export const cssVars = {
  ...Object.fromEntries(Object.entries(color).map(([k, v]) => [`--caw-${k}`, v])),
  "--caw-r-tag": `${radius.tag}px`, "--caw-r-card": `${radius.card}px`, "--caw-r-column": `${radius.column}px`, "--caw-r-panel": `${radius.panel}px`, "--caw-r-seat": `${radius.seat}px`,
  ...Object.fromEntries(Object.entries(type).map(([k, v]) => [`--caw-t-${k}`, `${v}px`])),
  "--caw-shadow-rest": shadow.rest, "--caw-shadow-lifted": shadow.lifted,
} as Record<string, string>;

export function antTheme(fontFamily: string): ThemeConfig {
  return {
    token: {
      fontFamily,
      fontSize: 15,
      colorPrimary: color.blue,
      colorInfo: color.blue,
      colorError: color.stuck,
      colorWarning: color.stuck,
      colorText: color.ink,
      colorTextSecondary: color.ink2,
      colorTextTertiary: color.ink2,
      colorTextDescription: color.ink2,
      colorTextPlaceholder: color.ink2,
      colorBorder: color.line,
      colorBorderSecondary: color.line,
      colorBgLayout: color.canvas,
      borderRadius: radius.card,
      borderRadiusSM: radius.tag,
      controlHeightLG: 44,
      controlOutline: "rgba(26,95,214,0.35)",
      controlOutlineWidth: 3,
      motionDurationMid: "0.15s",
    },
    components: {
      // the track's 2 px padding on each side: 48 makes each option 44 px tall (the target floor)
      Segmented: { itemSelectedBg: color.blue, itemSelectedColor: color.paper, trackBg: color.canvas, controlHeightLG: 48 },
      Tag: { defaultBg: color.paper, defaultColor: color.ink2 },
    },
  };
}
