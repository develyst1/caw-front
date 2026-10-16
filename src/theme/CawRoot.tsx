"use client";

// The CAW root: the font, the colour variables (both schemes, from tokens.ts) and Ant's theme for everything under it. The scheme follows
// the computer (prefers-color-scheme) until the header toggle picks one: that choice is `data-theme` on <html>, kept in localStorage
// and put back by the tiny inline script before the page paints. Ant needs real colours, so it follows the effective scheme here
// (its dark algorithm + the dark tokens). Ant follows prefers-reduced-motion through `motion: false`.
import { ConfigProvider } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { antTheme, themeCss } from "./tokens";

export const THEME_KEY = "caw-theme";
const css = themeCss();
// the pick is put back before paint by the script in app/layout.tsx's <head> (TASK-B-085), not here

/** The scheme in effect: the toggle's pick on <html>, else the computer's setting. */
export const effectiveDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/** `initialDark`: the scheme the server rendered (the stored pick, read from the cookie by the layout) — so Ant's first paint matches
 *  the page's (P-1, TASK-B-085). With no stored pick it is light until the effect reads the computer's setting. */
export function CawRoot({ children, initialDark = false }: { children: ReactNode; initialDark?: boolean }) {
  const [still, setStill] = useState(false);
  const [dark, setDark] = useState(initialDark);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { setStill(motion.matches); setDark(effectiveDark()); };
    on();
    motion.addEventListener("change", on);
    scheme.addEventListener("change", on);
    const watch = new MutationObserver(on);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { motion.removeEventListener("change", on); scheme.removeEventListener("change", on); watch.disconnect(); };
  }, []);
  const theme = antTheme("var(--font-plex), sans-serif", dark) /* the family is loaded once, in app/layout.tsx */;
  return (
    <ConfigProvider theme={{ ...theme, token: { ...theme.token, motion: !still } }}>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "var(--gd-canvas)", color: "var(--gd-ink)" }}>
        {children}
      </div>
    </ConfigProvider>
  );
}
