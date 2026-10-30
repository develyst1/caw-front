// REQ-112 (TASK-122): the spec parts no card covers — one quiet line per part, the PM's sentence with the key linked to Blueprint (the href comes from the
// server page, which owns BLUEPRINT_URL). Nothing for an empty list; advisory only, never a control that blocks anything.
import { uncovered } from "@/words";

export interface UncoveredItem { key: string; title: string; href: string }

export function Uncovered({ items, className = "" }: { items: UncoveredItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={`m-0 grid list-none gap-0.5 p-0 text-sm text-ink2 ${className}`} data-uncovered>
      {items.map((it) => (
        <li key={it.key} className="flex flex-wrap items-center gap-x-1.5" data-uncovered-part={it.key}>
          <span>{uncovered.lead}</span>{" "}{/* real spaces: the line reads, copies and is announced as the PM's sentence, not only looks like it */}
          <a href={it.href} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4" data-blueprint>{it.key}</a>{" "}
          <span className="min-w-0 break-words">{it.title}</span>
        </li>
      ))}
    </ul>
  );
}
