"use client";

// The CAW root: the font, the CSS variables and Ant's theme for everything under it. Ant follows prefers-reduced-motion
// through `motion: false`.
import { ConfigProvider } from "antd";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cawFont } from "./font";
import { antTheme, cssVars } from "./tokens";

const theme = antTheme(cawFont.style.fontFamily);

export function CawRoot({ children }: { children: ReactNode }) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setStill(q.matches);
    on();
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return (
    <ConfigProvider theme={{ ...theme, token: { ...theme.token, motion: !still } }}>
      <div className={cawFont.className} style={{ ...cssVars, minHeight: "100vh", background: "var(--caw-canvas)", color: "var(--caw-ink)" } as CSSProperties}>
        {children}
      </div>
    </ConfigProvider>
  );
}
