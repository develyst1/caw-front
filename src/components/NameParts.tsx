// A person's name that may wrap: it breaks ONLY at its spaces — each part is one run that never breaks inside (a Thai surname is one unit to the
// reader, polish-plan § 2.4, B-086 review). Two modes for a single part wider than its box (TASK-B-092, Q2 answer 2026-10-19):
//  · "cut" (lists, seats, rows, nodes): it ends in … on its own line; the caller puts the whole name in `title`;
//  · "wrap" (a layer's title — the drawer, a dialog): the whole name is always shown (D-088) — the part is an inline-block that only takes more than
//    one line when it alone is wider than the box, and then wraps inside itself as the last resort (overflow-wrap: anywhere). No ellipsis there.
export function NameParts({ name, mode = "cut" }: { name: string; mode?: "cut" | "wrap" }) {
  const parts = name.split(/\s+/).filter(Boolean);
  const part = mode === "wrap"
    ? "inline-block max-w-full align-bottom [overflow-wrap:anywhere]"
    : "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom";
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? " " : ""}
          <span className={part} data-name-part>{p}</span>
        </span>
      ))}
    </>
  );
}
