"use client";

// The way between a project's screens (REQ-011 sections): บอร์ด and การรัน — each a link, the current one marked. Team and chain join it
// when their screens exist.
import { usePathname } from "next/navigation";
import { section } from "@/words";
import s from "./nav.module.css";

export function ProjectNav({ projectId }: { projectId: string }) {
  const path = usePathname();
  const base = `/p/${projectId}`;
  const items = [
    { href: base, label: section.board, here: path === base },
    { href: `${base}/team`, label: section.team, here: path.startsWith(`${base}/team`) }, // TASK-B-042: ทีม · สายงาน
    { href: `${base}/runs`, label: section.runs, here: path.startsWith(`${base}/runs`) },
    { href: `${base}/chat`, label: section.chat, here: path.startsWith(`${base}/chat`) }, // TASK-B-050: แชต
  ];
  return (
    <nav className={s.nav} aria-label={section.board}>
      {items.map((i) => <a key={i.href} className={s.link} href={i.href} aria-current={i.here ? "page" : undefined}>{i.label}</a>)}
    </nav>
  );
}
