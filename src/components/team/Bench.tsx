"use client";

// The bench (D-081 item 2, TASK-B-086 § 4): the people who are not in this project's chain and not deleted — `เพิ่มเข้าสายงาน` puts one back, `ลบคนนี้`
// deletes them everywhere (only here, and only for someone no project uses; on `worker_in_chain` the line names the projects that still do).
import type { Worker } from "@/api/caw";
import { Avatar } from "@/components/Person";
import { Button } from "@/components/ui/button";
import { team as words, teamPage } from "@/words";
import { Refused, roleWord } from "./PersonDrawer";

export function Bench({ people, busy, errors, onAdd, onDelete }: {
  people: Worker[]; busy: boolean; errors: Record<string, string | null>; onAdd: (id: string) => void; onDelete: (id: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <section className="rounded-[10px] border border-hair bg-sheet" aria-labelledby="bench-h" data-bench>
      <h2 id="bench-h" className="m-0 border-b border-hair px-6 py-4 text-[17px] font-semibold">{teamPage.bench}</h2>
      <ul className="m-0 grid list-none p-0">
        {people.map((w) => (
          <li key={w.id} className="border-t border-hair px-6 py-3 first:border-t-0" data-bench-person={w.id}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex min-w-[14rem] flex-1 items-center gap-3">
                <Avatar name={w.name} avatar={w.avatar} size="md" />
                <span className="grid min-w-0">
                  <span className="name text-[15px] font-semibold" data-name title={w.name}>{w.name}</span>
                  <span className="name text-sm text-ink3">{w.roles.map(roleWord).join(" · ")}</span>
                </span>
              </span>
              <span className="flex gap-2">
                <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => onAdd(w.id)}>{words.addToChain}</Button>
                <Button variant="ghost" className="min-h-11 text-destructive hover:bg-stuck-soft hover:text-destructive" disabled={busy} onClick={() => onDelete(w.id)} data-delete-worker>{teamPage.deleteWorker}</Button>
              </span>
            </div>
            <Refused text={errors[w.id] ?? null} />
          </li>
        ))}
      </ul>
    </section>
  );
}
