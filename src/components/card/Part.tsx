"use client";

// A spec part as Blueprint draws it: its kind's icon on a tile of the kind's group colour, then (optionally) the kind word and
// the name. Used by the card screen; the same icons and colours as the board's spec-part chip.
import {
  ArrowLeftRight, CircleHelp, Database, FolderKanban, GitBranch, Plug, Server, Smartphone, User, Waypoints, type LucideIcon,
} from "lucide-react";
import { group, kindGroup } from "@/theme/tokens";
import { partKind } from "@/words";
import s from "./card.module.css";

// the same icons as the board's part chip (TASK-B-087/B-088: lucide, no Ant)
const kindIcon: Record<string, LucideIcon> = {
  work: FolderKanban, step: Waypoints, interaction: ArrowLeftRight, role: User, screen: Smartphone,
  api: Plug, system: Server, data: Database, decision: GitBranch, question: CircleHelp,
};

export function PartIcon({ kind, size = "sm" }: { kind: string; size?: "sm" | "lg" }) {
  const Icon = kindIcon[kind] ?? FolderKanban;
  const g = group[kindGroup[kind] ?? "journey"];
  return <span className={size === "lg" ? s.iconLg : s.icon} style={{ color: g.fg, background: g.bg }} aria-hidden><Icon aria-hidden className={size === "lg" ? "size-5" : "size-3.5"} /></span>;
}

/** icon · name, with the kind word before the name when `withKind` */
export function Part({ kind, title, withKind = false }: { kind: string; title: string; withKind?: boolean }) {
  return (
    <span className={s.part}>
      <PartIcon kind={kind} />
      {withKind && <span className={s.kind}>{partKind[kind] ?? kind}</span>}
      <span className={s.partName} title={title}>{title}</span>
    </span>
  );
}
