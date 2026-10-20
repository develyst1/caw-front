"use client";

// The folders the team may write in (REQ-011 / SPEC-A-008 v1.1): a button on ทีม's folders row (TASK-B-099, D-094 H-3) opens a dialog listing them, each with
// เอาออก, and a field to add one. A path the rules refuse (relative, `..`, more than 20) answers with the field's own hint — no new word.
// TASK-B-088: rebuilt on shadcn (Radix Dialog, Input, Button); undo is as before.
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { folderEdit, teamPage, undo, workspace } from "@/words";
import { saveRoots } from "./actions";
import { canAdd } from "./roots";
import s from "./workspace.module.css";

/** `open` / `onOpenChange`: ทีม opens it from its readiness fix too, so the page may hold the state; left out, the dialog holds its own. */
export function WorkspaceEditor({ projectId, roots, open: held, onOpenChange }: { projectId: string; roots: string[]; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const router = useRouter();
  const [own, setOwn] = useState(false);
  const open = held ?? own;
  const setOpen = (o: boolean) => { setOwn(o); onOpenChange?.(o); };
  const [draft, setDraft] = useState("");
  const [refused, setRefused] = useState(false);
  const [pending, start] = useTransition();
  // a removed folder: removed at once, `เลิกทำ` for 5 s puts it back (A-P6; words: PM 2026-10-16)
  const [removed, setRemoved] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = (next: string[], then?: () => void) => start(async () => {
    const r = await saveRoots(projectId, next);
    setRefused(!r.ok);
    if (r.ok) { then?.(); router.refresh(); }
  });
  const add = () => {
    const path = draft.trim();
    if (!canAdd(roots, path)) { setRefused(true); return; }
    save([...roots, path], () => setDraft(""));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRefused(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className={`${s.trigger} min-h-11 text-[15px]`} aria-label={`${folderEdit} ${workspace.heading}`} data-folders>{folderEdit}</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="w-[min(600px,calc(100vw-32px))] max-w-none gap-4 border-hair bg-sheet p-6 sm:max-w-none">
        <div className="flex items-center justify-between gap-4">
          <DialogTitle className="m-0 text-[19px] font-semibold text-ink">{workspace.heading}</DialogTitle>
          <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>{teamPage.close}</Button>
        </div>
        <div className={s.body}>
          {roots.length > 0 && (
            <ul className={s.list}>
              {roots.map((r) => (
                <li key={r} className={s.root} data-root>
                  <span className={s.path}>{r}</span>
                  <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => save(roots.filter((x) => x !== r), () => {
                    setRemoved(r);
                    if (timer.current) clearTimeout(timer.current);
                    timer.current = setTimeout(() => setRemoved(null), 5000);
                  })}>{workspace.remove}</Button>
                </li>
              ))}
            </ul>
          )}
          {removed && (
            <div className={s.toast} role="status" data-undo-toast>
              <span>{undo.folderRemoved(removed)}</span>
              <button type="button" className={s.toastBtn} onClick={() => { const r = removed; setRemoved(null); save([...roots, r]); }}>{undo.button}</button>
            </div>
          )}
          <form className={s.add} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <div className={s.row}>
              <Input className="h-11 min-w-0 flex-1 text-[15px]" value={draft} placeholder={workspace.hint} aria-label={workspace.heading} aria-invalid={refused}
                onChange={(e) => { setDraft(e.target.value); setRefused(false); }} />
              <Button type="submit" className="min-h-11 px-5 font-semibold" disabled={pending}>{workspace.add}</Button>
            </div>
            {refused && <p className={s.error} role="alert">{workspace.hint}</p>}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
