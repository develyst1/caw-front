"use client";

// A spec part as Blueprint draws it: its kind's icon on a tile of the kind's group colour, then (optionally) the kind word and
// the name. Used by the card screen; the same icons and colours as the board's spec-part chip.
import {
  ApiOutlined, BranchesOutlined, CloudServerOutlined, DatabaseOutlined, MobileOutlined, NodeIndexOutlined, ProjectOutlined,
  QuestionCircleOutlined, SwapOutlined, UserOutlined,
} from "@ant-design/icons";
import type { ComponentType } from "react";
import { group, kindGroup } from "@/theme/tokens";
import { partKind } from "@/words";
import s from "./card.module.css";

const kindIcon: Record<string, ComponentType<{ "aria-hidden"?: boolean }>> = {
  work: ProjectOutlined, step: NodeIndexOutlined, interaction: SwapOutlined, role: UserOutlined, screen: MobileOutlined,
  api: ApiOutlined, system: CloudServerOutlined, data: DatabaseOutlined, decision: BranchesOutlined, question: QuestionCircleOutlined,
};

export function PartIcon({ kind, size = "sm" }: { kind: string; size?: "sm" | "lg" }) {
  const Icon = kindIcon[kind] ?? ProjectOutlined;
  const g = group[kindGroup[kind] ?? "journey"];
  return <span className={size === "lg" ? s.iconLg : s.icon} style={{ color: g.fg, background: g.bg }} aria-hidden><Icon aria-hidden /></span>;
}

/** icon · name, with the kind word before the name when `withKind` */
export function Part({ kind, title, withKind = false }: { kind: string; title: string; withKind?: boolean }) {
  return (
    <span className={s.part}>
      <PartIcon kind={kind} />
      {withKind && <span className={s.kind}>{partKind[kind] ?? kind}</span>}
      <span className={s.partName}>{title}</span>
    </span>
  );
}
