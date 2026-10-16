"use client";

// สลับโหมดมืด / สว่าง (D-063, STUDY-002 B1): one 44 px icon button for a header. It flips the scheme in effect and remembers the pick
// (localStorage + `data-theme` on <html>, which CawRoot follows). The icon shows the scheme you are in: a sun in light, a moon in dark.
import { THEME_KEY, effectiveDark } from "./CawRoot";
import { themeToggle } from "@/words";
import s from "./theme-toggle.module.css";

export function ThemeToggle() {
  const flip = () => {
    const next = effectiveDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* a private window: the pick lasts for this page only */ }
    document.cookie = `${THEME_KEY}=${next}; path=/; max-age=31536000; samesite=lax`; // the server renders the next page in it (TASK-B-085)
  };
  return (
    <button type="button" className={s.toggle} onClick={flip} aria-label={themeToggle} title={themeToggle} data-theme-toggle>
      <svg className={s.sun} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      <svg className={s.moon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
    </button>
  );
}
