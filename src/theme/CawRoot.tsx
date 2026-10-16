// The CAW root: the older `--caw-*` names as aliases of the direction's tokens, plus the kind and face colours (tokens.ts), and the page's
// background. The scheme is `data-theme` on <html>: the toggle's pick (localStorage + cookie), else the computer's setting, put there before the
// first paint by the script in app/layout.tsx's <head>. TASK-B-088: Ant's ConfigProvider left with Ant — nothing here needs to follow the scheme in JS.
import type { ReactNode } from "react";
import { themeCss } from "./tokens";

export const THEME_KEY = "caw-theme";
const css = themeCss();

/** The scheme in effect: the toggle's pick on <html>, else the computer's setting. */
export const effectiveDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/** `initialDark` is kept for the callers (the stored pick, read from the cookie by the layout); the CSS follows `data-theme` on its own. */
export function CawRoot({ children }: { children: ReactNode; initialDark?: boolean }) {
  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "var(--gd-canvas)", color: "var(--gd-ink)" }}>{children}</div>
    </>
  );
}
