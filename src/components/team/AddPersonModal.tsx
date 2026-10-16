"use client";

// Add a person (OD-12, TASK-B-086 § 3, comp studies/REQ-014-direction-B/add.html): `+ เพิ่มคนทำงาน` opens a centred modal — a full-screen sheet below 768 px —
// and the whole add happens in it: name · character (a live preview from the typed name until a part is picked, then shape · colour · eyes) · roles →
// เพิ่มคนทำงาน. Skills fold under รายละเอียด, pre-filled from the roles. Escape or ยกเลิก closes it and focus goes back to the button (Radix Dialog).
// Nothing about adding stays on the page while it is closed.
import { useEffect, useState } from "react";
import type { Avatar as FaceIds, WorkerRole } from "@/api/caw";
import { Face } from "@/components/faces/Face";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deriveFace } from "@/lib/faces";
import { skillsFor } from "@/lib/roles";
import { rolePicker, team as words, teamPage } from "@/words";
import { FaceRows, Refused, RoleChips } from "./PersonDrawer";

export function AddPersonModal({ open, onOpenChange, preset, busy, error, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; preset: WorkerRole[]; busy: boolean; error: string | null;
  onCreate: (input: { name: string; roles: WorkerRole[]; skills: string[]; avatar: FaceIds | null }) => void;
}) {
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<WorkerRole[]>(preset);
  const [picked, setPicked] = useState<FaceIds | null>(null);
  const [skills, setSkills] = useState(skillsFor(preset).join(", "));
  // every opening starts clean, with the roles a readiness fix asked for (e.g. QA)
  useEffect(() => { if (open) { setName(""); setRoles(preset); setPicked(null); setSkills(skillsFor(preset).join(", ")); } }, [open, preset]);
  const face = picked ?? deriveFace(name.trim() || "?");
  const pickRoles = (next: WorkerRole[]) => {
    const typed = skills.split(",").map((x) => x.trim()).filter(Boolean).filter((k) => !skillsFor(roles).includes(k));
    setSkills([...new Set([...skillsFor(next), ...typed])].join(", "));
    setRoles(next);
  };
  const ready = name.trim() !== "" && roles.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-11 px-5 text-[15px] font-semibold" data-add-person>{teamPage.addPerson}</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} aria-describedby={undefined}
        className="grid max-h-[calc(100vh-48px)] w-[min(640px,calc(100vw-48px))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-hair bg-sheet p-0 sm:max-w-none max-md:inset-0 max-md:h-full max-md:max-h-none max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none"
        data-add-worker>
        <div className="flex items-center justify-between gap-4 border-b border-hair py-3 pl-7 pr-4 max-md:pl-4">
          <DialogTitle className="m-0 text-[19px] font-semibold text-ink">{words.addWorker}</DialogTitle>
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>{teamPage.close}</Button>
        </div>
        <form id="add-person" className="grid gap-5 overflow-y-auto px-7 py-5 max-md:px-4"
          onSubmit={(e) => { e.preventDefault(); if (ready) onCreate({ name: name.trim(), roles, skills: skills.split(",").map((x) => x.trim()).filter(Boolean), avatar: picked }); }}>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-ink2">{words.name}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-[15px]" autoFocus data-name-input />
          </label>
          <div className="grid grid-cols-[148px_minmax(0,1fr)] items-start gap-5 max-md:grid-cols-1">
            <div className="grid justify-items-center gap-2 rounded-md bg-now-soft px-3 pb-3.5 pt-4" data-face-preview>
              <Face face={face} size={88} />
              <b className="name max-w-[124px] text-[15px] font-semibold" data-name title={name}>{name.trim() || " "}</b>
            </div>
            <FaceRows face={face} onPick={setPicked} idPrefix="add" />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-ink2">{words.role} · {rolePicker.hint}</span>
            <RoleChips value={roles} onChange={pickRoles} label={words.role} />
          </div>
          <details>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-[15px] text-ink2">{rolePicker.details}</summary>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-ink2">{words.skills}</span>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={words.skillsHint} className="h-12 text-[15px]" data-skills-input />
            </label>
          </details>
          <Refused text={error} />
        </form>
        <div className="flex justify-end gap-2 border-t border-hair px-7 py-3.5 max-md:px-4">
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>{words.cancel}</Button>
          <Button type="submit" form="add-person" className="min-h-11 px-5 font-semibold" disabled={!ready || busy}>{words.addWorker}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
