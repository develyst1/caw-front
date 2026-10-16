"use client";

// The way between a project's screens (REQ-011 sections): บอร์ด and การรัน — each a link, the current one marked. Team and chain join it
// when their screens exist.
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { headerMenu, live, section, teamPage } from "@/words";
import s from "./nav.module.css";

/** `waiting` (B-080, TASK-B-085): what waits on you — the one way into the chat carries the count, there is no second แชต button. */
export function ProjectNav({ projectId, waiting = 0 }: { projectId: string; waiting?: number }) {
  const path = usePathname();
  const base = `/p/${projectId}`;
  const items = [
    { href: base, label: section.board, here: path === base },
    { href: `${base}/team`, label: section.team, here: path.startsWith(`${base}/team`) }, // TASK-B-042: ทีม · สายงาน
    { href: `${base}/runs`, label: section.runs, here: path.startsWith(`${base}/runs`) },
    { href: `${base}/chat`, label: section.chat, here: path.startsWith(`${base}/chat`), count: waiting }, // TASK-B-050: แชต
  ];
  return (
    <nav className={s.nav} aria-label={section.board}>
      {items.map((i) => (
        <a key={i.href} className={s.link} href={i.href} aria-current={i.here ? "page" : undefined}
          aria-label={"count" in i && i.count ? `${i.label} · ${live.waitingOnYou(i.count)}` : undefined}>
          {i.label}{"count" in i && i.count ? <span className={s.count} aria-hidden data-waiting-count>{i.count}</span> : null}
        </a>
      ))}
    </nav>
  );
}

/** Below 768 px (B-085 Q1 → TASK-B-088): the header's mode, folders and theme move into one menu — a Radix Sheet from the top, so the mode's budget
 *  dialog and the folders dialog open from inside it — and the places (the tabs) keep the sticky header to themselves. */
export function HeaderMenu({ children }: { children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11 min-w-11 px-3 md:hidden" aria-label={headerMenu.label} data-header-menu><Menu className="size-5" aria-hidden /></Button>
      </SheetTrigger>
      <SheetContent side="top" showCloseButton={false} className="gap-4 border-hair bg-sheet p-4" aria-describedby={undefined}>
        <div className="flex items-center justify-between gap-3">
          <SheetTitle className="m-0 text-[17px] font-semibold text-ink">{headerMenu.label}</SheetTitle>
          <SheetClose asChild><Button variant="ghost" className="min-h-11">{teamPage.close}</Button></SheetClose>
        </div>
        <div className="grid gap-4" data-header-menu-body>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
