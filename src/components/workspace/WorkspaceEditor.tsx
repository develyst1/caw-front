"use client";

// The folders the team may write in (REQ-011 / SPEC-A-008 v1.1): a button on ทีม's folders row (TASK-B-099, D-094 H-3) opens a dialog listing them, each with
// เอาออก, and a field to add one. A path the rules refuse (relative, `..`, more than 20) answers with the field's own hint — no new word.
// TASK-B-088: rebuilt on shadcn (Radix Dialog, Input, Button); undo is as before.
// TASK-B-108 (D-099 / D-100): each folder is `เขียนได้` or `อ่านได้อย่างเดียว` — a two-state control on its row and on the add row (default เขียนได้, as
// before). Every save sends both lists (`roots`, `readOnly` ⊆ roots) together; a refused kind switch says so on its own row; undo puts the kind back too.
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { folderEdit, folderKind, teamPage, undo, workspace } from "@/words";
import { saveRoots } from "./actions";
import { canAdd, keepReadOnly, setKind, withoutRoot } from "./roots";
import s from "./workspace.module.css";

type Kind = "writable" | "readOnly";

/** The two-state kind control (a Radix ToggleGroup, role radio) — the chosen side is the filled indigo tint, as the mode control. */
function KindToggle({ value, onChange, disabled, label }: { value: Kind; onChange: (k: Kind) => void; disabled: boolean; label: string }) {
  return (
    <ToggleGroup type="single" value={value} disabled={disabled} aria-label={label} spacing={0} variant="outline" className="rounded-lg"
      onValueChange={(v) => { if (v === "writable" || v === "readOnly") onChange(v); }} data-kind-toggle={value}>
      {(["writable", "readOnly"] as const).map((k) => (
        <ToggleGroupItem key={k} value={k} className="min-h-11 px-3 text-sm text-ink2 data-[state=on]:bg-now-soft data-[state=on]:font-semibold data-[state=on]:text-now hover:bg-now-soft hover:text-ink">
          {folderKind[k]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** `open` / `onOpenChange`: ทีม opens it from its readiness fix too, so the page may hold the state; left out, the dialog holds its own. */
export function WorkspaceEditor({ projectId, roots, readOnly = [], open: held, onOpenChange }: {
  projectId: string; roots: string[]; readOnly?: string[]; open?: boolean; onOpenChange?: (o: boolean) => void;
}) {
  const router = useRouter();
  const [own, setOwn] = useState(false);
  const open = held ?? own;
  const setOpen = (o: boolean) => { setOwn(o); onOpenChange?.(o); };
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<Kind>("writable");
  const [refused, setRefused] = useState(false);
  const [rowRefused, setRowRefused] = useState<string | null>(null); // the folder whose kind switch was refused
  const [pending, start] = useTransition();
  // a removed folder: removed at once, `เลิกทำ` for 5 s puts it back — with its kind (A-P6; words: PM 2026-10-16)
  const [removed, setRemoved] = useState<{ path: string; ro: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = (next: string[], nextRo: string[], then?: () => void, row?: string) => start(async () => {
    const r = await saveRoots(projectId, next, keepReadOnly(next, nextRo));
    if (row) setRowRefused(r.ok ? null : row); else setRefused(!r.ok);
    if (r.ok) { then?.(); router.refresh(); }
  });
  const add = () => {
    const path = draft.trim();
    if (!canAdd(roots, path)) { setRefused(true); return; }
    const next = [...roots, path];
    save(next, draftKind === "readOnly" ? [...readOnly, path] : readOnly, () => { setDraft(""); setDraftKind("writable"); });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRefused(false); setRowRefused(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`${s.trigger} min-h-11 text-[15px]`} aria-label={`${folderEdit} ${workspace.heading}`} data-folders>{folderEdit}</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="max-h-[calc(100dvh-32px)] w-[min(680px,calc(100vw-32px))] max-w-none gap-4 overflow-y-auto border-hair bg-sheet p-6 max-md:p-4 sm:max-w-none">
        <div className="flex items-center justify-between gap-4">
          <DialogTitle className="m-0 text-[19px] font-semibold text-ink">{workspace.heading}</DialogTitle>
          <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>{teamPage.close}</Button>
        </div>
        <p className="m-0 text-sm text-ink2" data-kind-help>{folderKind.help}</p>
        <div className={s.body}>
          {roots.length > 0 && (
            <ul className={s.list}>
              {roots.map((r) => {
                const ro = readOnly.includes(r);
                return (
                  <li key={r} className={`${s.root} flex-wrap`} data-root data-read-only={ro}>
                    <span className={`${s.path} max-md:basis-full!`}>{r}</span> {/* below 768 the path takes the line, the controls go under it */}
                    <span className="flex flex-wrap items-center gap-2">
                      <KindToggle value={ro ? "readOnly" : "writable"} disabled={pending} label={r}
                        onChange={(k) => save(roots, setKind(roots, readOnly, r, k === "readOnly"), undefined, r)} />
                      <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => {
                        const next = withoutRoot(roots, readOnly, r);
                        save(next.roots, next.readOnly, () => {
                          setRemoved({ path: r, ro });
                          if (timer.current) clearTimeout(timer.current);
                          timer.current = setTimeout(() => setRemoved(null), 5000);
                        });
                      }}>{workspace.remove}</Button>
                    </span>
                    {rowRefused === r && <p className={`${s.error} basis-full`} role="alert">{workspace.hint}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {removed && (
            <div className={s.toast} role="status" data-undo-toast>
              <span>{undo.folderRemoved(removed.path)}</span>
              <button type="button" className={s.toastBtn} onClick={() => {
                const r = removed; setRemoved(null);
                save([...roots, r.path], r.ro ? [...readOnly, r.path] : readOnly);
              }}>{undo.button}</button>
            </div>
          )}
          <form className={s.add} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <div className={`${s.row} flex-wrap`}>
              <Input className="h-11 min-w-0 flex-[1_1_240px] text-[15px]" value={draft} placeholder={workspace.hint} aria-label={workspace.heading} aria-invalid={refused}
                onChange={(e) => { setDraft(e.target.value); setRefused(false); }} />
              <KindToggle value={draftKind} onChange={setDraftKind} disabled={pending} label={`${workspace.add} · ${folderKind.writable} / ${folderKind.readOnly}`} />
              <Button type="submit" className="min-h-11 px-5 font-semibold" disabled={pending}>{workspace.add}</Button>
            </div>
            {refused && <p className={s.error} role="alert">{workspace.hint}</p>}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
