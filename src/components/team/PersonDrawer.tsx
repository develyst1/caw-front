"use client";

// One place per person (TASK-B-086 § 2, WHY.md "edit a person"): a non-modal side drawer — the chain stays in view — in a fixed order: face (opens the
// picker), name, roles (+ the duty line of each), ให้รับงานคนแรก, ส่งต่อ (the people they hand to, each with ลบเส้นนี้, then + เพิ่มเส้นส่งต่อ), details, and
// remove. Every change saves as it is made; a refusal shows on its own line under the control that was used.
import { RadioGroup as RG } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import type { Avatar as FaceIds, Chain, Worker, WorkerRole } from "@/api/caw";
import { Face } from "@/components/faces/Face";
import { Avatar } from "@/components/Person";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BODIES, COLORS, EYES, faceFor } from "@/lib/faces";
import { NameParts } from "@/components/NameParts";
import { card, faces, live, rolePicker, team as words, teamPage } from "@/words";

export const ROLES: WorkerRole[] = ["PM", "BA", "SA", "FE", "BE", "QA"];
export const roleWord = (r: WorkerRole) => (r === "other" ? words.roleOther : r);
export type DrawerFocus = "roles" | "handoff" | "entry" | null;

export function Refused({ text }: { text: string | null }) {
  return text ? <p className="m-0 mt-2 rounded-md bg-stuck-soft px-3 py-2 text-sm font-semibold text-stuck" role="alert">{text}</p> : null;
}

/** The three rows of a face (RadioGroups): shape, colour, eyes — each option a filled object when chosen. */
export function FaceRows({ face, onPick, idPrefix }: { face: FaceIds; onPick: (f: FaceIds) => void; idPrefix: string }) {
  const row = (key: "body" | "color" | "eyes", ids: readonly string[]) => (
    <div className="grid gap-1.5">
      <span id={`${idPrefix}-${key}`} className="text-sm font-medium text-ink2">{faces.rows[key]}</span>
      <RG.Root className="flex flex-wrap gap-1" aria-labelledby={`${idPrefix}-${key}`} value={face[key]} onValueChange={(v) => onPick({ ...face, [key]: v } as FaceIds)} data-face-row={key}>
        {ids.map((id) => {
          const label = key === "eyes" ? `ตา${faces.eyes[id]}` : faces[key][id]!;
          return (
            <RG.Item key={id} value={id} aria-label={label} title={label}
              className="grid size-11 place-items-center rounded-md border border-transparent hover:bg-now-soft data-[state=checked]:border-ink data-[state=checked]:bg-now-soft">
              {key === "color" ? <i className="block size-6 rounded-full" style={{ background: `var(--face-${id})` }} /> : <Face face={{ ...face, [key]: id } as FaceIds} size={30} />}
            </RG.Item>
          );
        })}
      </RG.Root>
    </div>
  );
  return <div className="grid gap-3">{row("body", BODIES)}{row("color", COLORS)}{row("eyes", EYES)}</div>;
}

/** Roles as chips (1+); the duty line of every chosen role under them. */
export function RoleChips({ value, onChange, label }: { value: WorkerRole[]; onChange: (next: WorkerRole[]) => void; label: string }) {
  const list = value.includes("other") ? [...ROLES, "other" as const] : ROLES;
  return (
    <div className="grid gap-2">
      <ToggleGroup type="multiple" value={value} onValueChange={(v) => { if (v.length > 0) onChange(v as WorkerRole[]); }} aria-label={label} spacing={2} className="flex-wrap" data-roles>
        {list.map((r) => (
          <ToggleGroupItem key={r} value={r} aria-label={roleWord(r)}
            className="min-h-11 min-w-11 rounded-md border border-hair2 px-4 text-[15px] text-ink data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:font-semibold data-[state=on]:text-sheet hover:bg-now-soft">
            {roleWord(r)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="m-0 text-sm text-ink2" data-duty>{value.map((r) => rolePicker.duty[r]).filter(Boolean).join(" · ")}</p>
    </div>
  );
}

const section = "border-t border-hair px-6 py-5 first:border-t-0";
const h3 = "m-0 mb-3 text-sm font-semibold text-ink2";

export function PersonDrawer({ person, chain, workers, working, focus, busy, errors, onClose, onRoles, onFace, onEntry, onLink, onCut, onRemove }: {
  person: Worker | null; chain: Chain; workers: Worker[]; working: boolean; focus: DrawerFocus; busy: boolean;
  errors: { roles: string | null; face: string | null; entry: string | null; handoff: string | null; remove: string | null };
  onClose: () => void; onRoles: (r: WorkerRole[]) => void; onFace: (f: FaceIds) => void; onEntry: () => void;
  onLink: (to: string) => void; onCut: (to: string) => void; onRemove: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { setPicking(false); }, [person?.id]);
  // a readiness fix opens the drawer AT its control
  useEffect(() => {
    if (!person || !focus) return;
    const t = setTimeout(() => body.current?.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus(), 50);
    return () => clearTimeout(t);
  }, [person, focus]);
  const byId = new Map(workers.map((w) => [w.id, w]));
  const p = person;
  const handsTo = p ? chain.edges.filter((e) => e.from === p.id).map((e) => e.to) : [];
  const eligible = p ? chain.members.filter((m) => m.id !== p.id && !handsTo.includes(m.id) && !byId.get(m.id)?.deletedAt) : [];
  const isEntry = p?.id === chain.entryWorkerId;

  return (
    <Sheet open={!!p} modal={false} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}
        className="w-[420px] max-w-[100vw] gap-0 overflow-y-auto border-hair bg-sheet p-0 sm:max-w-[420px]" data-side-panel>
        {p && (
          <div ref={body}>
            <div className={`${section} flex items-center gap-4`}>
              <button type="button" onClick={() => setPicking((x) => !x)} aria-expanded={picking} aria-label={faces.heading(p.name)} title={faces.heading(p.name)}
                className="rounded-full p-1 hover:bg-now-soft" data-face-button>
                <Avatar name={p.name} avatar={p.avatar} size="lg" state={working ? "working" : null} />
              </button>
              <div className="grid min-w-0 flex-1 gap-0.5">
                {/* the whole name, wrapping at spaces only; a part too wide ends in … (DEF-3) — no line clamp here, so no part is ever clipped by it (B-091 drawer layer) */}
                <SheetTitle className="m-0 min-w-0 text-[22px] font-semibold leading-snug text-ink" data-name title={p.name}><NameParts name={p.name} /></SheetTitle>
                <SheetDescription className="m-0 text-sm text-ink3">{p.roles.map(roleWord).join(" · ")}{isEntry ? ` · ${words.entry}` : ""}</SheetDescription>
              </div>
              <Button variant="ghost" className="min-h-11" onClick={onClose}>{teamPage.close}</Button>
            </div>
            {picking && (
              <div className={section} data-face-picker>
                <h3 className={h3}>{faces.heading(p.name)}</h3>
                <FaceRows face={faceFor(p)} onPick={onFace} idPrefix={`fp-${p.id}`} />
                <Refused text={errors.face} />
              </div>
            )}
            <div className={section}>
              <h3 className={h3}>{rolePicker.heading(p.name)}</h3>
              <div data-focus="roles" tabIndex={-1} className="outline-none">
                <RoleChips value={p.roles} onChange={onRoles} label={rolePicker.heading(p.name)} />
              </div>
              {working && <p className="m-0 mt-2 text-sm text-ink2">{live.rolesNextJob}</p>}
              <Refused text={errors.roles} />
            </div>
            <div className={section}>
              {isEntry
                ? <p className="m-0 text-[15px] font-semibold text-now" data-entry-tag>{words.entry}</p>
                : <Button variant="outline" className="min-h-11" disabled={busy} onClick={onEntry} data-focus="entry" data-set-entry>{words.setEntry}</Button>}
              <Refused text={errors.entry} />
            </div>
            <div className={section}>
              <h3 className={h3}>{card.handoff}</h3>
              <ul className="m-0 grid list-none p-0" data-handoff-list>
                {handsTo.map((id) => {
                  const w = byId.get(id);
                  return (
                    <li key={id} className="flex min-h-12 items-center justify-between gap-3 border-t border-hair first:border-t-0" data-hands-to={id}>
                      <span className="flex min-w-0 items-center gap-2.5"><Avatar name={w?.name ?? id} avatar={w?.avatar ?? null} size="sm" /><span className="name" data-name title={w?.name}>{w?.name ?? id}</span></span>
                      <Button variant="ghost" className="min-h-11 shrink-0 text-ink2 underline underline-offset-4" disabled={busy} onClick={() => onCut(id)}>{words.removeEdge}</Button>
                    </li>
                  );
                })}
              </ul>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="mt-3 min-h-11" disabled={busy || eligible.length === 0} data-focus="handoff" data-add-edge>+ {words.addEdge}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  {eligible.map((m) => (
                    <DropdownMenuItem key={m.id} className="min-h-11 gap-2.5" onSelect={() => onLink(m.id)} data-link-to={m.id}>
                      <Avatar name={m.name} avatar={byId.get(m.id)?.avatar ?? null} size="sm" /><span className="name">{m.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Refused text={errors.handoff} />
            </div>
            <details className={section}>
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-[15px] text-ink2">{rolePicker.details}</summary>
              <dl className="m-0 mt-2 grid gap-1.5 text-sm">
                <div className="grid grid-cols-[120px_1fr] gap-2"><dt className="text-ink2">{words.model}</dt><dd className="m-0 font-medium" data-model>{p.model}</dd></div>
                <div className="grid grid-cols-[120px_1fr] gap-2"><dt className="text-ink2">{words.effort}</dt><dd className="m-0 font-medium">{words.effortLevel[p.effort] ?? p.effort}</dd></div>
                <div className="grid grid-cols-[120px_1fr] gap-2"><dt className="text-ink2">{words.skills}</dt><dd className="m-0 font-medium [overflow-wrap:anywhere]" data-skills>{p.skills.join(", ")}</dd></div>
              </dl>
              {p.combinedFrom && <p className="m-0 mt-2 text-sm text-ink2">{words.combinedFrom(byId.get(p.combinedFrom[0])?.name ?? "", byId.get(p.combinedFrom[1])?.name ?? "")}</p>}
            </details>
            <div className={section}>
              <Button variant="ghost" className="min-h-11 text-destructive hover:bg-stuck-soft hover:text-destructive" disabled={busy} onClick={onRemove} data-remove>{teamPage.removeFromProject}</Button>
              <Refused text={errors.remove} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
