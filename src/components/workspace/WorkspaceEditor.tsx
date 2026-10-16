"use client";

// The folders the team may write in (REQ-011 / SPEC-A-008 v1.1): a button in the project header opens a dialog listing them, each with
// เอาออก, and a field to add one. A path the rules refuse (relative, `..`, more than 20) answers with the field's own hint — no new word.
import { Button, Input, Modal } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { undo, workspace } from "@/words";
import { saveRoots } from "./actions";
import { canAdd } from "./roots";
import s from "./workspace.module.css";

export function WorkspaceEditor({ projectId, roots }: { projectId: string; roots: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    <>
      <Button className={s.trigger} size="large" onClick={() => setOpen(true)} data-folders>{workspace.heading}{roots.length > 0 ? ` (${roots.length})` : ""}</Button>
      <Modal title={workspace.heading} open={open} onCancel={() => { setOpen(false); setRefused(false); }} footer={null} destroyOnHidden>
        <div className={s.body}>
          {roots.length > 0 && (
            <ul className={s.list}>
              {roots.map((r) => (
                <li key={r} className={s.root} data-root>
                  <span className={s.path}>{r}</span>
                  <Button size="large" disabled={pending} onClick={() => save(roots.filter((x) => x !== r), () => {
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
              <Input size="large" value={draft} placeholder={workspace.hint} aria-label={workspace.heading} aria-invalid={refused} status={refused ? "error" : undefined}
                onChange={(e) => { setDraft(e.target.value); setRefused(false); }} />
              <Button size="large" type="primary" htmlType="submit" loading={pending}>{workspace.add}</Button>
            </div>
            {refused && <p className={s.error} role="alert">{workspace.hint}</p>}
          </form>
        </div>
      </Modal>
    </>
  );
}
