"use client";

// ทีม · สายงาน, direction B (TASK-B-086; polish-plan § 2.1/§ 6; OD-4/5/8/9/12; D-081 items 1–3; WHY.md § everyday action → pattern). The picture IS the page:
// each person once, as a node that opens their drawer (PersonDrawer — every edit saves as it is made). `+ เพิ่มคนทำงาน` opens the add modal. Readiness is one
// quiet line of ticks, and every fix is a button that does it (opens the drawer at the right control, or the add modal with QA picked). Remove takes a person
// out of this project only (they go to the bench): no open cards → at once, with เลิกทำ in a toast fixed to the viewport; holding cards → a dialog asks who
// takes them, pre-selected; the entry person → a dialog picks who takes work first instead, pre-selected; a running hop → the dialog says so and nothing changes.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast, Toaster } from "sonner";
import type { Avatar as FaceIds, Chain, Project, Worker, WorkerRole } from "@/api/caw";
import { addEdge, addMember, createMember, deleteWorker, removeEdge, removeMember, setEntry, updateWorker, type TeamResult } from "@/app/p/[id]/team/actions";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readiness, type ReadinessItem } from "@/lib/readiness";
import { skillsFor } from "@/lib/roles";
import { folderName } from "@/components/workspace/roots";
import { WorkspaceEditor } from "@/components/workspace/WorkspaceEditor";
import { distill, folderKind, missing, readiness as rw, section, team as words, teamPage, teamRefused, undo, workspace } from "@/words";
import { AddPersonModal } from "./AddPersonModal";
import { CodeMap } from "./CodeMap";
import { Bench } from "./Bench";
import { ChainPicture, type NodeState } from "./ChainPicture";
import { PersonDrawer, type DrawerFocus } from "./PersonDrawer";

type Fail = Extract<TeamResult, { ok: false }>;
const refusal = (r: Fail) => teamRefused[r.code] ?? teamRefused.other!;
type Slot = "roles" | "face" | "entry" | "handoff" | "remove" | "add" | "chain";
type Asking =
  | { kind: "cards"; id: string; count: number; to: string }
  | { kind: "entry"; id: string; to: string }
  | { kind: "running"; id: string }
  | null;

export function Team({ projectId, project, workers, chain, openCards, states, projectNames }: {
  projectId: string; project: Project; workers: Worker[]; chain: Chain; openCards: Record<string, number>; states: Record<string, NodeState>;
  projectNames: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [errors, setErrors] = useState<Partial<Record<Slot, string | null>>>({});
  const [benchErrors, setBenchErrors] = useState<Record<string, string | null>>({});
  const live = workers.filter((w) => !w.deletedAt);
  const byId = new Map(workers.map((w) => [w.id, w]));
  const nameOf = (id: string) => byId.get(id)?.name ?? id;
  const members = chain.members.map((m) => byId.get(m.id) ?? m);
  const memberIds = new Set(members.map((m) => m.id));
  const bench = live.filter((w) => !memberIds.has(w.id));

  const [open, setOpen] = useState<{ id: string; focus: DrawerFocus } | null>(null);
  const [folders, setFolders] = useState(false); // the folders dialog: its row's แก้ and the readiness fix both open it (TASK-B-099, D-094 H-3)
  const person = open ? byId.get(open.id) ?? null : null;
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState<WorkerRole[]>([]);
  const [asking, setAsking] = useState<Asking>(null);
  const [choice, setChoice] = useState<string>("");

  /** run one write; a refusal goes on the line under the control that was used (or to `onRefused`) */
  const act = (slot: Slot, fn: () => Promise<TeamResult>, onOk?: () => void, onRefused?: (r: Fail) => void) => start(async () => {
    setErrors((e) => ({ ...e, [slot]: null }));
    const r = await fn();
    if (r.ok) onOk?.();
    else if (onRefused) onRefused(r);
    else setErrors((e) => ({ ...e, [slot]: r.code === "link_failed" ? (r.details as string[]).join(" · ") : refusal(r) }));
    router.refresh();
  });
  const undoToast = (text: string, fn: () => void) => toast(text, { action: { label: undo.button, onClick: fn }, duration: 6000 });

  // the drawer's writes
  const p = person;
  const onRoles = (next: WorkerRole[]) => { if (p) act("roles", () => updateWorker(projectId, p.id, { roles: next, skills: [...new Set([...p.skills, ...skillsFor(next)])] })); };
  const onFace = (f: FaceIds) => { if (p) act("face", () => updateWorker(projectId, p.id, { avatar: f })); };
  const onEntry = () => { if (p) act("entry", () => setEntry(projectId, p.id)); };
  const onLink = (to: string) => { if (p) act("handoff", () => addEdge(projectId, p.id, to)); };
  const onCut = (to: string) => {
    if (!p) return;
    const from = p.id, fromName = p.name;
    act("handoff", () => removeEdge(projectId, from, to), () => undoToast(undo.cut(fromName, nameOf(to)), () => act("chain", () => addEdge(projectId, from, to))));
  };

  // remove (D-081): the core checks hop_running → is_entry → has_open_cards, in that order; each answer gets its own honest step
  const handOffTarget = (id: string) => chain.edges.find((e) => e.from === id && e.to !== id)?.to ?? members.find((m) => m.id !== id)?.id ?? "";
  const remove = (id: string, reassignTo?: string) => {
    const lines = chain.edges.filter((e) => e.from === id || e.to === id), wasEntry = chain.entryWorkerId === id;
    act("remove", () => removeMember(projectId, id, reassignTo), () => {
      setAsking(null);
      setOpen(null);
      if (reassignTo) return; // the cards moved to someone: no undo (A7)
      undoToast(undo.removed(nameOf(id)), () => act("chain", async () => {
        const r = await addMember(projectId, id);
        if (!r.ok) return r;
        const failed: string[] = [];
        for (const e of lines) { const x = await addEdge(projectId, e.from, e.to); if (!x.ok && x.code !== "edge_exists") failed.push(undo.linkFailed(nameOf(e.from), nameOf(e.to))); }
        if (wasEntry) await setEntry(projectId, id);
        return failed.length ? { ok: false, code: "link_failed", details: failed } : r;
      }));
    }, (r) => {
      if (r.code === "hop_running") setAsking({ kind: "running", id });
      else if (r.code === "is_entry") setAsking({ kind: "entry", id, to: handOffTarget(id) });
      else if (r.code === "has_open_cards") setAsking({ kind: "cards", id, count: (r.details as { count?: number } | undefined)?.count ?? openCards[id] ?? 0, to: handOffTarget(id) });
      else setErrors((e) => ({ ...e, remove: refusal(r) }));
    });
  };
  // the entry person: first hand "takes work first" to someone else, then remove (which may still ask about cards)
  const removeEntry = (id: string, next: string) => start(async () => {
    const r = await setEntry(projectId, next);
    setAsking(null);
    if (!r.ok) { setErrors((e) => ({ ...e, remove: refusal(r) })); router.refresh(); return; }
    remove(id);
  });

  // the bench
  const benchAct = (id: string, fn: () => Promise<TeamResult>) => start(async () => {
    setBenchErrors((e) => ({ ...e, [id]: null }));
    const r = await fn();
    if (!r.ok) setBenchErrors((e) => ({ ...e, [id]: r.code === "worker_in_chain"
      ? teamPage.inProjects(((r.details as { projectIds?: string[] } | undefined)?.projectIds ?? []).map((x) => projectNames[x] ?? x).join(", "))
      : refusal(r) }));
    router.refresh();
  });

  // readiness: one quiet line; each fix is a button that does it
  const qa = members.find((m) => m.roles.includes("QA"));
  const openAt = (id: string | undefined | null, focus: DrawerFocus) => { if (id) setOpen({ id, focus }); };
  const addQa = () => { setPreset(["QA"]); setAdding(true); };
  const focusFolders = () => setFolders(true);
  const check = (i: ReadinessItem): { line: string; fix?: { label: string; go: () => void } } => {
    const who = i.who ?? [], first = who[0];
    const ok = { entry: rw.entry.ok, reachable: rw.reachable.ok, handoff: rw.handOff.ok, qaNotBuilder: rw.qaNotBuilder.ok, folder: rw.folder.ok }[i.rule];
    if (i.state === "ok") return { line: ok };
    switch (i.rule) {
      case "entry": return { line: missing.entry.text, fix: { label: missing.entry.fix, go: () => openAt(members[0]?.id, "entry") } };
      case "folder": return { line: missing.folder.text, fix: { label: missing.folder.fix, go: focusFolders } };
      case "reachable": { const label = rw.reachable.fix(who.map(nameOf).join(", ")); return { line: label, fix: { label, go: () => openAt(chain.entryWorkerId ?? first, "handoff") } }; }
      case "handoff": return qa
        ? { line: ok, fix: { label: rw.handOff.fix(who.map(nameOf).join(", "), qa.name), go: () => openAt(first, "handoff") } }
        : { line: teamPage.noQa.text, fix: { label: `${teamPage.noQa.text} — ${teamPage.noQa.fix}`, go: addQa } };
      case "qaNotBuilder": return { line: ok, fix: { label: rw.qaNotBuilder.fix(byId.get(first ?? "")?.roles.filter((r) => r === "FE" || r === "BE").join(", ") ?? "", nameOf(first ?? "")), go: () => openAt(first, "roles") } };
    }
  };
  const items = readiness(project, chain, workers);

  const asked = asking ? byId.get(asking.id) : undefined;
  const others = asking ? members.filter((m) => m.id !== asking.id) : [];
  const chosen = choice && others.some((o) => o.id === choice) ? choice : asking && asking.kind !== "running" ? asking.to : "";

  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-6 pb-12 pt-8 max-md:px-4 max-md:pt-4">
      <section className="rounded-[10px] border border-hair bg-sheet" aria-labelledby="chain-h">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-6 py-4 max-md:px-4">
          <h2 id="chain-h" className="m-0 text-[19px] font-semibold">{section.team}</h2> {/* T-3: the tab's own word */}
          <AddPersonModal open={adding} onOpenChange={(o) => { setAdding(o); if (!o) setPreset([]); }} preset={preset} busy={busy} error={errors.add ?? null}
            onCreate={(input) => act("add", () => createMember(projectId, input), () => { setAdding(false); setPreset([]); })} />
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-0.5 border-b border-hair px-6 py-2 text-sm text-ink2 max-md:px-4" aria-label={rw.heading} data-readiness>
          {/* T-1 (TASK-B-100): only what needs fixing, each as its fix; all passing → one quiet ✓ สายงานพร้อม */}
          {items.every((i) => i.state === "ok") && (
            <li className="flex min-h-11 items-center gap-x-1.5" data-chain-ready><span aria-hidden className="font-semibold text-now">✓</span>{distill.chainReady}</li>
          )}
          {items.filter((i) => i.state !== "ok").map((i) => {
            const c = check(i);
            return (
              <li key={i.rule} className="flex min-h-11 flex-wrap items-center gap-x-1.5" data-check={i.rule} data-state={i.state}>
                <span aria-hidden className={i.state === "ok" ? "font-semibold text-now" : i.state === "bad" ? "font-semibold text-stuck" : "text-ink3"}>{i.state === "ok" ? "✓" : i.state === "bad" ? "!" : "·"}</span>
                {c.fix
                  ? <button type="button" onClick={c.fix.go} data-fix className={`min-h-11 text-left underline underline-offset-4 ${i.state === "bad" ? "font-semibold text-stuck" : "text-now"}`}>{c.fix.label}</button>
                  : <span>{c.line}</span>}
              </li>
            );
          })}
        </ul>
        {/* the folders the team may write in, beside the readiness line that checks them (TASK-B-099, D-094 H-3 / T-4) */}
        {/* below 768: the label and แก้ on one line, the paths (or the none sentence) under them (B-099 review) */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-hair px-6 py-2 text-sm max-md:px-4 md:flex md:flex-wrap" data-folders-row>
          <span className="font-semibold text-ink">{workspace.heading}</span>
          {project.workspace.roots.length > 0
            ? <ul className="m-0 flex min-w-0 flex-1 list-none flex-wrap gap-x-4 gap-y-0.5 p-0 text-ink2 max-md:col-span-2 max-md:row-start-2">{project.workspace.roots.map((r) => (
                <li key={r} className="inline-flex items-baseline gap-1.5 [overflow-wrap:anywhere]">
                  <span title={r} data-folder-path>{folderName(r, project.workspace.roots) /* D-098: the name, the path in title */}</span>
                  {/* D-099 / D-100 (TASK-B-108): a small quiet tag for the kind */}
                  <span className="text-sm font-semibold text-ink3" data-folder-kind={project.workspace.readOnly.includes(r) ? "read-only" : "writable"}>
                    {project.workspace.readOnly.includes(r) ? folderKind.readOnly : folderKind.writable}
                  </span>
                </li>
              ))}</ul>
            : <span className="min-w-0 flex-1 text-ink3 max-md:col-span-2 max-md:row-start-2">{workspace.none}</span>}
          <WorkspaceEditor projectId={projectId} roots={project.workspace.roots} readOnly={project.workspace.readOnly} open={folders} onOpenChange={setFolders} />
        </div>
        <div className="px-6 py-5 max-md:px-4 max-md:py-2">
          <ChainPicture members={members} edges={chain.edges} entryId={chain.entryWorkerId} states={states} selected={open?.id ?? null} onOpen={(id) => setOpen({ id, focus: null })} />
          {/* D-086: what an arrow means, once, quietly (the B-086 critique's lowest heuristic was help) — only where arrows are drawn (T-2: ≥ 768) */}
          <p className="m-0 mt-3 text-center text-sm text-ink3 max-md:hidden" data-chain-hint>{teamPage.chainHint}</p>
        </div>
        {errors.chain && <p className="m-0 px-6 pb-4 text-sm font-semibold text-stuck" role="alert">{errors.chain}</p>}
      </section>

      {/* the code map (REQ-015 R2, TASK-B-106): its own section right after the chain + folders, never a box inside that one */}
      {project.codeMap && <CodeMap projectId={projectId} map={project.codeMap} />}

      <Bench people={bench} busy={busy} errors={benchErrors}
        onAdd={(id) => benchAct(id, () => addMember(projectId, id))} onDelete={(id) => benchAct(id, () => deleteWorker(projectId, id))} />

      <PersonDrawer projectId={projectId} person={p} chain={chain} workers={workers} working={!!p && states[p.id] === "working"} focus={open?.focus ?? null} busy={busy}
        errors={{ roles: errors.roles ?? null, face: errors.face ?? null, entry: errors.entry ?? null, handoff: errors.handoff ?? null, remove: errors.remove ?? null }}
        onClose={() => setOpen(null)} onRoles={onRoles} onFace={onFace} onEntry={onEntry} onLink={onLink} onCut={onCut} onRemove={() => { if (p) remove(p.id); }} />

      {/* remove, when there is something to decide — never an alert off screen (F8) */}
      <AlertDialog open={!!asking} onOpenChange={(o) => { if (!o) { setAsking(null); setChoice(""); } }}>
        <AlertDialogContent className="border-hair bg-sheet" data-remove-dialog={asking?.kind}>
          <AlertDialogTitle className="text-[17px] font-semibold text-ink">{teamPage.removeFromProject}</AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] text-ink" data-remove-ask>
            {asking?.kind === "cards" && words.reassign(asked?.name ?? "", asking.count)}
            {asking?.kind === "entry" && teamPage.entryFirst(asked?.name ?? "")}
            {asking?.kind === "running" && teamPage.hopRunning(asked?.name ?? "")}
          </AlertDialogDescription>
          {asking && asking.kind !== "running" && (
            <Select value={chosen} onValueChange={setChoice}>
              <SelectTrigger className="h-12 w-full text-[15px] data-[size=default]:h-12" aria-label={asking.kind === "cards" ? words.to : words.setEntry} data-remove-pick><SelectValue /></SelectTrigger>
              <SelectContent>{others.map((o) => <SelectItem key={o.id} value={o.id} className="min-h-11">{o.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{asking?.kind === "running" ? teamPage.close : words.cancel}</AlertDialogCancel>
            {asking && asking.kind !== "running" && (
              <Button className="min-h-11 bg-destructive font-semibold text-[var(--gd-on-accent)] hover:bg-destructive/90" /* on-accent: white in light, ink in dark (≥ 4.5 on both) */ disabled={!chosen || busy} data-remove-confirm
                onClick={() => { const a = asking; setChoice(""); if (a.kind === "cards") remove(a.id, chosen); else removeEntry(a.id, chosen); }}>
                {teamPage.removeFromProject}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="bottom-center" toastOptions={{ className: "!bg-ink !text-sheet !border-0 !text-[15px]" }} />
    </div>
  );
}
